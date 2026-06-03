-- supabase/migrations/006_destacado.sql
ALTER TABLE productos_evento
  ADD COLUMN IF NOT EXISTS destacado boolean NOT NULL DEFAULT false;
