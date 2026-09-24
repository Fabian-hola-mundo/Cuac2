-- supabase/migrations/023_ruleta_modal.sql
-- El resultado del giro se anuncia en un modal sobre la ruleta, además de
-- quedar en la tarjeta lateral. Ambas cosas se configuran desde /admin.

alter table public.ruleta_config
  add column if not exists mostrar_modal boolean not null default true;

alter table public.ruleta_config
  add column if not exists gracias_texto text
    default 'Gracias por participar. Muestra esta pantalla en caja para reclamar tu premio.';
