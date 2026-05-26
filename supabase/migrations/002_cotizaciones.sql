-- supabase/migrations/002_cotizaciones.sql

CREATE TABLE cotizaciones (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  nombre             text        NOT NULL,
  email              text        NOT NULL,
  empresa            text        NOT NULL,
  telefono           text,
  servicios          text[]      NOT NULL,
  descripcion        text        NOT NULL,
  presupuesto        text,
  timeline           text,
  estimador_servicio text,
  estimador_escala   text,
  estimador_rango    text,
  estado             text        NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'respondida', 'descartada'))
);

CREATE INDEX idx_cotizaciones_estado     ON cotizaciones(estado);
CREATE INDEX idx_cotizaciones_created_at ON cotizaciones(created_at DESC);

ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante puede insertar (formulario público)
CREATE POLICY "cotizaciones_insert_anon" ON cotizaciones
  FOR INSERT TO anon WITH CHECK (true);

-- Solo el usuario autenticado del estudio puede leer y actualizar
CREATE POLICY "cotizaciones_select_admin" ON cotizaciones
  FOR SELECT USING (auth.email() = 'designcuac@gmail.com');

CREATE POLICY "cotizaciones_update_admin" ON cotizaciones
  FOR UPDATE USING (auth.email() = 'designcuac@gmail.com');
