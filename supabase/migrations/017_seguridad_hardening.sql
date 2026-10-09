-- 017_seguridad_hardening.sql
-- Cierre de los hallazgos de la auditoría de seguridad de feat/bold-checkout.
--
--  PII-01  obtener_pedido pasa a buscar por un token uuid impredecible, no por
--          la referencia (que sólo tiene 9000 valores por día y era enumerable).
--  RPC-01  incrementar_uso_descuento deja de ser ejecutable por anon/authenticated.
--  ADM-02  is_admin() exige que el email del admin esté confirmado.
--  POS-01  rol pos_operator acotado, para que el punto de venta no tenga que
--          operar con la cuenta admin total del sitio.
--  RLS-01  se activa RLS en portfolio_achievements/profiles (ya activo en vivo,
--          pero faltaba en las migraciones: un db reset las dejaba abiertas).
--  RPC-02  se revoca el EXECUTE público de las funciones de inventario.
--  SQL-01  se fija search_path en las funciones que los advisors marcaban.

begin;

-- ---------------------------------------------------------------------------
-- ADM-02 · is_admin() exige email confirmado
-- ---------------------------------------------------------------------------
-- Antes bastaba con que el claim `email` del JWT coincidiera con admin_users.
-- Ahora además el email debe estar confirmado en auth.users, para que el
-- privilegio no dependa de que la confirmación de correo esté activada en el
-- dashboard. El registro público ya está deshabilitado; esto es defensa en
-- profundidad por si algún día se abre el signup por email/contraseña.
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
    join auth.users u on lower(u.email) = lower(a.email)
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and u.email_confirmed_at is not null
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- POS-01 · rol de operador de punto de venta, acotado
-- ---------------------------------------------------------------------------
-- El POS de eventos iniciaba sesión con designcuac@gmail.com, la única cuenta
-- admin, que gobierna todo el backoffice. Un operador de POS sólo necesita leer
-- el catálogo y registrar ventas. Este rol existe para poder crear cuentas de
-- cajero sin darles is_admin(); el admin sigue funcionando en el POS como antes.
create table if not exists public.pos_operators (
  email     text primary key,
  nombre    text,
  creado_en timestamptz not null default now()
);

alter table public.pos_operators enable row level security;

drop policy if exists pos_operators_admin_all on public.pos_operators;
create policy pos_operators_admin_all on public.pos_operators
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.is_pos_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pos_operators p
    join auth.users u on lower(u.email) = lower(p.email)
    where lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and u.email_confirmed_at is not null
  );
$$;

revoke all on function public.is_pos_operator() from public;
grant execute on function public.is_pos_operator() to anon, authenticated;

-- ventas_evento: además del admin, un operador de POS puede registrar y leer
-- ventas. La política admin_all (FOR ALL) preexistente se conserva.
drop policy if exists ventas_evento_pos_insert on public.ventas_evento;
create policy ventas_evento_pos_insert on public.ventas_evento
  for insert to authenticated
  with check (public.is_admin() or public.is_pos_operator());

drop policy if exists ventas_evento_pos_select on public.ventas_evento;
create policy ventas_evento_pos_select on public.ventas_evento
  for select to authenticated
  using (public.is_admin() or public.is_pos_operator());

-- ---------------------------------------------------------------------------
-- RPC-02 + SQL-01 · funciones de inventario: search_path fijo, sin EXECUTE público
-- ---------------------------------------------------------------------------
-- decrementar_stock_seguro pasa a SECURITY DEFINER con guardia explícita, para
-- que un operador de POS pueda descontar stock sin tener UPDATE directo sobre
-- productos_evento (que le permitiría, p. ej., cambiar precios).
create or replace function public.decrementar_stock_seguro(
  p_producto_id uuid,
  p_cantidad    integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_pos_operator()) then
    raise exception 'No autorizado';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;
  update public.productos_evento
  set stock_actual = greatest(0, stock_actual - p_cantidad)
  where id = p_producto_id;
end;
$$;

revoke all on function public.decrementar_stock_seguro(uuid, integer) from public;
grant execute on function public.decrementar_stock_seguro(uuid, integer) to authenticated, service_role;

-- registrar_restock es sólo del admin (INVOKER: la RLS de productos_evento y
-- producto_movimientos ya lo restringe). Se le quita el EXECUTE público y se le
-- fija el search_path.
alter function public.registrar_restock(uuid, integer, text) set search_path = public;
revoke all on function public.registrar_restock(uuid, integer, text) from public;
grant execute on function public.registrar_restock(uuid, integer, text) to authenticated, service_role;

-- Funciones sin argumentos que los advisors marcaban por search_path mutable.
alter function public.registrar_creacion_producto() set search_path = public;
alter function public.trigger_notify_mensaje()      set search_path = public;

-- ---------------------------------------------------------------------------
-- RPC-01 + SQL-01 · incrementar_uso_descuento deja de ser público
-- ---------------------------------------------------------------------------
-- Es SECURITY DEFINER y bypassa la RLS de codigos_descuento; ejecutable por
-- anon, cualquiera podía agotar el cupo de un código conocido. Sólo la edge
-- function crear-pedido (service_role) la necesita.
create or replace function public.incrementar_uso_descuento(p_codigo text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.codigos_descuento
  SET usos_actuales = usos_actuales + 1,
      actualizado_en = now()
  WHERE codigo = p_codigo
    AND activo = true
    AND (expira_en IS NULL OR expira_en > now())
    AND (limite_usos IS NULL OR usos_actuales < limite_usos);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

revoke all on function public.incrementar_uso_descuento(text) from public;
grant execute on function public.incrementar_uso_descuento(text) to service_role;

-- ---------------------------------------------------------------------------
-- PII-01 · obtener_pedido por token impredecible en vez de por referencia
-- ---------------------------------------------------------------------------
-- La referencia (CQV-AAAAMMDD-NNNN) tiene 9000 valores por día y era enumerable
-- con la anon key para volcar nombre, email y dirección de todos los clientes.
-- Se añade un token uuid (122 bits) que viaja en la URL de confirmación, y la
-- RPC pasa a buscar por él. La referencia sigue mostrándose, pero ya no es la
-- llave de acceso a los datos.
alter table public.pedidos
  add column if not exists confirmacion_token uuid not null default gen_random_uuid();

create unique index if not exists pedidos_confirmacion_token_idx
  on public.pedidos(confirmacion_token);

drop function if exists public.obtener_pedido(text);
create function public.obtener_pedido(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',          p.id,
    'referencia',  p.referencia,
    'estado',      p.estado,
    'nombre',      p.nombre,
    'apellido',    p.apellido,
    'email',       p.email,
    'ciudad',      p.ciudad,
    'direccion',   p.direccion,
    'barrio',      p.barrio,
    'subtotal',    p.subtotal,
    'total',       p.total,
    'creado_en',   p.creado_en,
    'pedido_items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nombre',   i.nombre,
               'sub',      i.sub,
               'precio',   i.precio,
               'cantidad', i.cantidad,
               'color',    i.color))
      from public.pedido_items i
      where i.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from public.pedidos p
  where p.confirmacion_token::text = p_token;
$$;

revoke all on function public.obtener_pedido(text) from public;
grant execute on function public.obtener_pedido(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS-01 · RLS explícito en las tablas de portafolio
-- ---------------------------------------------------------------------------
-- Ya está activo en la base en vivo, pero las migraciones nunca lo declararon:
-- un `supabase db reset` desde el repo dejaba estas tablas abiertas a anon.
alter table public.portfolio_achievements enable row level security;
alter table public.portfolio_profiles     enable row level security;

-- ---------------------------------------------------------------------------
-- Revocaciones explícitas por rol
-- ---------------------------------------------------------------------------
-- Supabase concede EXECUTE a anon/authenticated a toda función nueva en public
-- vía ALTER DEFAULT PRIVILEGES, y cada CREATE OR REPLACE lo vuelve a aplicar. El
-- `revoke ... from public` de arriba NO quita esos grants explícitos, así que
-- hay que revocarlos por rol o la función sigue siendo llamable con la anon key.
revoke execute on function public.incrementar_uso_descuento(text) from anon, authenticated;
revoke execute on function public.decrementar_stock_seguro(uuid, integer) from anon;
revoke execute on function public.registrar_restock(uuid, integer, text) from anon;
revoke execute on function public.trigger_notify_mensaje()      from public, anon, authenticated;
revoke execute on function public.registrar_creacion_producto() from public, anon, authenticated;

commit;
