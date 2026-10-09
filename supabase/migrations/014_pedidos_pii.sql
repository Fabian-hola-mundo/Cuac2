-- 014_pedidos_pii.sql
-- pedidos y pedido_items tenían SELECT para anon con USING (true): con la anon
-- key se podía volcar la tabla completa (nombre, email, celular, tipo/num de
-- documento, dirección) de todos los clientes.
--
-- La única lectura legítima desde el cliente es la página de confirmación, que
-- busca UN pedido por su referencia. Eso se resuelve con un RPC que devuelve
-- sólo los campos que esa página muestra, y se quita el SELECT anónimo directo.

begin;

create or replace function public.obtener_pedido(p_referencia text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',          p.id,
    'referencia',  p.referencia,
    'estado',      p.estado,
    'nombre',      p.nombre,
    'apellido',    p.apellido,
    'email',       p.email,
    'ciudad',      p.ciudad,
    'direccion',   p.direccion,
    'barrio',      p.barrio,
    'subtotal',    p.subtotal,
    'total',       p.total,
    'creado_en',   p.creado_en,
    'pedido_items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nombre',   i.nombre,
               'sub',      i.sub,
               'precio',   i.precio,
               'cantidad', i.cantidad,
               'color',    i.color))
      from public.pedido_items i
      where i.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from public.pedidos p
  where p.referencia = p_referencia;
$$;

revoke all on function public.obtener_pedido(text) from public;
grant execute on function public.obtener_pedido(text) to anon, authenticated;

-- Fuera el volcado anónimo
drop policy if exists "anon puede leer pedidos"      on public.pedidos;
drop policy if exists "anon puede leer pedido_items" on public.pedido_items;

create policy pedidos_admin_all on public.pedidos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy pedido_items_admin_all on public.pedido_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

commit;
