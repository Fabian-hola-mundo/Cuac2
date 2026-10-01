-- Encuadre de las imágenes del portafolio, guardado aparte de la foto.
-- La portada es una sola foto (la misma en la tarjeta del grid y en el hero del
-- detalle), pero cada lugar la encuadra distinto. Cada encuadre es
-- {"x": 0–100, "y": 0–100, "zoom": 1–5}: punto de la foto y acercamiento.
-- images_focus va en el mismo orden que images.

begin;

alter table public.portfolio_projects
  add column if not exists cover_focus_card jsonb,
  add column if not exists cover_focus_hero jsonb,
  add column if not exists images_focus     jsonb not null default '[]'::jsonb;

alter table public.portfolio_projects
  drop constraint if exists portfolio_projects_images_focus_array;
alter table public.portfolio_projects
  add constraint portfolio_projects_images_focus_array
  check (jsonb_typeof(images_focus) = 'array');

commit;
