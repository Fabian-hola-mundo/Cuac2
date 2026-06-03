CREATE TABLE IF NOT EXISTS personajes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text        UNIQUE NOT NULL,
  nombre       text        NOT NULL,
  sort_order   integer     NOT NULL DEFAULT 0,
  region       text,
  color        text,
  wire_color   text,
  slogan       text,
  bio          text,
  musica       text,
  personalidad text,
  fauna_flora  text,
  cover_url    text,
  galeria_urls text[]      NOT NULL DEFAULT '{}',
  activo       boolean     NOT NULL DEFAULT true,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO personajes (key, nombre, sort_order, color, wire_color) VALUES
  ('cuac',       'Cuac',       1, '#2A6FDB', '#5C95EA'),
  ('kiki',       'Kiki',       2, '#FF6FA8', '#FFB1CF'),
  ('roar',       'Roar',       3, '#3D4856', '#7A8694'),
  ('yeison',     'Yeison',     4, '#E8A434', '#FFD27A'),
  ('abejandro',  'Abejandro',  5, '#E8623D', '#F5957C'),
  ('atolita',    'Atolita',    6, '#8B6FD8', '#B9A4F0'),
  ('colibriana', 'Colibriana', 7, '#1F8A5B', '#5BB890'),
  ('tiburcio',   'Tiburcio',   8, '#2E8FB8', '#7DC1DC')
ON CONFLICT (key) DO NOTHING;
