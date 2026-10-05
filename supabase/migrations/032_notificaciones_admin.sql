-- Notificaciones del admin: lo pendiente se marca en la base, no en el navegador.
--
-- Antes, "reseña nueva" dependía de una fecha en localStorage: cada dispositivo
-- llevaba su propia cuenta y abrir /admin/resenas en uno borraba las pendientes.
-- Los pedidos pagados solo llegaban por realtime con el admin abierto; si el pago
-- entraba con el celular bloqueado, la campana nunca lo mostraba.

begin;

-- ── Reseñas ─────────────────────────────────────────────────────────────────
alter table public.resenas
  add column if not exists leida boolean not null default false;

-- Las que ya existen ya pasaron por el admin.
update public.resenas set leida = true where not leida;

grant select (leida) on public.resenas to authenticated;

-- El público no puede dejarlas marcadas como leídas.
drop policy if exists resenas_insert_publico on public.resenas;
create policy resenas_insert_publico on public.resenas
  for insert to anon, authenticated
  with check (visible = false and proyecto_id is null and leida = false);

create or replace function public.admin_marcar_resenas_leidas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;
  update public.resenas set leida = true where not leida;
end;
$$;

revoke all on function public.admin_marcar_resenas_leidas() from public;
grant execute on function public.admin_marcar_resenas_leidas() to authenticated;

-- ── Pedidos ─────────────────────────────────────────────────────────────────
alter table public.pedidos
  add column if not exists visto_admin boolean not null default false;

update public.pedidos set visto_admin = true where not visto_admin;

-- ── Mensajes ────────────────────────────────────────────────────────────────
-- Solo anon podía insertar: con una sesión abierta en el navegador (el admin
-- probando la tienda) el mensaje se rechazaba.
drop policy if exists insertar_publico on public.mensajes;
create policy insertar_publico on public.mensajes
  for insert to anon, authenticated
  with check (true);

commit;
