-- 019_notify_pedido_aprobado.sql
-- Avisa por correo cada vez que un pedido pasa a 'aprobado'. Se hace con un
-- trigger sobre `pedidos` (no dentro de verificar-pago/webhook) para que el
-- aviso salga sin importar quién confirmó el pago: el respaldo verificar-pago,
-- el webhook de Bold o una conciliación manual. Mismo patrón que
-- trigger_notify_mensaje: net.http_post a una edge function con verify_jwt=false.

begin;

create or replace function public.trigger_notify_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://ytqcwrjxlnlsjgnjxiiw.supabase.co/functions/v1/notify-pedido',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := json_build_object('record', row_to_json(NEW))::jsonb
  );
  return NEW;
end;
$$;

revoke execute on function public.trigger_notify_pedido() from public, anon, authenticated;

-- Al pasar de cualquier estado a 'aprobado' (el caso normal: verificar-pago /
-- webhook mueven de 'pendiente' a 'aprobado').
drop trigger if exists trg_pedido_aprobado_update on public.pedidos;
create trigger trg_pedido_aprobado_update
  after update on public.pedidos
  for each row
  when (NEW.estado = 'aprobado' and OLD.estado is distinct from 'aprobado')
  execute function public.trigger_notify_pedido();

-- Defensa por si algún flujo futuro inserta un pedido ya 'aprobado'.
drop trigger if exists trg_pedido_aprobado_insert on public.pedidos;
create trigger trg_pedido_aprobado_insert
  after insert on public.pedidos
  for each row
  when (NEW.estado = 'aprobado')
  execute function public.trigger_notify_pedido();

commit;
