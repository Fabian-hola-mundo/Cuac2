-- 011_registrar_restock_validacion.sql
-- Agrega validación server-side de p_cantidad > 0 a registrar_restock.
-- La función original (010_producto_movimientos.sql) era LANGUAGE sql y no
-- podía expresar la validación condicional; se reemplaza por plpgsql
-- manteniendo SECURITY INVOKER (convención del proyecto, ver
-- decrementar_stock_seguro en 001_inventario.sql).

CREATE OR REPLACE FUNCTION registrar_restock(
  p_producto_id uuid,
  p_cantidad    integer,
  p_nota        text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
  END IF;

  UPDATE productos_evento
  SET stock_actual = stock_actual + p_cantidad
  WHERE id = p_producto_id;

  INSERT INTO producto_movimientos (producto_id, tipo, cantidad, nota)
  VALUES (p_producto_id, 'restock', p_cantidad, p_nota);
END;
$$;
