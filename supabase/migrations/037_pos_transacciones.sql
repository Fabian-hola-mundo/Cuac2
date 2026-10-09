-- 037_pos_transacciones.sql
-- POS con carrito y medio de pago: una compra con varios productos se registra
-- como una transacción atómica e idempotente, y las ventas del evento se
-- sincronizan en vivo entre todos los POS.
begin;

-- ── Columnas nuevas en ventas_evento (null en filas existentes y ventas web) ──
alter table public.ventas_evento
  add column if not exists transaccion_id uuid,
  add column if not exists metodo_pago text
    check (metodo_pago in ('qr', 'datafono', 'efectivo')),
  add column if not exists precio_unitario integer
    check (precio_unitario is null or precio_unitario >= 0);

create index if not exists ventas_evento_transaccion_id_idx
  on public.ventas_evento (transaccion_id);

-- ── registrar_transaccion_pos ────────────────────────────────────────────────
create or replace function public.registrar_transaccion_pos(
  p_transaccion_id uuid,
  p_metodo_pago    text,
  p_evento_id      text,
  p_dispositivo    text,
  p_dispositivo_id uuid,
  p_comentario     text,
  p_vendido_en     timestamptz,
  p_lineas         jsonb
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_l        jsonb;
  v_prod     uuid;
  v_var      uuid;
  v_cant     integer;
  v_precio   integer;
begin
  if not (public.is_admin() or public.is_pos_operator()) then
    raise exception 'No autorizado';
  end if;

  if p_transaccion_id is null then
    raise exception 'Falta el identificador de la venta';
  end if;
  if p_metodo_pago is not null and p_metodo_pago not in ('qr', 'datafono', 'efectivo') then
    raise exception 'Medio de pago inválido';
  end if;
  if p_comentario is not null and char_length(p_comentario) > 280 then
    raise exception 'Observación demasiado larga';
  end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  -- Serializa reintentos simultáneos de la misma transacción.
  perform pg_advisory_xact_lock(hashtext(p_transaccion_id::text));

  if exists (select 1 from public.ventas_evento where transaccion_id = p_transaccion_id) then
    return 'duplicada';
  end if;

  for v_l in select * from jsonb_array_elements(p_lineas) loop
    v_prod   := (v_l->>'producto_id')::uuid;
    v_var    := nullif(v_l->>'variante_id', '')::uuid;
    v_cant   := (v_l->>'cantidad')::integer;
    v_precio := nullif(v_l->>'precio_unitario', '')::integer;

    if v_prod is null then
      raise exception 'Falta el producto en una línea';
    end if;
    if v_cant is null or v_cant <= 0 then
      raise exception 'La cantidad debe ser mayor a 0';
    end if;
    if v_precio is not null and v_precio < 0 then
      raise exception 'El precio no puede ser negativo';
    end if;

    -- Misma lógica que decrementar_stock_seguro (026_variantes.sql). No se
    -- rechaza por stock insuficiente: la venta física ya ocurrió.
    if v_var is not null then
      perform public.variante_de_producto(v_prod, v_var);
      perform 1 from public.productos_evento where id = v_prod for update;
      update public.producto_variantes
         set stock_actual = greatest(0, stock_actual - v_cant)
       where id = v_var;
    else
      update public.productos_evento
         set stock_actual = greatest(0, stock_actual - v_cant)
       where id = v_prod;
    end if;

    insert into public.ventas_evento (
      producto_id, variante_id, cantidad, dispositivo, dispositivo_id, vendido_en,
      sincronizado, canal, evento_id, comentario,
      transaccion_id, metodo_pago, precio_unitario
    ) values (
      v_prod, v_var, v_cant, p_dispositivo, p_dispositivo_id, coalesce(p_vendido_en, now()),
      true, null, p_evento_id, p_comentario,
      p_transaccion_id, p_metodo_pago, v_precio
    );
  end loop;

  return 'registrada';
end;
$$;

-- ── mas_vendidos_evento ──────────────────────────────────────────────────────
create or replace function public.mas_vendidos_evento(
  p_evento_id text,
  p_limite    int default 8
) returns table (producto_id uuid, unidades bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_pos_operator()) then
    raise exception 'No autorizado';
  end if;

  return query
    select v.producto_id, sum(v.cantidad)::bigint as unidades
      from public.ventas_evento v
     where v.evento_id = p_evento_id
       and v.canal is distinct from 'web'
     group by v.producto_id
     order by unidades desc, v.producto_id
     limit greatest(coalesce(p_limite, 8), 0);
end;
$$;

-- ── Permisos ─────────────────────────────────────────────────────────────────
revoke all on function public.registrar_transaccion_pos(uuid, text, text, text, uuid, text, timestamptz, jsonb) from public;
revoke execute on function public.registrar_transaccion_pos(uuid, text, text, text, uuid, text, timestamptz, jsonb) from anon;
grant execute on function public.registrar_transaccion_pos(uuid, text, text, text, uuid, text, timestamptz, jsonb) to authenticated, service_role;

revoke all on function public.mas_vendidos_evento(text, int) from public;
revoke execute on function public.mas_vendidos_evento(text, int) from anon;
grant execute on function public.mas_vendidos_evento(text, int) to authenticated, service_role;

-- ── Realtime: todos los POS y el admin ven las ventas en vivo ────────────────
-- Realtime aplica las políticas RLS de ventas_evento (017_seguridad_hardening):
-- solo admin y operadores POS reciben filas.
do $$
declare
  t text;
begin
  foreach t in array array['ventas_evento'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;
