-- supabase/migrations/022_ruleta_regirar.sql
-- Separa dos cosas que hasta ahora no se podían configurar por separado:
--   · permitir_repetir  → si el MISMO PREMIO puede volver a salir (ya existía)
--   · permitir_regirar  → si LA PERSONA puede volver a girar (esto)
-- Con permitir_regirar en false la ruleta se cierra tras el primer giro y el
-- navegador de quien jugó lo recuerda, para que recargar no regale otro turno.

alter table public.ruleta_config
  add column if not exists permitir_regirar boolean not null default true;

alter table public.ruleta_config
  add column if not exists agotado_texto text
    default 'Ya usaste tu giro de hoy. ¡Gracias por participar!';
