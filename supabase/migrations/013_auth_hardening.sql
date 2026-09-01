-- 013_auth_hardening.sql
-- Unifica el control de acceso del admin en admin_users + is_admin(), cierra las
-- escrituras anónimas que quedaban abiertas y corta la fuga de datos personales
-- de pedidos. Antes convivían dos criterios (auth.email() hardcodeado y
-- auth.role() = 'authenticated'); ahora todo pasa por is_admin().

begin;

-- ---------------------------------------------------------------------------
-- 1. Fuente de verdad de administradores
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  email     text primary key,
  nombre    text,
  creado_en timestamptz not null default now()
);

insert into public.admin_users (email, nombre)
values ('designcuac@gmail.com', 'CUAC Design')
on conflict (email) do nothing;

-- security definer: las políticas necesitan leer admin_users sin que la RLS de
-- esa misma tabla se dispare recursivamente.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.admin_users enable row level security;
drop policy if exists admin_users_admin_all on public.admin_users;
create policy admin_users_admin_all on public.admin_users
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. personajes — no tenía RLS: la anon key podía escribir
-- ---------------------------------------------------------------------------
alter table public.personajes enable row level security;

drop policy if exists personajes_public_read on public.personajes;
create policy personajes_public_read on public.personajes
  for select to anon, authenticated using (activo = true);

drop policy if exists personajes_admin_all on public.personajes;
create policy personajes_admin_all on public.personajes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. portfolio_* — tenían ALL ... USING (true) para public (escritura anónima)
-- ---------------------------------------------------------------------------
drop policy if exists achievements_auth_all on public.portfolio_achievements;
create policy achievements_admin_all on public.portfolio_achievements
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_auth_all on public.portfolio_profiles;
create policy profiles_admin_all on public.portfolio_profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists portfolio_auth_all on public.portfolio_projects;
create policy portfolio_admin_all on public.portfolio_projects
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. eventos y mensajes — pasaban de 'authenticated' genérico a is_admin()
-- ---------------------------------------------------------------------------
drop policy if exists eventos_write_authenticated on public.eventos;
create policy eventos_admin_all on public.eventos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists insertar_autenticado on public.mensajes;  -- redundante con insertar_publico
drop policy if exists leer_autenticado      on public.mensajes;
drop policy if exists actualizar_autenticado on public.mensajes;
create policy mensajes_admin_read on public.mensajes
  for select to authenticated using (public.is_admin());
create policy mensajes_admin_update on public.mensajes
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Tablas que ya usaban el email hardcodeado -> is_admin()
-- ---------------------------------------------------------------------------
drop policy if exists solo_admin_descuentos on public.codigos_descuento;
create policy codigos_descuento_admin_all on public.codigos_descuento
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists solo_admin_movimientos on public.producto_movimientos;
create policy producto_movimientos_admin_all on public.producto_movimientos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists solo_admin_productos on public.productos_evento;
create policy productos_evento_admin_all on public.productos_evento
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists solo_admin_ventas on public.ventas_evento;
create policy ventas_evento_admin_all on public.ventas_evento
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists cotizaciones_select_admin on public.cotizaciones;
drop policy if exists cotizaciones_update_admin on public.cotizaciones;
create policy cotizaciones_admin_all on public.cotizaciones
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists site_settings_update_admin on public.site_settings;
drop policy if exists site_settings_upsert_admin on public.site_settings;
create policy site_settings_admin_write on public.site_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

commit;
