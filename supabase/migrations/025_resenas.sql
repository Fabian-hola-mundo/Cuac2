-- Reseñas que dejan los clientes desde la página principal.
-- Entran ocultas; desde /admin/resenas se decide si se muestran en el home
-- y, opcionalmente, a qué proyecto del portafolio pertenecen.

begin;

create table if not exists public.resenas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (char_length(btrim(nombre)) between 2 and 80),
  cargo_empresa text check (cargo_empresa is null or char_length(cargo_empresa) <= 120),
  comentario    text not null check (char_length(btrim(comentario)) between 10 and 800),
  correo        text check (correo is null or char_length(correo) <= 160),
  visible       boolean not null default false,
  proyecto_id   uuid references public.portfolio_projects(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists resenas_visible_idx on public.resenas (visible, created_at desc);

alter table public.resenas enable row level security;

-- Cualquiera puede dejar una reseña, pero siempre entra oculta y sin proyecto.
drop policy if exists resenas_insert_publico on public.resenas;
create policy resenas_insert_publico on public.resenas
  for insert to anon, authenticated
  with check (visible = false and proyecto_id is null);

-- El público solo lee las aprobadas.
drop policy if exists resenas_select_visibles on public.resenas;
create policy resenas_select_visibles on public.resenas
  for select to anon, authenticated
  using (visible = true);

drop policy if exists resenas_admin_all on public.resenas;
create policy resenas_admin_all on public.resenas
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- El correo nunca se expone por la API: ninguna sesión puede seleccionar esa
-- columna (una cuenta de Google cualquiera queda "authenticated" sin ser admin).
-- El admin lo lee con admin_listar_resenas().
revoke select on public.resenas from anon, authenticated;
grant select (id, nombre, cargo_empresa, comentario, visible, proyecto_id, created_at)
  on public.resenas to anon, authenticated;

create or replace function public.admin_listar_resenas()
returns setof public.resenas
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;
  return query select * from public.resenas order by created_at desc;
end;
$$;

revoke all on function public.admin_listar_resenas() from public;
grant execute on function public.admin_listar_resenas() to authenticated;

commit;
