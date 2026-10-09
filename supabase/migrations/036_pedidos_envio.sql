-- El admin mostraba «Envío: Pendiente» en todos los pedidos porque la base no
-- guardaba el despacho. El estado de pago lo sigue decidiendo Bold (`estado`);
-- el de envío lo mueve el equipo a mano desde /admin.

alter table public.pedidos
  add column if not exists envio_estado text not null default 'preparando'
    constraint pedidos_envio_estado_check
    check (envio_estado in ('preparando', 'enviado', 'entregado', 'devuelto')),
  add column if not exists guia text
    check (guia is null or char_length(guia) <= 120),
  add column if not exists enviado_en   timestamptz,
  add column if not exists entregado_en timestamptz;
