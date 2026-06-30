-- supabase/migrations/012_codigos_descuento.sql

CREATE TABLE codigos_descuento (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          text        UNIQUE NOT NULL,
  tipo            text        NOT NULL CHECK (tipo IN ('porcentaje', 'fijo')),
  valor           integer     NOT NULL CHECK (valor > 0),
  minimo_orden    integer     NOT NULL DEFAULT 0,
  limite_usos     integer,                        -- NULL = ilimitado
  usos_actuales   integer     NOT NULL DEFAULT 0,
  productos_ids   text[],                         -- NULL = todos
  categorias_ids  text[],                         -- NULL = todas
  activo          boolean     NOT NULL DEFAULT true,
  expira_en       timestamptz,                    -- NULL = no expira
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pedidos
  ADD COLUMN codigo_descuento text,
  ADD COLUMN descuento_monto  integer NOT NULL DEFAULT 0;

-- RLS: solo el admin puede leer/escribir códigos de descuento
ALTER TABLE codigos_descuento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solo_admin_descuentos" ON codigos_descuento
  FOR ALL USING (auth.email() = 'designcuac@gmail.com');

CREATE INDEX idx_codigos_descuento_codigo ON codigos_descuento(codigo);

-- Función atómica para incrementar usos — retorna 1 si tuvo éxito, 0 si no
CREATE OR REPLACE FUNCTION incrementar_uso_descuento(p_codigo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE codigos_descuento
  SET usos_actuales = usos_actuales + 1,
      actualizado_en = now()
  WHERE codigo = p_codigo
    AND activo = true
    AND (expira_en IS NULL OR expira_en > now())
    AND (limite_usos IS NULL OR usos_actuales < limite_usos);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;
