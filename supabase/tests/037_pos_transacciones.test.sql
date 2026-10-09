-- supabase/tests/037_pos_transacciones.test.sql
-- Se ejecuta con: node scripts/supabase-sql.mjs supabase/tests/037_pos_transacciones.test.sql --test supabase/migrations/037_pos_transacciones.sql
-- Todo corre dentro de begin … rollback: no deja datos.

-- Actuar como admin: is_admin() lee el email y el aal del JWT.
select set_config('request.jwt.claims',
  json_build_object('email', (select email from public.admin_users limit 1), 'aal', 'aal2', 'role', 'authenticated')::text, true);

do $$
declare
  v_pin uuid;
  v_cam uuid;
  v_m   uuid;
  v_t   uuid := gen_random_uuid();
  v_t2  uuid := gen_random_uuid();
  v_t3  uuid := gen_random_uuid();
  v_lineas jsonb;
  v_r   text;
  v_ok  boolean;
  v_row record;
begin
  insert into public.productos_evento (nombre, categoria, precio, stock_inicial, stock_actual, activo, evento_id)
  values ('TEST pin', 'pin', 8000, 5, 5, true, 'TEST-evento')
  returning id into v_pin;

  insert into public.productos_evento (nombre, categoria, precio, stock_inicial, stock_actual, activo, evento_id)
  values ('TEST camiseta', 'tee', 45000, 0, 0, true, 'TEST-evento')
  returning id into v_cam;

  perform public.guardar_variantes(v_cam,
    '[{"nombre":"Talla","valores":[{"valor":"M","foto_url":null},{"valor":"L","foto_url":null}]}]',
    '[{"opciones":{"Talla":"M"},"precio":null,"stock_inicial":3,"activo":true},
      {"opciones":{"Talla":"L"},"precio":null,"stock_inicial":1,"activo":true}]');
  select id into v_m from public.producto_variantes where producto_id = v_cam and opciones = '{"Talla":"M"}';

  v_lineas := jsonb_build_array(
    jsonb_build_object('producto_id', v_pin, 'variante_id', null, 'cantidad', 2, 'precio_unitario', 8000),
    jsonb_build_object('producto_id', v_cam, 'variante_id', v_m,  'cantidad', 1, 'precio_unitario', 45000));

  -- registrada: 2 líneas, stock descontado
  v_r := public.registrar_transaccion_pos(v_t, 'efectivo', 'TEST-evento', 'Caja test', null, 'Regalo', now(), v_lineas);
  assert v_r = 'registrada', 'debía ser registrada: ' || v_r;
  assert (select count(*) from public.ventas_evento where transaccion_id = v_t) = 2, '2 líneas';
  assert (select stock_actual from public.productos_evento where id = v_pin) = 3, 'stock pin 3';
  assert (select stock_actual from public.producto_variantes where id = v_m) = 2, 'stock variante 2';
  assert (select bool_and(metodo_pago = 'efectivo' and comentario = 'Regalo' and canal is null and sincronizado)
            from public.ventas_evento where transaccion_id = v_t), 'campos de la venta';
  assert (select precio_unitario from public.ventas_evento where transaccion_id = v_t and producto_id = v_pin) = 8000, 'precio';

  -- duplicada: nada cambia
  assert public.registrar_transaccion_pos(v_t, 'efectivo', 'TEST-evento', 'Caja test', null, null, now(), v_lineas) = 'duplicada', 'duplicada';
  assert (select count(*) from public.ventas_evento where transaccion_id = v_t) = 2, 'sigue en 2';
  assert (select stock_actual from public.productos_evento where id = v_pin) = 3, 'stock intacto';

  -- stock insuficiente no rechaza: queda en 0
  v_r := public.registrar_transaccion_pos(gen_random_uuid(), 'qr', 'TEST-evento', 'Caja test', null, null, now(),
    jsonb_build_array(jsonb_build_object('producto_id', v_pin, 'variante_id', null, 'cantidad', 10, 'precio_unitario', 8000)));
  assert v_r = 'registrada', 'stock insuficiente registra';
  assert (select stock_actual from public.productos_evento where id = v_pin) = 0, 'stock en 0';

  -- atómica: segunda línea inválida → excepción y no queda la primera
  v_ok := false;
  begin
    perform public.registrar_transaccion_pos(v_t2, 'qr', 'TEST-evento', 'Caja test', null, null, now(),
      jsonb_build_array(jsonb_build_object('producto_id', v_pin, 'variante_id', null, 'cantidad', 1, 'precio_unitario', 8000),
                        jsonb_build_object('producto_id', v_pin, 'variante_id', null, 'cantidad', 0, 'precio_unitario', 8000)));
  exception when others then
    v_ok := true;
    assert sqlstate = 'P0001', 'sqlstate ' || sqlstate;
  end;
  assert v_ok, 'línea inválida debía fallar';
  assert (select count(*) from public.ventas_evento where transaccion_id = v_t2) = 0, 'atómica';

  -- variante ajena (variante de otro producto)
  v_ok := false;
  begin
    perform public.registrar_transaccion_pos(gen_random_uuid(), 'qr', 'TEST-evento', 'Caja test', null, null, now(),
      jsonb_build_array(jsonb_build_object('producto_id', v_pin, 'variante_id', v_m, 'cantidad', 1, 'precio_unitario', 8000)));
  exception when others then v_ok := true; end;
  assert v_ok, 'variante ajena debía fallar';

  -- medio de pago inválido
  v_ok := false;
  begin
    perform public.registrar_transaccion_pos(gen_random_uuid(), 'nequi', 'TEST-evento', 'Caja test', null, null, now(), v_lineas);
  exception when others then v_ok := true; end;
  assert v_ok, 'nequi debía fallar';

  -- líneas vacías
  v_ok := false;
  begin
    perform public.registrar_transaccion_pos(gen_random_uuid(), 'qr', 'TEST-evento', 'Caja test', null, null, now(), '[]'::jsonb);
  exception when others then v_ok := true; end;
  assert v_ok, 'líneas vacías debía fallar';

  -- comentario de 281 caracteres
  v_ok := false;
  begin
    perform public.registrar_transaccion_pos(gen_random_uuid(), 'qr', 'TEST-evento', 'Caja test', null, repeat('x', 281), now(), v_lineas);
  exception when others then v_ok := true; end;
  assert v_ok, 'comentario largo debía fallar';

  -- metodo_pago null (cola vieja migrada)
  v_r := public.registrar_transaccion_pos(v_t3, null, 'TEST-evento', 'Caja test', null, null, now(),
    jsonb_build_array(jsonb_build_object('producto_id', v_cam, 'variante_id', v_m, 'cantidad', 1, 'precio_unitario', null)));
  assert v_r = 'registrada', 'metodo null registra';
  assert (select metodo_pago is null and precio_unitario is null from public.ventas_evento where transaccion_id = v_t3), 'null guardado';

  -- mas_vendidos_evento: orden, límite, excluye web
  insert into public.ventas_evento (producto_id, cantidad, dispositivo, evento_id, canal)
  values (v_cam, 99, 'web', 'TEST-evento', 'web');
  -- unidades POS en TEST-evento: pin 2+10 = 12; camiseta 1+1 = 2
  select * into v_row from public.mas_vendidos_evento('TEST-evento', 8) limit 1;
  assert v_row.producto_id = v_pin and v_row.unidades = 12, 'primero pin con 12: ' || coalesce(v_row.unidades::text, 'null');
  assert (select unidades from public.mas_vendidos_evento('TEST-evento', 8) where producto_id = v_cam) = 2, 'web excluida';
  assert (select count(*) from public.mas_vendidos_evento('TEST-evento', 1)) = 1, 'límite';

  -- 'Venta-regular' funciona igual que un evento con id
  v_r := public.registrar_transaccion_pos(gen_random_uuid(), 'datafono', 'Venta-regular', 'Caja test', null, null, now(),
    jsonb_build_array(jsonb_build_object('producto_id', v_cam, 'variante_id', v_m, 'cantidad', 1, 'precio_unitario', 45000)));
  assert v_r = 'registrada', 'Venta-regular';
  assert exists (select 1 from public.ventas_evento where evento_id = 'Venta-regular' and metodo_pago = 'datafono' and producto_id = v_cam), 'fila Venta-regular';

  -- ventas_evento en la publicación realtime
  assert exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ventas_evento'), 'realtime';
end $$;

-- Anónimo: no autorizado
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);

do $$
begin
  begin
    perform public.registrar_transaccion_pos(gen_random_uuid(), 'qr', 'TEST-evento', 'x', null, null, now(), '[]'::jsonb);
    assert false, 'anon registrar debía fallar';
  exception when others then
    assert sqlerrm = 'No autorizado', 'registrar anon: ' || sqlerrm;
  end;
  begin
    perform * from public.mas_vendidos_evento('TEST-evento', 8);
    assert false, 'anon mas_vendidos debía fallar';
  exception when others then
    assert sqlerrm = 'No autorizado', 'mas_vendidos anon: ' || sqlerrm;
  end;
end $$;
