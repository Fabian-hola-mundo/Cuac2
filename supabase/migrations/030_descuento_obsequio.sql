-- Códigos que se regalan con la compra de ciertos productos.
-- Cuando se aprueba un pedido que incluye alguno de `obsequio_productos_ids`,
-- notify-pedido le envía el código al comprador por correo, con
-- `obsequio_mensaje` explicando dónde usarlo. Enviar el código no depende de
-- `activo`: se puede regalar un código que todavía no se puede canjear (p. ej.
-- para un producto que aún no sale) y activarlo después desde el admin.

begin;

alter table public.codigos_descuento
  add column if not exists obsequio_productos_ids text[],   -- NULL = no se regala
  add column if not exists obsequio_mensaje       text;

-- Primer caso: la primera edición del Tarot Cuac regala un 15 % para el tarot
-- oficial. Queda inactivo hasta que el oficial esté en la tienda.
insert into public.codigos_descuento
  (codigo, tipo, valor, activo, obsequio_productos_ids, obsequio_mensaje)
values
  ('TAROTCUAC15', 'porcentaje', 15, false,
   array['a2de43cf-9593-4011-98d4-8f5d0de58fdc'],
   'Gracias por llevarte la primera edición del Tarot Cuac. Este código te da un 15 % de descuento en el tarot oficial: guárdalo y úsalo en la tienda del Cuaquiverso cuando salga a la venta.')
on conflict (codigo) do nothing;

commit;
