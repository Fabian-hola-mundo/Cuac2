-- supabase/migrations/028_reservas_ajustes.sql
-- Ajustes a 027 tras revisión:
--  1. Las funciones sólo de service_role también se revocan a authenticated
--     (los default privileges de Supabase lo otorgan) y reservar_stock_pedido
--     valida su entrada.
--  2. Una reserva sigue vigente mientras su pedido está aprobado y aún no se
--     descontó el stock, para no abrir una ventana de sobreventa.
--  3. La limpieza de reservas vencidas corre después de bloquear los productos,
--     sólo sobre ellos y con skip locked, para evitar deadlocks.

begin;

create or replace function public.reservas_vigentes()
returns table (producto_id uuid, variante_id uuid, cantidad integer)
language sql stable security definer set search_path = public as $$
  select r.producto_id, r.variante_id, sum(r.cantidad)::integer
  from public.stock_reservas r
  join public.pedidos pe on pe.id = r.pedido_id
  where (pe.estado = 'pendiente' and r.expira_en > now())
     or (pe.estado = 'aprobado' and not pe.stock_descontado)
  group by r.producto_id, r.variante_id;
$$;

create or replace function public.reservar_stock_pedido(
  p_pedido_id uuid,
  p_minutos   integer default 15
) returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_expira timestamptz;
  v_estado text;
  v_ids    uuid[];
  v_item   record;
  v_fisico integer;
  v_resv   integer;
begin
  if p_minutos is null or p_minutos < 1 or p_minutos > 60 then
    raise exception 'Minutos de reserva fuera de rango (1 a 60)';
  end if;
  v_expira := now() + make_interval(mins => p_minutos);

  select estado into v_estado from public.pedidos where id = p_pedido_id;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_estado <> 'pendiente' then raise exception 'Sólo se reserva stock de pedidos pendientes'; end if;
  if exists (select 1 from public.stock_reservas where pedido_id = p_pedido_id) then
    raise exception 'El pedido ya tiene reservas';
  end if;

  select coalesce(array_agg(id order by id), '{}') into v_ids from (
    select id from public.productos_evento
     where id in (select producto_id from public.pedido_items where pedido_id = p_pedido_id)
     order by id for update
  ) l;

  -- Limpieza oportunista de reservas no vigentes de estos productos.
  delete from public.stock_reservas
   where id in (
     select r.id from public.stock_reservas r
     join public.pedidos pe on pe.id = r.pedido_id
     where r.producto_id = any(v_ids)
       and not ((pe.estado = 'pendiente' and r.expira_en > now())
             or (pe.estado = 'aprobado' and not pe.stock_descontado))
     for update of r skip locked);

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

revoke execute on function public.reservas_vigentes() from authenticated;
revoke execute on function public.reservar_stock_pedido(uuid, integer) from authenticated;
revoke execute on function public.liberar_reservas_pedido(text) from authenticated;
revoke execute on function public.registrar_venta_web(text) from authenticated;

commit;
