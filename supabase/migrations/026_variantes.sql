-- supabase/migrations/026_variantes.sql
-- Variantes de producto: opciones libres (Talla, Color, Tamaño…) definidas por
-- el admin y una fila por combinación con su propio stock y precio opcional.
--
-- Los productos sin variantes no cambian. En los que sí tienen, el stock vive
-- en producto_variantes y un trigger mantiene productos_evento.stock_actual
-- como la suma de las activas, para que la grilla, los badges y los reportes
-- que ya leen esa columna sigan funcionando.
--
-- "Tiene variantes" = existe al menos una variante ACTIVA.

begin;

-- ── Tablas ───────────────────────────────────────────────────────────────────
create table if not exists public.producto_opciones (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos_evento(id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  posicion    integer not null default 0,
  valores     jsonb not null default '[]'::jsonb check (jsonb_typeof(valores) = 'array'),
  unique (producto_id, nombre)
);

create table if not exists public.producto_variantes (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos_evento(id) on delete cascade,
  opciones     jsonb not null check (jsonb_typeof(opciones) = 'object'),
  precio       integer null check (precio is null or precio > 0),
  stock_actual integer not null default 0 check (stock_actual >= 0),
  activo       boolean not null default true,
  posicion     integer not null default 0,
  creado_en    timestamptz not null default now(),
  unique (producto_id, opciones)
);

create index if not exists idx_producto_variantes_producto on public.producto_variantes(producto_id);

-- ── Columnas en tablas existentes ────────────────────────────────────────────
alter table public.pedido_items
  add column if not exists variante_id uuid references public.producto_variantes(id) on delete set null,
  add column if not exists variante_label text;

alter table public.ventas_evento
  add column if not exists variante_id uuid references public.producto_variantes(id) on delete set null;

alter table public.producto_movimientos
  add column if not exists variante_id uuid references public.producto_variantes(id) on delete set null;

-- ── Máximo 3 opciones por producto ───────────────────────────────────────────
create or replace function public.limitar_opciones_producto()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.producto_opciones where producto_id = new.producto_id) >= 3 then
    raise exception 'Un producto admite máximo 3 opciones';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limitar_opciones on public.producto_opciones;
create trigger trg_limitar_opciones
  before insert on public.producto_opciones
  for each row execute function public.limitar_opciones_producto();

-- ── Stock del producto = suma de variantes activas ───────────────────────────
-- SECURITY DEFINER: lo dispara también el operador de POS vía
-- decrementar_stock_seguro, que no tiene UPDATE directo sobre productos_evento.
create or replace function public.sincronizar_stock_producto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pid   uuid := coalesce(new.producto_id, old.producto_id);
  v_total integer;
begin
  -- Se bloquea la fila del producto y luego se suma en otra sentencia: así la
  -- suma ve los cambios ya confirmados de variantes hermanas (READ COMMITTED).
  perform 1 from public.productos_evento where id = v_pid for update;
  select coalesce(sum(stock_actual), 0) into v_total
    from public.producto_variantes where producto_id = v_pid and activo;
  update public.productos_evento set stock_actual = v_total where id = v_pid;
  return null;
end;
$$;

drop trigger if exists trg_variantes_stock on public.producto_variantes;
create trigger trg_variantes_stock
  after insert or delete or update of stock_actual, activo on public.producto_variantes
  for each row execute function public.sincronizar_stock_producto();

-- Movimiento de creación por variante (el de productos_evento registra
-- stock_inicial del producto, que en productos con variantes es 0).
create or replace function public.registrar_creacion_variante()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock_actual > 0 then
    insert into public.producto_movimientos (producto_id, variante_id, tipo, cantidad)
    values (new.producto_id, new.id, 'creacion', new.stock_actual);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_variante_creada on public.producto_variantes;
create trigger trg_variante_creada
  after insert on public.producto_variantes
  for each row execute function public.registrar_creacion_variante();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.producto_opciones  enable row level security;
alter table public.producto_variantes enable row level security;

drop policy if exists producto_opciones_public_read on public.producto_opciones;
create policy producto_opciones_public_read on public.producto_opciones
  for select using (exists (
    select 1 from public.productos_evento p where p.id = producto_id and p.activo));

drop policy if exists producto_opciones_admin_all on public.producto_opciones;
create policy producto_opciones_admin_all on public.producto_opciones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists producto_variantes_public_read on public.producto_variantes;
create policy producto_variantes_public_read on public.producto_variantes
  for select using (activo and exists (
    select 1 from public.productos_evento p where p.id = producto_id and p.activo));

drop policy if exists producto_variantes_pos_read on public.producto_variantes;
create policy producto_variantes_pos_read on public.producto_variantes
  for select to authenticated using (public.is_pos_operator());

drop policy if exists producto_variantes_admin_all on public.producto_variantes;
create policy producto_variantes_admin_all on public.producto_variantes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- El POS escucha cambios de stock en vivo.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'producto_variantes') then
    alter publication supabase_realtime add table public.producto_variantes;
  end if;
end $$;

-- ── Funciones de stock con variante opcional ─────────────────────────────────
-- Se eliminan por firma: con el parámetro nuevo con default, dejar la versión
-- vieja haría ambigua cualquier llamada con los argumentos de siempre.
drop function if exists public.decrementar_stock_seguro(uuid, integer);
drop function if exists public.registrar_restock(uuid, integer, text);
drop function if exists public.registrar_ajuste(uuid, integer, text);

create or replace function public.tiene_variantes(p_producto_id uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.producto_variantes where producto_id = p_producto_id and activo);
$$;

-- Valida que la variante sea de ese producto; devuelve su id o lanza.
create or replace function public.variante_de_producto(p_producto_id uuid, p_variante_id uuid)
returns uuid language plpgsql stable set search_path = public as $$
begin
  if not exists (select 1 from public.producto_variantes
                 where id = p_variante_id and producto_id = p_producto_id) then
    raise exception 'La variante no pertenece al producto';
  end if;
  return p_variante_id;
end;
$$;

create or replace function public.decrementar_stock_seguro(
  p_producto_id uuid,
  p_cantidad    integer,
  p_variante_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_pos_operator()) then
    raise exception 'No autorizado';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  if p_variante_id is not null then
    perform public.variante_de_producto(p_producto_id, p_variante_id);
    perform 1 from public.productos_evento where id = p_producto_id for update;
    update public.producto_variantes
       set stock_actual = greatest(0, stock_actual - p_cantidad)
     where id = p_variante_id;
  else
    -- Sin variante se comporta como siempre (ventas de la cola offline de un
    -- POS anterior incluidas).
    update public.productos_evento
       set stock_actual = greatest(0, stock_actual - p_cantidad)
     where id = p_producto_id;
  end if;
end;
$$;

create or replace function public.registrar_restock(
  p_producto_id uuid,
  p_cantidad    integer,
  p_nota        text default null,
  p_variante_id uuid default null
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  if p_variante_id is not null then
    perform public.variante_de_producto(p_producto_id, p_variante_id);
    perform 1 from public.productos_evento where id = p_producto_id for update;
    update public.producto_variantes set stock_actual = stock_actual + p_cantidad where id = p_variante_id;
  else
    if public.tiene_variantes(p_producto_id) then
      raise exception 'Este producto tiene variantes: reabastece cada combinación';
    end if;
    update public.productos_evento set stock_actual = stock_actual + p_cantidad where id = p_producto_id;
  end if;

  insert into public.producto_movimientos (producto_id, variante_id, tipo, cantidad, nota)
  values (p_producto_id, p_variante_id, 'restock', p_cantidad, p_nota);
end;
$$;

create or replace function public.registrar_ajuste(
  p_producto_id uuid,
  p_nuevo_stock integer,
  p_nota        text default null,
  p_variante_id uuid default null
) returns void language plpgsql security invoker set search_path = public as $$
declare
  v_actual integer;
  v_delta  integer;
begin
  if p_nuevo_stock is null or p_nuevo_stock < 0 then
    raise exception 'El stock no puede ser negativo';
  end if;

  if p_variante_id is not null then
    perform public.variante_de_producto(p_producto_id, p_variante_id);
    perform 1 from public.productos_evento where id = p_producto_id for update;
    select stock_actual into v_actual from public.producto_variantes where id = p_variante_id for update;
  else
    if public.tiene_variantes(p_producto_id) then
      raise exception 'Este producto tiene variantes: ajusta cada combinación';
    end if;
    select stock_actual into v_actual from public.productos_evento where id = p_producto_id for update;
    if not found then raise exception 'Producto no encontrado'; end if;
  end if;

  v_delta := p_nuevo_stock - v_actual;
  if v_delta = 0 then return; end if;

  if p_variante_id is not null then
    update public.producto_variantes set stock_actual = p_nuevo_stock where id = p_variante_id;
  else
    update public.productos_evento set stock_actual = p_nuevo_stock where id = p_producto_id;
  end if;

  insert into public.producto_movimientos (producto_id, variante_id, tipo, cantidad, nota)
  values (p_producto_id, p_variante_id, 'ajuste', v_delta, p_nota);
end;
$$;

-- ── Guardar opciones y combinaciones desde el admin ──────────────────────────
-- Una combinación se identifica por su JSON de opciones (jsonb compara sin
-- importar el orden de las claves). Las que siguen existiendo conservan id,
-- stock e historial; las que desaparecen se desactivan (nunca se borran: puede
-- haber pedidos que las referencian); las nuevas nacen con stock_inicial.
create or replace function public.guardar_variantes(
  p_producto_id uuid,
  p_opciones    jsonb,
  p_variantes   jsonb
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_x        jsonb;
  v_ord      bigint;
  v_creadas  integer := 0;
  v_act      integer := 0;
  v_desact   integer := 0;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  perform 1 from public.productos_evento where id = p_producto_id for update;
  if jsonb_typeof(p_opciones) <> 'array' or jsonb_typeof(p_variantes) <> 'array' then
    raise exception 'Formato inválido';
  end if;

  delete from public.producto_opciones where producto_id = p_producto_id;
  insert into public.producto_opciones (producto_id, nombre, posicion, valores)
  select p_producto_id, trim(o->>'nombre'), (ord - 1)::int, coalesce(o->'valores', '[]'::jsonb)
  from jsonb_array_elements(p_opciones) with ordinality as t(o, ord);

  update public.producto_variantes v
     set activo = false
   where v.producto_id = p_producto_id
     and v.activo
     and not exists (select 1 from jsonb_array_elements(p_variantes) x where x->'opciones' = v.opciones);
  get diagnostics v_desact = row_count;

  for v_x, v_ord in select x, ord from jsonb_array_elements(p_variantes) with ordinality as t(x, ord) loop
    update public.producto_variantes
       set precio   = nullif(v_x->>'precio', '')::integer,
           activo   = coalesce((v_x->>'activo')::boolean, true),
           posicion = (v_ord - 1)::int
     where producto_id = p_producto_id and opciones = v_x->'opciones';
    if found then
      v_act := v_act + 1;
    else
      insert into public.producto_variantes (producto_id, opciones, precio, stock_actual, activo, posicion)
      values (p_producto_id, v_x->'opciones', nullif(v_x->>'precio', '')::integer,
              greatest(0, coalesce((v_x->>'stock_inicial')::integer, 0)),
              coalesce((v_x->>'activo')::boolean, true), (v_ord - 1)::int);
      v_creadas := v_creadas + 1;
    end if;
  end loop;

  return jsonb_build_object('creadas', v_creadas, 'actualizadas', v_act, 'desactivadas', v_desact);
end;
$$;

-- ── Permisos ─────────────────────────────────────────────────────────────────
revoke all on function public.decrementar_stock_seguro(uuid, integer, uuid) from public;
revoke execute on function public.decrementar_stock_seguro(uuid, integer, uuid) from anon;
grant execute on function public.decrementar_stock_seguro(uuid, integer, uuid) to authenticated, service_role;

revoke all on function public.registrar_restock(uuid, integer, text, uuid) from public;
revoke execute on function public.registrar_restock(uuid, integer, text, uuid) from anon;
grant execute on function public.registrar_restock(uuid, integer, text, uuid) to authenticated, service_role;

revoke all on function public.registrar_ajuste(uuid, integer, text, uuid) from public;
revoke execute on function public.registrar_ajuste(uuid, integer, text, uuid) from anon;
grant execute on function public.registrar_ajuste(uuid, integer, text, uuid) to authenticated, service_role;

revoke all on function public.guardar_variantes(uuid, jsonb, jsonb) from public;
revoke execute on function public.guardar_variantes(uuid, jsonb, jsonb) from anon;
grant execute on function public.guardar_variantes(uuid, jsonb, jsonb) to authenticated;

revoke all on function public.tiene_variantes(uuid) from public;
revoke all on function public.variante_de_producto(uuid, uuid) from public;
revoke execute on function public.tiene_variantes(uuid) from anon;
revoke execute on function public.variante_de_producto(uuid, uuid) from anon;
grant execute on function public.tiene_variantes(uuid) to authenticated, service_role;
grant execute on function public.variante_de_producto(uuid, uuid) to authenticated, service_role;

revoke all on function public.sincronizar_stock_producto() from public;
revoke all on function public.registrar_creacion_variante() from public;
revoke all on function public.limitar_opciones_producto() from public;
revoke execute on function public.sincronizar_stock_producto() from anon, authenticated;
revoke execute on function public.registrar_creacion_variante() from anon, authenticated;
revoke execute on function public.limitar_opciones_producto() from anon, authenticated;

commit;
