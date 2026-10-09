-- 019_registrar_ajuste.sql
-- Ajuste manual de stock desde el admin.
--
-- La tabla producto_movimientos ya admite tipo = 'ajuste' desde 010, pero no
-- existía forma de escribirlo: registrar_restock sólo suma y valida cantidad>0,
-- así que una merma, un conteo físico o una corrección no tenían salida.
--
-- registrar_ajuste fija el stock a un valor absoluto (lo que el admin cuenta en
-- la mesa) y deja en el historial el delta con signo, que es lo que el drawer ya
-- sabe pintar. Mismo patrón que registrar_restock: plpgsql, SECURITY INVOKER
-- (la RLS de productos_evento y producto_movimientos hace de portero),
-- search_path fijo y execute revocado al público.

begin;

create or replace function public.registrar_ajuste(
  p_producto_id uuid,
  p_nuevo_stock integer,
  p_nota        text default null
) returns void language plpgsql security invoker as $$
declare
  v_actual integer;
  v_delta  integer;
begin
  if p_nuevo_stock < 0 then
    raise exception 'El stock no puede ser negativo';
  end if;

  -- for update: dos ajustes simultáneos no pueden calcular el delta sobre la
  -- misma lectura y perder uno de los dos movimientos del historial.
  select stock_actual into v_actual
  from public.productos_evento
  where id = p_producto_id
  for update;

  if not found then
    raise exception 'Producto no encontrado';
  end if;

  v_delta := p_nuevo_stock - v_actual;

  -- Un ajuste que no cambia nada no ensucia el historial.
  if v_delta = 0 then
    return;
  end if;

  update public.productos_evento
  set stock_actual = p_nuevo_stock
  where id = p_producto_id;

  insert into public.producto_movimientos (producto_id, tipo, cantidad, nota)
  values (p_producto_id, 'ajuste', v_delta, p_nota);
end;
$$;

alter function public.registrar_ajuste(uuid, integer, text) set search_path = public;
revoke all    on function public.registrar_ajuste(uuid, integer, text) from public;
revoke execute on function public.registrar_ajuste(uuid, integer, text) from anon;
grant  execute on function public.registrar_ajuste(uuid, integer, text) to authenticated, service_role;

commit;
