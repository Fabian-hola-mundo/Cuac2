-- supabase/tests/038_pos_canal_evento.test.sql
-- Se ejecuta con: node scripts/supabase-sql.mjs supabase/tests/038_pos_canal_evento.test.sql --test supabase/migrations/038_pos_canal_evento.sql
-- Todo corre dentro de begin … rollback: no deja datos.

select set_config('request.jwt.claims',
  json_build_object('email', (select email from public.admin_users limit 1), 'aal', 'aal2', 'role', 'authenticated')::text, true);

do $$
declare
  v_p uuid;
  v_t uuid := gen_random_uuid();
begin
  insert into public.productos_evento (nombre, categoria, precio, stock_inicial, stock_actual, activo, evento_id)
  values ('TEST canal', 'pin', 8000, 5, 5, true, 'TEST-evento')
  returning id into v_p;

  assert public.registrar_transaccion_pos(v_t, 'qr', 'TEST-evento', 'Caja test', null, null, now(),
    jsonb_build_array(jsonb_build_object('producto_id', v_p, 'variante_id', null, 'cantidad', 1, 'precio_unitario', 8000))) = 'registrada', 'registrada';
  assert (select bool_and(canal = 'evento') from public.ventas_evento where transaccion_id = v_t), 'canal evento';
  assert (select count(*) from public.ventas_evento where transaccion_id = v_t) = 1, 'una línea';
  -- sigue contando en más vendidos
  assert (select unidades from public.mas_vendidos_evento('TEST-evento', 8) where producto_id = v_p) = 1, 'más vendidos';
end $$;
