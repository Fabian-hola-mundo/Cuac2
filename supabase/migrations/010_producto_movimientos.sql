-- 010_producto_movimientos.sql
-- Historial de movimientos de stock por producto (creación, restock, ajuste manual).
-- Las ventas NO se duplican aquí: siguen viviendo solo en ventas_evento y se
-- combinan con esta tabla en el cliente (InventarioService.getHistorialProducto).

CREATE TABLE producto_movimientos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id  uuid NOT NULL REFERENCES productos_evento(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN ('creacion','restock','ajuste')),
  cantidad     integer NOT NULL,
  nota         text,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_producto_movimientos_producto ON producto_movimientos(producto_id, creado_en DESC);

-- Trigger: registra automáticamente el movimiento de creación al insertar un producto
CREATE OR REPLACE FUNCTION registrar_creacion_producto()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  INSERT INTO producto_movimientos (producto_id, tipo, cantidad)
  VALUES (NEW.id, 'creacion', NEW.stock_inicial);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_producto_creado
  AFTER INSERT ON productos_evento
  FOR EACH ROW
  EXECUTE FUNCTION registrar_creacion_producto();

-- RPC atómica: suma stock y registra el movimiento de restock en una sola llamada
CREATE OR REPLACE FUNCTION registrar_restock(
  p_producto_id uuid,
  p_cantidad    integer,
  p_nota        text DEFAULT NULL
) RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
  UPDATE productos_evento
  SET stock_actual = stock_actual + p_cantidad
  WHERE id = p_producto_id;

  INSERT INTO producto_movimientos (producto_id, tipo, cantidad, nota)
  VALUES (p_producto_id, 'restock', p_cantidad, p_nota);
$$;

-- RLS — mismo patrón que solo_admin_productos / solo_admin_ventas
ALTER TABLE producto_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solo_admin_movimientos" ON producto_movimientos
  FOR ALL USING (auth.email() = 'designcuac@gmail.com');
