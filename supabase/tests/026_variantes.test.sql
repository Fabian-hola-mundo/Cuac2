-- supabase/tests/026_variantes.test.sql
-- Se ejecuta con: node scripts/supabase-sql.mjs supabase/tests/026_variantes.test.sql --test supabase/migrations/026_variantes.sql
-- Todo corre dentro de begin … rollback: no deja datos.

-- Actuar como admin: is_admin() lee el email y el aal del JWT.
select set_config('request.jwt.claims',
  json_build_object('email', (select email from public.admin_users limit 1), 'aal', 'aal2', 'role', 'authenticated')::text, true);

do $$
declare
  v_p uuid;
  v_m uuid;
  v_r jsonb;
  v_stock int;
begin
  insert into public.productos_evento (nombre, categoria, precio, stock_inicial, stock_actual, activo, evento_id)
  values ('TEST camiseta', 'tee', 50000, 0, 0, true, 'Venta-regular')
  returning id into v_p;

  -- Crear 2 tallas × 2 colores
  v_r := public.guardar_variantes(v_p,
    '[{"nombre":"Talla","valores":[{"valor":"S","foto_url":null},{"valor":"M","foto_url":null}]},
      {"nombre":"Color","valores":[{"valor":"Negro","foto_url":null},{"valor":"Rosa","foto_url":"https://x/rosa.jpg"}]}]',
    '[{"opciones":{"Talla":"S","Color":"Negro"},"precio":null,"stock_inicial":3,"activo":true},
      {"opciones":{"Talla":"S","Color":"Rosa"},"precio":null,"stock_inicial":0,"activo":true},
      {"opciones":{"Talla":"M","Color":"Negro"},"precio":55000,"stock_inicial":4,"activo":true},
      {"opciones":{"Talla":"M","Color":"Rosa"},"precio":null,"stock_inicial":2,"activo":false}]');
  assert (v_r->>'creadas')::int = 4, 'debe crear 4 variantes: ' || v_r;
  assert (select count(*) from public.producto_opciones where producto_id = v_p) = 2, '2 opciones';

  -- Trigger de suma: sólo activas (3 + 0 + 4) = 7
  select stock_actual into v_stock from public.productos_evento where id = v_p;
  assert v_stock = 7, 'stock total debe ser 7, es ' || v_stock;

  -- Movimientos de creación por variante con stock > 0 (3, 4, 2)
  assert (select count(*) from public.producto_movimientos
          where producto_id = v_p and tipo = 'creacion' and variante_id is not null) = 3,
    'movimientos de creación por variante';

  select id into v_m from public.producto_variantes
  where producto_id = v_p and opciones = '{"Talla":"M","Color":"Negro"}';

  -- Restock y ajuste por variante
  perform public.registrar_restock(v_p, 2, 'test', v_m);
  assert (select stock_actual from public.producto_variantes where id = v_m) = 6, 'restock variante';
  perform public.registrar_ajuste(v_p, 1, 'conteo', v_m);
  assert (select stock_actual from public.producto_variantes where id = v_m) = 1, 'ajuste variante';
  assert (select stock_actual from public.productos_evento where id = v_p) = 4, 'suma tras ajuste (3+0+1)';
  assert (select count(*) from public.producto_movimientos where variante_id = v_m and tipo = 'ajuste' and cantidad = -5) = 1,
    'ajuste registra delta -5';

  -- Ajuste a nivel producto con variantes activas se rechaza
  begin
    perform public.registrar_ajuste(v_p, 10, null, null);
    assert false, 'ajuste sin variante debió fallar';
  exception when others then
    assert sqlerrm like '%variantes%', 'mensaje de ajuste sin variante: ' || sqlerrm;
  end;

  -- Restock sin variante en producto con variantes activas se rechaza
  begin
    perform public.registrar_restock(v_p, 1);
    assert false, 'restock sin variante debió fallar';
  exception when others then
    assert sqlerrm like '%variantes%', 'mensaje de restock sin variante: ' || sqlerrm;
  end;

  -- Decremento por variante
  perform public.decrementar_stock_seguro(v_p, 1, v_m);
  assert (select stock_actual from public.producto_variantes where id = v_m) = 0, 'decremento variante';

  -- Variante de otro producto se rechaza
  begin
    perform public.decrementar_stock_seguro(gen_random_uuid(), 1, v_m);
    assert false, 'variante ajena debió fallar';
  exception when others then
    assert sqlerrm like '%no pertenece%', sqlerrm;
  end;

  -- Re-guardar quitando el color Rosa: conserva ids/stock de Negro, desactiva Rosa
  v_r := public.guardar_variantes(v_p,
    '[{"nombre":"Talla","valores":[{"valor":"S","foto_url":null},{"valor":"M","foto_url":null}]},
      {"nombre":"Color","valores":[{"valor":"Negro","foto_url":null}]}]',
    '[{"opciones":{"Talla":"S","Color":"Negro"},"precio":null,"stock_inicial":99,"activo":true},
      {"opciones":{"Talla":"M","Color":"Negro"},"precio":60000,"stock_inicial":99,"activo":true}]');
  assert (v_r->>'actualizadas')::int = 2 and (v_r->>'desactivadas')::int = 1, 'reguardado: ' || v_r;
  assert (select stock_actual from public.producto_variantes where producto_id = v_p and opciones = '{"Talla":"S","Color":"Negro"}') = 3,
    'stock_inicial se ignora al actualizar';
  assert (select precio from public.producto_variantes where id = v_m) = 60000, 'precio actualizado';

  -- Apagar variantes: todas inactivas, opciones borradas, stock 0
  v_r := public.guardar_variantes(v_p, '[]', '[]');
  assert (select count(*) from public.producto_variantes where producto_id = v_p and activo) = 0, 'todas inactivas';
  assert (select count(*) from public.producto_opciones where producto_id = v_p) = 0, 'opciones borradas';
  assert (select stock_actual from public.productos_evento where id = v_p) = 0, 'stock 0 sin variantes activas';

  -- Máximo 3 opciones
  begin
    perform public.guardar_variantes(v_p,
      '[{"nombre":"A","valores":[]},{"nombre":"B","valores":[]},{"nombre":"C","valores":[]},{"nombre":"D","valores":[]}]', '[]');
    assert false, 'cuarta opción debió fallar';
  exception when others then
    assert sqlerrm like '%3 opciones%', sqlerrm;
  end;

  -- Producto simple: funciones sin variante se comportan como antes
  insert into public.productos_evento (nombre, categoria, precio, stock_inicial, stock_actual, activo, evento_id)
  values ('TEST pin', 'pin', 8000, 5, 5, true, 'Venta-regular') returning id into v_p;
  perform public.decrementar_stock_seguro(v_p, 2);
  perform public.registrar_restock(v_p, 1);
  perform public.registrar_ajuste(v_p, 10);
  assert (select stock_actual from public.productos_evento where id = v_p) = 10, 'producto simple';

  raise notice 'OK 026';
end $$;
