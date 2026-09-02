-- 016_bold_pagos.sql
-- La tienda pasa de Wompi a Bold como pasarela.
--
-- wompi_transaction_id se conserva: los pedidos que ya se cobraron por Wompi
-- siguen necesitando su identificador para conciliar.

begin;

alter table public.pedidos
  add column if not exists bold_payment_id text;

-- Bold reintenta un webhook hasta 5 veces si no recibe 200 en 2 segundos, así
-- que el mismo evento puede llegar varias veces. Guardamos su id para no
-- reprocesarlo.
create table if not exists public.bold_eventos (
  id          text        primary key,
  tipo        text        not null,
  referencia  text,
  recibido_en timestamptz not null default now()
);

alter table public.bold_eventos enable row level security;

-- Sin políticas para anon: sólo la edge function (service_role, que salta RLS)
-- escribe aquí. El admin puede leerlo para auditar.
create policy bold_eventos_admin_read on public.bold_eventos
  for select to authenticated
  using (public.is_admin());

commit;
