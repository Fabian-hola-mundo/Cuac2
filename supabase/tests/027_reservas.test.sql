-- supabase/tests/027_reservas.test.sql
-- node scripts/supabase-sql.mjs supabase/tests/027_reservas.test.sql --test supabase/migrations/026_variantes.sql supabase/migrations/027_reservas_stock.sql

select set_config('request.jwt.claims', json_build_object('email', (select email from public.admin_users limit 1), 'aal', 'aal2', 'role', 'authenticated')::text, true);

create or replace function pg_temp.pedido_test(p_ref text) returns uuid language sql as $$
  insert into public.pedidos (referencia, estado, nombre, apellido, email, celular, tipo_doc, num_doc,
                              departamento, ciudad, direccion, subtotal, total)
  values (p_ref, 'pendiente', 'T', 'T', 't@t.co', '3000000000', 'CC', '1', 'X', 'X', 'X', 1, 1)
  returning id;
$$;

do $$
declare
  v_p uuid; v_simple uuid; v_var uuid;
  v_ped1 uuid; v_ped2 uuid; v_ped3 uuid;
  v_disp int; v_tok text; v_ok boolean;
begin
  insert into public.productos_evento (nombre, categoria, precio, stock_inicial, stock_actual, activo, evento_id)
  values ('TEST gorra', 'gorra', 40000, 0, 0, true, 'Venta-regular') returning id into v_p;
  perform public.guardar_variantes(v_p,
    '[{"nombre":"Color","valores":[{"valor":"Negro","foto_url":null}]}]',
    '[{"opciones":{"Color":"Negro"},"precio":null,"stock_inicial":1,"activo":true}]');
  select id into v_var from public.producto_variantes where producto_id = v_p;

  insert into public.productos_evento (nombre, categoria, precio, stock_inicial, stock_actual, activo, evento_id)
  values ('TEST sticker', 'sticker', 5000, 2, 2, true, 'Venta-regular') returning id into v_simple;

  -- Pedido 1 reserva la última gorra negra y 2 stickers
  v_ped1 := pg_temp.pedido_test('TEST-1');
  insert into public.pedido_items (pedido_id, producto_id, variante_id, variante_label, nombre, sub, precio, cantidad)
  values (v_ped1, v_p, v_var, 'Negro', 'TEST gorra', '', 40000, 1),
         (v_ped1, v_simple, null, null, 'TEST sticker', '', 5000, 2);
  perform public.reservar_stock_pedido(v_ped1);
  assert (select reserva_expira_en from public.pedidos where id = v_ped1) > now() + interval '14 minutes', 'expira ~15 min';

  select disponible into v_disp from public.stock_disponible(array[v_p]) where variante_id = v_var;
  assert v_disp = 0, 'variante reservada → 0 disponible';
  select disponible into v_disp from public.stock_disponible(array[v_p]) where variante_id is null;
  assert v_disp = 0, 'total del producto con variantes → 0';
  select disponible into v_disp from public.stock_disponible(array[v_simple]) where variante_id is null;
  assert v_disp = 0, 'simple reservado → 0';
  assert (select stock_actual from public.producto_variantes where id = v_var) = 1, 'físico intacto';

  -- Pedido 2 intenta la misma gorra: falla con P0409
  v_ped2 := pg_temp.pedido_test('TEST-2');
  insert into public.pedido_items (pedido_id, producto_id, variante_id, nombre, sub, precio, cantidad)
  values (v_ped2, v_p, v_var, 'TEST gorra', '', 40000, 1);
  begin
    perform public.reservar_stock_pedido(v_ped2);
    assert false, 'segunda reserva debió fallar';
  exception when sqlstate 'P0409' then
    assert (sqlerrm = 'sin_stock'), sqlerrm;
  end;

  -- Reserva vencida deja de contar
  update public.stock_reservas set expira_en = now() - interval '1 second' where pedido_id = v_ped1;
  select disponible into v_disp from public.stock_disponible(array[v_p]) where variante_id = v_var;
  assert v_disp = 1, 'vencida no cuenta';
  perform public.reservar_stock_pedido(v_ped2);   -- ahora sí
  assert (select count(*) from public.stock_reservas where pedido_id = v_ped1) = 0, 'limpieza oportunista';

  -- Cancelar y liberar (sólo pendientes)
  select confirmacion_token::text into v_tok from public.pedidos where id = v_ped2;
  v_ok := public.cancelar_pedido_pendiente(v_tok);
  assert v_ok, 'cancela pendiente';
  assert (select estado from public.pedidos where id = v_ped2) = 'cancelado', 'estado cancelado';
  assert (select cancelado_por_cliente from public.pedidos where id = v_ped2), 'marcado por cliente';
  assert (select count(*) from public.stock_reservas where pedido_id = v_ped2) = 0, 'liberado';
  assert not public.cancelar_pedido_pendiente(v_tok), 'segunda cancelación no hace nada';

  -- Pagó igual tras cancelar: la venta se registra y descuenta
  update public.pedidos set estado = 'aprobado' where id = v_ped2;
  assert public.registrar_venta_web('TEST-2') = 1, 'una línea';
  assert (select stock_actual from public.producto_variantes where id = v_var) = 0, 'descontado';
  assert (select stock_actual from public.productos_evento where id = v_p) = 0, 'suma 0';
  assert (select variante_id from public.ventas_evento where dispositivo = 'web:TEST-2') = v_var, 'venta con variante';
  assert not (select sobreventa from public.pedidos where id = v_ped2), 'sin sobreventa';
  assert public.registrar_venta_web('TEST-2') = 0, 'idempotente';

  -- Pedido 1 (reserva vencida) se aprueba tarde: sobreventa
  update public.pedidos set estado = 'aprobado' where id = v_ped1;
  perform public.registrar_venta_web('TEST-1');
  assert (select sobreventa from public.pedidos where id = v_ped1), 'sobreventa marcada';
  assert (select stock_actual from public.producto_variantes where id = v_var) = 0, 'nunca negativo';
  assert (select stock_actual from public.productos_evento where id = v_simple) = 0, 'stickers descontados';

  -- liberar_reservas_pedido por referencia
  v_ped3 := pg_temp.pedido_test('TEST-3');
  perform public.registrar_restock(v_simple, 3);
  insert into public.pedido_items (pedido_id, producto_id, nombre, sub, precio, cantidad)
  values (v_ped3, v_simple, 'TEST sticker', '', 5000, 1);
  perform public.reservar_stock_pedido(v_ped3);
  assert public.liberar_reservas_pedido('TEST-3') = 1, 'libera por referencia';

  -- obtener_pedido trae la etiqueta y el vencimiento
  select confirmacion_token::text into v_tok from public.pedidos where id = v_ped1;
  assert exists (select 1 from jsonb_array_elements(public.obtener_pedido(v_tok)->'pedido_items') e where e->>'variante_label' = 'Negro'), 'label en obtener_pedido';
  assert (public.obtener_pedido(v_tok) ? 'reserva_expira_en'), 'reserva_expira_en';

  raise notice 'OK 027';
end $$;
