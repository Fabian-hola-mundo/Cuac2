-- Tabla de productos por evento
CREATE TABLE productos_evento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id     text NOT NULL,
  nombre        text NOT NULL,
  categoria     text,
  precio        integer,
  stock_inicial integer NOT NULL DEFAULT 0,
  stock_actual  integer NOT NULL DEFAULT 0,
  activo        boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Tabla de ventas registradas desde el POS
CREATE TABLE ventas_evento (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id  uuid NOT NULL REFERENCES productos_evento(id),
  cantidad     integer NOT NULL,
  dispositivo  text,
  vendido_en   timestamptz NOT NULL DEFAULT now(),
  sincronizado boolean NOT NULL DEFAULT true
);

-- Índices para queries frecuentes
CREATE INDEX idx_productos_evento_id ON productos_evento(evento_id);
CREATE INDEX idx_ventas_producto_id  ON ventas_evento(producto_id);
CREATE INDEX idx_ventas_vendido_en   ON ventas_evento(vendido_en);

-- Función atómica para decrementar stock (evita race conditions entre dispositivos)
CREATE OR REPLACE FUNCTION decrementar_stock_seguro(
  p_producto_id uuid,
  p_cantidad    integer
) RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
  UPDATE productos_evento
  SET stock_actual = GREATEST(0, stock_actual - p_cantidad)
  WHERE id = p_producto_id;
$$;

-- RLS
ALTER TABLE productos_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_evento    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solo_admin_productos" ON productos_evento
  FOR ALL USING (auth.email() = 'designcuac@gmail.com');

CREATE POLICY "solo_admin_ventas" ON ventas_evento
  FOR ALL USING (auth.email() = 'designcuac@gmail.com');

ALTER PUBLICATION supabase_realtime ADD TABLE productos_evento;
