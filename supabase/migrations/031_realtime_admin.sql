-- El admin escucha por realtime los pedidos (Dashboard, Pedidos, Clientes,
-- Pagos y la notificación de pedido pagado), los mensajes y las cotizaciones
-- (notificaciones). La publicación solo tenía productos y variantes, así que
-- esos canales se suscribían sin recibir nada.
--
-- Realtime aplica las políticas RLS de cada tabla a postgres_changes: un
-- visitante anónimo no recibe filas de pedidos porque solo is_admin() puede
-- leerlas.
do $$
declare
  t text;
begin
  foreach t in array array['pedidos', 'mensajes', 'cotizaciones'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
