-- supabase/migrations/009_site_settings.sql
-- Key/value store for site-wide config (e.g. GA4 measurement ID) that the
-- public site needs to read before login, and only the admin can write.

CREATE TABLE site_settings (
  key        text        PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante puede leer la config (necesario para inyectar gtag.js
-- antes de que exista sesión).
CREATE POLICY "site_settings_select_public" ON site_settings
  FOR SELECT USING (true);

-- Solo el usuario autenticado del estudio puede escribir.
CREATE POLICY "site_settings_upsert_admin" ON site_settings
  FOR INSERT WITH CHECK (auth.email() = 'designcuac@gmail.com');

CREATE POLICY "site_settings_update_admin" ON site_settings
  FOR UPDATE USING (auth.email() = 'designcuac@gmail.com');
