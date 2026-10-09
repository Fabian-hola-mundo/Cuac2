-- supabase/migrations/021_ruleta.sql
-- Ruleta interactiva de /ruleta. Todo lo que se ve en la página (textos,
-- colores, opciones, física del giro) sale de estas tablas para que el estudio
-- pueda cambiarlo desde /admin/ruleta sin tocar código ni volver a desplegar.

-- ── Configuración (una sola fila) ────────────────────────────────────────────
create table if not exists public.ruleta_config (
  id                  text primary key default 'default',

  -- Contenido
  titulo              text not null default 'La ruleta del Cuaquiverso',
  subtitulo           text not null default 'Gira y descubre qué te llevas hoy',
  descripcion         text          default 'Un giro por persona. Muestra el resultado en caja o escríbenos por WhatsApp para reclamarlo.',
  boton_texto         text not null default 'Girar',
  boton_girando_texto text not null default 'Girando…',
  resultado_titulo    text not null default '¡Te tocó!',
  resultado_cta       text not null default 'Girar otra vez',
  pie_texto           text          default 'Válido solo durante el evento. Sujeto a disponibilidad.',

  -- Comportamiento del giro
  duracion_ms         integer not null default 5200,
  vueltas_min         integer not null default 4,
  vueltas_max         integer not null default 7,
  permitir_repetir    boolean not null default true,
  sonido              boolean not null default true,
  confeti             boolean not null default true,
  registrar_giros     boolean not null default false,

  -- Apariencia
  color_fondo         text not null default '#011E54',
  color_texto         text not null default '#FAFAFB',
  color_acento        text not null default '#EC3813',
  color_aro           text not null default '#FAFAFB',
  color_puntero       text not null default '#EC3813',
  color_hub           text not null default '#FAFAFB',
  color_hub_texto     text not null default '#011E54',
  mostrar_luces       boolean not null default true,
  mostrar_descripcion boolean not null default true,
  mostrar_leyenda     boolean not null default true,

  activa              boolean not null default true,
  actualizado_en      timestamptz not null default now(),

  -- La página lee siempre 'default': la restricción evita que se cuelen filas
  -- huérfanas que nadie vería y que confundirían al admin.
  constraint ruleta_config_fila_unica check (id = 'default'),
  constraint ruleta_config_duracion   check (duracion_ms between 500 and 30000),
  constraint ruleta_config_vueltas    check (vueltas_min between 1 and 30
                                         and vueltas_max between 1 and 30
                                         and vueltas_max >= vueltas_min)
);

-- ── Opciones de la ruleta ────────────────────────────────────────────────────
create table if not exists public.ruleta_opciones (
  id          uuid primary key default gen_random_uuid(),
  config_id   text not null default 'default'
                references public.ruleta_config(id) on delete cascade,
  etiqueta    text not null,
  descripcion text,
  color       text not null default '#EC3813',
  color_texto text not null default '#FAFAFB',
  -- Peso relativo: es a la vez el tamaño de la porción y su probabilidad. Un 2
  -- ocupa el doble de rueda que un 1 y sale el doble de veces, así que lo que
  -- se ve en pantalla y lo que reparte el sorteo nunca se contradicen.
  peso        integer not null default 1,
  sort_order  integer not null default 0,
  activa      boolean not null default true,
  creado_en   timestamptz not null default now(),

  constraint ruleta_opciones_peso check (peso between 1 and 100)
);

create index if not exists ruleta_opciones_orden_idx
  on public.ruleta_opciones (config_id, sort_order);

-- ── Registro de giros (opcional, se activa desde el admin) ───────────────────
create table if not exists public.ruleta_giros (
  id        uuid primary key default gen_random_uuid(),
  opcion_id uuid references public.ruleta_opciones(id) on delete set null,
  etiqueta  text not null,
  creado_en timestamptz not null default now()
);

create index if not exists ruleta_giros_fecha_idx
  on public.ruleta_giros (creado_en desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.ruleta_config   enable row level security;
alter table public.ruleta_opciones enable row level security;
alter table public.ruleta_giros    enable row level security;

-- La ruleta es pública: cualquier visitante la lee sin sesión.
drop policy if exists ruleta_config_select_public on public.ruleta_config;
create policy ruleta_config_select_public on public.ruleta_config
  for select using (true);

drop policy if exists ruleta_config_admin on public.ruleta_config;
create policy ruleta_config_admin on public.ruleta_config
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists ruleta_opciones_select_public on public.ruleta_opciones;
create policy ruleta_opciones_select_public on public.ruleta_opciones
  for select using (true);

drop policy if exists ruleta_opciones_admin on public.ruleta_opciones;
create policy ruleta_opciones_admin on public.ruleta_opciones
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Los giros solo se pueden insertar mientras el registro esté encendido; así
-- apagar el interruptor en el admin cierra de verdad la escritura anónima en
-- vez de limitarse a que el front deje de llamar.
drop policy if exists ruleta_giros_insert_public on public.ruleta_giros;
create policy ruleta_giros_insert_public on public.ruleta_giros
  for insert with check (
    exists (
      select 1 from public.ruleta_config c
      where c.id = 'default' and c.registrar_giros and c.activa
    )
  );

drop policy if exists ruleta_giros_admin on public.ruleta_giros;
create policy ruleta_giros_admin on public.ruleta_giros
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Semilla ──────────────────────────────────────────────────────────────────
insert into public.ruleta_config (id) values ('default')
on conflict (id) do nothing;

insert into public.ruleta_opciones (config_id, etiqueta, descripcion, color, color_texto, peso, sort_order)
select * from (values
  ('default', 'Envío gratis',        'En tu próximo pedido de la tienda',      '#011E54', '#FAFAFB', 1, 1),
  ('default', '10% de descuento',    'Sobre el total de la compra',            '#FFC93C', '#151F28', 2, 2),
  ('default', 'Sticker sorpresa',    'Uno del Cuaquiverso, elegido al azar',   '#EC3813', '#FAFAFB', 3, 3),
  ('default', 'Sigue participando',  'Vuelve a intentarlo en el próximo giro', '#C0E8FD', '#151F28', 2, 4),
  ('default', '2x1 en llaveros',     'Llévate dos y paga uno',                 '#FF8D75', '#151F28', 1, 5)
) as seed
where not exists (select 1 from public.ruleta_opciones);
