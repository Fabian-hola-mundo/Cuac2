-- 018_admin_mfa.sql
-- Verificación en dos pasos (TOTP) obligatoria para el admin.
--
-- is_admin() pasa a exigir que el JWT esté a nivel de aseguramiento aal2 (es
-- decir, que el segundo factor se haya verificado en esta sesión) — pero SÓLO
-- cuando el usuario ya tiene un factor MFA verificado. Así:
--   · antes de enrolarse, el admin entra a aal1 y puede configurar el 2FA;
--   · en cuanto hay un factor verificado, aal1 deja de dar acceso a nada
--     (RLS bloquea toda la tabla) hasta pasar el código del autenticador.
-- No hay riesgo de quedar fuera: la exigencia sólo aplica una vez configurado.

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.admin_users a
      join auth.users u on lower(u.email) = lower(a.email)
      where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and u.email_confirmed_at is not null
    )
    and (
      -- Sesión ya elevada al segundo factor…
      coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      -- …o el usuario todavía no ha configurado ningún factor (puede enrolarse).
      or not exists (
        select 1
        from auth.mfa_factors f
        where f.user_id = auth.uid()
          and f.status = 'verified'
      )
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

commit;
