-- Productos exclusivos de evento: no se venden en la tienda web y en el POS
-- sólo aparecen mientras hay un evento activo (sin importar en qué evento se
-- crearon). La tienda filtra por esta columna y crear-pedido rechaza el
-- producto aunque alguien lo meta al carrito a mano.

alter table public.productos_evento
  add column if not exists solo_evento boolean not null default false;
