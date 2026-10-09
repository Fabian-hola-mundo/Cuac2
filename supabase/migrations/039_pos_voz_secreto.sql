-- Venta por voz: la Edge Function pos-voz lee la clave de Groq desde Supabase
-- Vault cuando no está como secreto de entorno (GROQ_API_KEY).
-- El valor NO va en esta migración: se guarda aparte con
--   select vault.create_secret('<clave>', 'groq_api_key', 'Groq para pos-voz');
-- Solo service_role puede leerlo; anon y authenticated no.

create or replace function public.secreto_pos_voz(p_nombre text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_nombre
    and p_nombre in ('groq_api_key')
  limit 1
$$;

revoke all on function public.secreto_pos_voz(text) from public;
revoke execute on function public.secreto_pos_voz(text) from anon, authenticated;
grant execute on function public.secreto_pos_voz(text) to service_role;
