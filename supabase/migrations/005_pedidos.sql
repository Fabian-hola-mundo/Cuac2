-- supabase/migrations/005_pedidos.sql

CREATE TABLE pedidos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia    text        UNIQUE NOT NULL,
  estado        text        NOT NULL DEFAULT 'pendiente' CONSTRAINT valid_estado CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'cancelado')),
  nombre        text        NOT NULL,
  apellido      text        NOT NULL,
  email         text        NOT NULL,
  celular       text        NOT NULL,
  tipo_doc      text        NOT NULL,
  num_doc       text        NOT NULL,
  departamento  text        NOT NULL,
  ciudad        text        NOT NULL,
  direccion     text        NOT NULL,
  barrio        text,
  codigo_postal text,
  nota          text,
  subtotal      integer     NOT NULL,
  total         integer     NOT NULL,
  wompi_transaction_id text,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pedido_items (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id  uuid    NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  nombre     text    NOT NULL,
  sub        text    NOT NULL,
  precio     integer NOT NULL,
  cantidad   integer NOT NULL DEFAULT 1,
  color      text,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE pedidos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;

-- La edge function usa service_role (bypassa RLS) para INSERT.
-- El cliente anon necesita SELECT para la pantalla de confirmación.
CREATE POLICY "anon puede leer pedidos"      ON pedidos      FOR SELECT TO anon USING (true);
CREATE POLICY "anon puede leer pedido_items" ON pedido_items FOR SELECT TO anon USING (true);

CREATE INDEX idx_pedido_items_pedido_id ON pedido_items(pedido_id);
