-- supabase/migrations/027_reservas_stock.sql
-- Reserva de stock mientras el cliente paga (15 minutos).
--
-- stock_actual sigue siendo el stock FÍSICO. Lo que la tienda puede vender es
-- físico − reservas vigentes. Una reserva está vigente si no ha vencido y su
-- pedido sigue 'pendiente': las vencidas simplemente dejan de contar, así que
-- no hace falta un cron para liberarlas a tiempo (se borran de paso).
--
-- Toda reserva bloquea con FOR UPDATE las filas de productos_evento del pedido
-- (en orden de id). Como el trigger de variantes también actualiza esa fila,
-- la fila del producto hace de mutex para reservas y ventas web del producto.

begin;

create table if not exists public.stock_reservas (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid not null references public.productos_evento(id) on delete cascade,
  variante_id uuid null references public.producto_variantes(id) on delete cascade,
  cantidad    integer not null check (cantidad > 0),
  expira_en   timestamptz not null,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_stock_reservas_item on public.stock_reservas(producto_id, variante_id);
create index if not exists idx_stock_reservas_expira on public.stock_reservas(expira_en);
create index if not exists idx_stock_reservas_pedido on public.stock_reservas(pedido_id);

alter table public.stock_reservas enable row level security;
drop policy if exists stock_reservas_admin_read on public.stock_reservas;
create policy stock_reservas_admin_read on public.stock_reservas
  for select to authenticated using (public.is_admin());

alter table public.pedidos
  add column if not exists reserva_expira_en     timestamptz,
  add column if not exists sobreventa            boolean not null default false,
  add column if not exists cancelado_por_cliente boolean not null default false;

-- ── Reservas vigentes agregadas ──────────────────────────────────────────────
create or replace function public.reservas_vigentes()
returns table (producto_id uuid, variante_id uuid, cantidad integer)
language sql stable security definer set search_path = public as $$
  select r.producto_id, r.variante_id, sum(r.cantidad)::integer
  from public.stock_reservas r
  join public.pedidos pe on pe.id = r.pedido_id
  where r.expira_en > now() and pe.estado = 'pendiente'
  group by r.producto_id, r.variante_id;
$$;

-- ── Reservar el stock de un pedido recién creado ─────────────────────────────
create or replace function public.reservar_stock_pedido(
  p_pedido_id uuid,
  p_minutos   integer default 15
) returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_expira timestamptz := now() + make_interval(mins => p_minutos);
  v_item   record;
  v_fisico integer;
  v_resv   integer;
begin
  -- Limpieza oportunista: nadie depende de estas filas.
  delete from public.stock_reservas r
   using public.pedidos pe
   where pe.id = r.pedido_id and (r.expira_en <= now() or pe.estado <> 'pendiente');

  -- Mutex por producto, en orden estable para no provocar deadlocks.
  perform 1 from public.productos_evento
   where id in (select producto_id from public.pedido_items where pedido_id = p_pedido_id)
   order by id for update;

  for v_item in
    select pi.producto_id, pi.variante_id, sum(pi.cantidad)::integer as cantidad
    from public.pedido_items pi
    where pi.pedido_id = p_pedido_id and pi.producto_id is not null
    group by pi.producto_id, pi.variante_id
    order by pi.producto_id, pi.variante_id
  loop
    if v_item.variante_id is not null then
      select stock_actual into v_fisico from public.producto_variantes where id = v_item.variante_id;
      select coalesce(sum(cantidad), 0) into v_resv from public.reservas_vigentes() rv
       where rv.variante_id = v_item.variante_id;
    else
      select stock_actual into v_fisico from public.productos_evento where id = v_item.producto_id;
      select coalesce(sum(cantidad), 0) into v_resv from public.reservas_vigentes() rv
       where rv.producto_id = v_item.producto_id and rv.variante_id is null;
    end if;

    if coalesce(v_fisico, 0) - v_resv < v_item.cantidad then
      raise exception using
        errcode = 'P0409',
        message = 'sin_stock',
        detail  = json_build_object(
          'producto_id', v_item.producto_id,
          'variante_id', v_item.variante_id,
          'disponible',  greatest(0, coalesce(v_fisico, 0) - v_resv))::text;
    end if;

    insert into public.stock_reservas (pedido_id, producto_id, variante_id, cantidad, expira_en)
    values (p_pedido_id, v_item.producto_id, v_item.variante_id, v_item.cantidad, v_expira);
  end loop;

  update public.pedidos set reserva_expira_en = v_expira where id = p_pedido_id;
  return v_expira;
end;
$$;

create or replace function public.liberar_reservas_pedido(p_referencia text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  delete from public.stock_reservas r
   using public.pedidos pe
   where pe.id = r.pedido_id and pe.referencia = p_referencia;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ── Lo que la tienda puede vender ────────────────────────────────────────────
create or replace function public.stock_disponible(p_producto_ids uuid[] default null)
returns table (producto_id uuid, variante_id uuid, disponible integer)
language sql stable security definer set search_path = public as $$
  with res as (select * from public.reservas_vigentes()),
  prods as (
    select p.id, p.stock_actual from public.productos_evento p
    where p.activo and (p_producto_ids is null or p.id = any(p_producto_ids))
  ),
  vars as (
    select v.producto_id, v.id as variante_id,
           greatest(0, v.stock_actual - coalesce(r.cantidad, 0))::integer as disponible
    from public.producto_variantes v
    join prods on prods.id = v.producto_id
    left join res r on r.variante_id = v.id
    where v.activo
  )
  select p.id, null::uuid,
         case when exists (select 1 from vars where vars.producto_id = p.id)
              then (select sum(disponible) from vars where vars.producto_id = p.id)::integer
              else greatest(0, p.stock_actual - coalesce((
                     select r.cantidad from res r where r.producto_id = p.id and r.variante_id is null), 0))::integer
         end
  from prods p
  union all
  select producto_id, variante_id, disponible from vars;
$$;

-- ── "Cancelar y liberar" desde la página ─────────────────────────────────────
create or replace function public.cancelar_pedido_pendiente(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.pedidos
     set estado = 'cancelado', cancelado_por_cliente = true
   where confirmacion_token::text = p_token and estado = 'pendiente'
  returning id into v_id;
  if v_id is null then return false; end if;
  delete from public.stock_reservas where pedido_id = v_id;
  return true;
end;
$$;

-- ── Descuento al aprobarse el pago (reemplaza la versión de 020) ─────────────
create or replace function public.registrar_venta_web(p_referencia text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_pedido     public.pedidos%rowtype;
  v_item       record;
  v_fisico     integer;
  v_lineas     integer := 0;
  v_sobreventa boolean := false;
begin
  select * into v_pedido from public.pedidos where referencia = p_referencia for update;
  if not found then return 0; end if;
  if v_pedido.estado <> 'aprobado' or v_pedido.stock_descontado then return 0; end if;

  perform 1 from public.productos_evento
   where id in (select producto_id from public.pedido_items where pedido_id = v_pedido.id)
   order by id for update;

  for v_item in
    select pi.producto_id, pi.variante_id, sum(pi.cantidad)::integer as cantidad
    from public.pedido_items pi
    where pi.pedido_id = v_pedido.id and pi.producto_id is not null
    group by pi.producto_id, pi.variante_id
    order by pi.producto_id, pi.variante_id
  loop
    -- El stock físico incluye la unidad reservada por este pedido; si no
    -- alcanza es porque otro canal la vendió (POS o reserva vencida).
    if v_item.variante_id is not null then
      select stock_actual into v_fisico from public.producto_variantes where id = v_item.variante_id;
      update public.producto_variantes
         set stock_actual = greatest(0, stock_actual - v_item.cantidad)
       where id = v_item.variante_id;
    else
      select stock_actual into v_fisico from public.productos_evento where id = v_item.producto_id;
      update public.productos_evento
         set stock_actual = greatest(0, stock_actual - v_item.cantidad)
       where id = v_item.producto_id;
    end if;
    if coalesce(v_fisico, 0) < v_item.cantidad then v_sobreventa := true; end if;

    insert into public.ventas_evento (producto_id, variante_id, cantidad, canal, evento_id, dispositivo)
    select v_item.producto_id, v_item.variante_id, v_item.cantidad, 'web',
           coalesce(pe.evento_id, 'Venta-regular'), 'web:' || v_pedido.referencia
    from public.productos_evento pe where pe.id = v_item.producto_id;

    v_lineas := v_lineas + 1;
  end loop;

  delete from public.stock_reservas where pedido_id = v_pedido.id;

  update public.pedidos
     set stock_descontado = true, sobreventa = v_sobreventa
   where id = v_pedido.id;

  return v_lineas;
end;
$$;

-- ── Confirmación: etiqueta de variante y contador de la reserva ──────────────
create or replace function public.obtener_pedido(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'referencia', p.referencia, 'estado', p.estado,
    'nombre', p.nombre, 'apellido', p.apellido, 'email', p.email,
    'ciudad', p.ciudad, 'direccion', p.direccion, 'barrio', p.barrio,
    'subtotal', p.subtotal, 'total', p.total, 'creado_en', p.creado_en,
    'envio_gratis', p.envio_gratis,
    'reserva_expira_en', p.reserva_expira_en,
    'cancelado_por_cliente', p.cancelado_por_cliente,
    'pedido_items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'producto_id', i.producto_id, 'variante_id', i.variante_id,
               'nombre', i.nombre, 'sub', i.sub, 'precio', i.precio,
               'cantidad', i.cantidad, 'color', i.color,
               'variante_label', i.variante_label) order by i.creado_en)
      from public.pedido_items i where i.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from public.pedidos p
  where p.confirmacion_token::text = p_token;
$$;

-- ── Permisos ─────────────────────────────────────────────────────────────────
revoke all on function public.reservas_vigentes() from public;
revoke all on function public.reservar_stock_pedido(uuid, integer) from public;
revoke all on function public.liberar_reservas_pedido(text) from public;
revoke all on function public.stock_disponible(uuid[]) from public;
revoke all on function public.cancelar_pedido_pendiente(text) from public;
revoke all on function public.registrar_venta_web(text) from public;
revoke all on function public.obtener_pedido(text) from public;

revoke execute on function public.reservas_vigentes() from anon;
revoke execute on function public.reservar_stock_pedido(uuid, integer) from anon;
revoke execute on function public.liberar_reservas_pedido(text) from anon;
revoke execute on function public.registrar_venta_web(text) from anon;

grant execute on function public.reservas_vigentes() to service_role;
grant execute on function public.reservar_stock_pedido(uuid, integer) to service_role;
grant execute on function public.liberar_reservas_pedido(text) to service_role;
grant execute on function public.registrar_venta_web(text) to service_role;
grant execute on function public.stock_disponible(uuid[]) to anon, authenticated, service_role;
grant execute on function public.cancelar_pedido_pendiente(text) to anon, authenticated;
grant execute on function public.obtener_pedido(text) to anon, authenticated;

commit;
