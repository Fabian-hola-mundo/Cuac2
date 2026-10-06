-- Registro de los dispositivos que usan el POS. Cada navegador genera su propio
-- id la primera vez y se reporta al entrar y mientras vende, así el admin ve
-- quién está vendiendo, desde qué equipo y cuándo se usó por última vez.
-- Las ventas guardan el id además del nombre: el nombre lo escribe la persona
-- y puede repetirse o cambiar.

create table if not exists public.pos_dispositivos (
  id               uuid primary key,
  nombre           text not null,
  email            text,
  plataforma       text,
  user_agent       text,
  pantalla         text,
  primer_uso       timestamptz not null default now(),
  ultimo_uso       timestamptz not null default now(),
  ultimo_evento_id text
);

alter table public.pos_dispositivos enable row level security;

drop policy if exists pos_dispositivos_admin_all on public.pos_dispositivos;
create policy pos_dispositivos_admin_all on public.pos_dispositivos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.ventas_evento
  add column if not exists dispositivo_id uuid;

create index if not exists ventas_evento_dispositivo_id_idx
  on public.ventas_evento (dispositivo_id);

-- El POS no escribe la tabla directo: pasa por aquí, que valida al operador y
-- toma el correo del token en vez de confiar en lo que mande el navegador.
create or replace function public.registrar_dispositivo_pos(
  p_id         uuid,
  p_nombre     text,
  p_plataforma text default null,
  p_user_agent text default null,
  p_pantalla   text default null,
  p_evento_id  text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_pos_operator()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_id is null or coalesce(btrim(p_nombre), '') = '' then
    raise exception 'Dispositivo inválido' using errcode = '22023';
  end if;

  insert into public.pos_dispositivos as d
    (id, nombre, email, plataforma, user_agent, pantalla, ultimo_evento_id)
  values (
    p_id,
    left(btrim(p_nombre), 80),
    auth.jwt() ->> 'email',
    left(p_plataforma, 120),
    left(p_user_agent, 400),
    left(p_pantalla, 40),
    p_evento_id
  )
  on conflict (id) do update set
    nombre           = excluded.nombre,
    email            = excluded.email,
    plataforma       = excluded.plataforma,
    user_agent       = excluded.user_agent,
    pantalla         = excluded.pantalla,
    ultimo_evento_id = coalesce(excluded.ultimo_evento_id, d.ultimo_evento_id),
    ultimo_uso       = now();
end;
$$;

revoke all on function public.registrar_dispositivo_pos(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.registrar_dispositivo_pos(uuid, text, text, text, text, text) to authenticated;

-- Resumen para el admin: cada dispositivo con lo que lleva vendido.
create or replace view public.pos_dispositivos_resumen
with (security_invoker = true) as
select
  d.*,
  coalesce(v.ventas, 0)   as ventas,
  coalesce(v.unidades, 0) as unidades,
  v.ultima_venta
from public.pos_dispositivos d
left join (
  select dispositivo_id,
         count(*)           as ventas,
         sum(cantidad)      as unidades,
         max(vendido_en)    as ultima_venta
  from public.ventas_evento
  where dispositivo_id is not null
  group by dispositivo_id
) v on v.dispositivo_id = d.id;

grant select on public.pos_dispositivos_resumen to authenticated;
