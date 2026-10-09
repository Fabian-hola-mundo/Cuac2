-- 020_stock_web.sql
-- Las ventas web no tocaban el inventario: `crear-pedido` validaba precio y
-- `activo` pero nunca `stock_actual`, y `bold-webhook` sólo movía
-- `pedidos.estado`. Resultado: se podía vender un producto agotado tantas veces
-- como quisieran, y el stock del admin sólo era correcto para el POS.
--
-- Además `pedido_items` no guardaba `producto_id`, así que ni siquiera era
-- posible reconciliar el inventario después: había que cruzar por `nombre`,
-- que es texto libre y cambia al editar el producto.
--
-- Esta migración:
--   1. Ancla cada línea de pedido a su producto.
--   2. Marca en el pedido si ya se descontó el stock (idempotencia).
--   3. Guarda si el pedido iba con envío gratis, para que quien empaca lo sepa.
--   4. Añade `registrar_venta_web`, que descuenta stock y registra la venta en
--      `ventas_evento` (canal 'web') una sola vez por pedido aprobado.

begin;

-- ── 1. Línea de pedido → producto ────────────────────────────────────────────
alter table public.pedido_items
  add column if not exists producto_id uuid references public.productos_evento(id);

create index if not exists idx_pedido_items_producto_id
  on public.pedido_items(producto_id);

-- `sub` es NOT NULL y la edge function insertaba null cuando el cliente no lo
-- mandaba: el INSERT de items fallaba DESPUÉS del INSERT del pedido y dejaba un
-- pedido huérfano sin líneas. El default cierra el caso desde la base.
alter table public.pedido_items alter column sub set default '';

-- ── 2 y 3. Estado de inventario y de envío en el pedido ──────────────────────
alter table public.pedidos
  add column if not exists stock_descontado boolean not null default false;

alter table public.pedidos
  add column if not exists envio_gratis boolean not null default false;

-- Los pedidos que ya existían nunca descontaron stock, pero tampoco tienen
-- `producto_id` en sus líneas: marcarlos como descontados evitaría un ajuste
-- manual futuro que sí queremos poder hacer. Se quedan en false a propósito.

-- ── 4. Descuento de stock al aprobarse el pago ───────────────────────────────
-- SECURITY DEFINER porque la llama el webhook con service_role, que no debe
-- necesitar UPDATE directo sobre productos_evento. Idempotente por
-- `stock_descontado` y serializada por el FOR UPDATE sobre el pedido, así que
-- dos entregas del mismo evento de Bold no descuentan dos veces.
create or replace function public.registrar_venta_web(p_referencia text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_item   record;
  v_lineas integer := 0;
begin
  select * into v_pedido
  from public.pedidos
  where referencia = p_referencia
  for update;

  if not found then
    return 0;
  end if;

  -- Sólo los pedidos aprobados mueven inventario, y sólo una vez.
  if v_pedido.estado <> 'aprobado' or v_pedido.stock_descontado then
    return 0;
  end if;

  for v_item in
    select pi.producto_id, sum(pi.cantidad)::integer as cantidad
    from public.pedido_items pi
    where pi.pedido_id = v_pedido.id
      and pi.producto_id is not null
    group by pi.producto_id
  loop
    update public.productos_evento
       set stock_actual = greatest(0, stock_actual - v_item.cantidad)
     where id = v_item.producto_id;

    insert into public.ventas_evento (producto_id, cantidad, canal, evento_id, dispositivo)
    select v_item.producto_id,
           v_item.cantidad,
           'web',
           coalesce(pe.evento_id, 'Venta-regular'),
           'web:' || v_pedido.referencia
    from public.productos_evento pe
    where pe.id = v_item.producto_id;

    v_lineas := v_lineas + 1;
  end loop;

  update public.pedidos
     set stock_descontado = true
   where id = v_pedido.id;

  return v_lineas;
end;
$$;

revoke all on function public.registrar_venta_web(text) from public;
grant execute on function public.registrar_venta_web(text) to service_role;

-- ── La confirmación necesita saber si el envío iba gratis ────────────────────
-- Antes la pantalla de confirmación repetía el umbral hardcodeado (`>= 150000`)
-- y lo recalculaba en el cliente. Ahora lo dice el pedido.
create or replace function public.obtener_pedido(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'referencia', p.referencia, 'estado', p.estado,
    'nombre', p.nombre, 'apellido', p.apellido, 'email', p.email,
    'ciudad', p.ciudad, 'direccion', p.direccion, 'barrio', p.barrio,
    'subtotal', p.subtotal, 'total', p.total, 'creado_en', p.creado_en,
    'envio_gratis', p.envio_gratis,
    'pedido_items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nombre', i.nombre, 'sub', i.sub, 'precio', i.precio,
               'cantidad', i.cantidad, 'color', i.color))
      from public.pedido_items i where i.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from public.pedidos p
  where p.confirmacion_token::text = p_token;
$$;

revoke all on function public.obtener_pedido(text) from public;
grant execute on function public.obtener_pedido(text) to anon, authenticated;

commit;
