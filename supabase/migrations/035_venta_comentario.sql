-- Nota opcional en cada venta del POS (p. ej. «pagó con Nequi», «regalo para
-- la artista»). Se limita el largo para que una nota no se coma la tabla.

alter table public.ventas_evento
  add column if not exists comentario text
  check (comentario is null or char_length(comentario) <= 280);
