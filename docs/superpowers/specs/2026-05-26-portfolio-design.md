# Portafolio — Diseño técnico
**Fecha:** 2026-05-26  
**Estado:** Aprobado, listo para implementación

---

## 1. Alcance

Tres páginas públicas de portafolio + un módulo admin para gestionar proyectos, conectado a Supabase.

- `/portafolio` — portafolio principal de Cuac Design  
- `/portafolio/natalia` — portafolio personal de Natalia Castañeda Caicedo  
- `/portafolio/nathali` — portafolio personal de Nathali Ramírez Ortiz  
- `/admin/portafolio` — CRUD de proyectos (lista + formulario)

---

## 2. Backend — Supabase

### Tabla: `portfolio_projects`

| campo        | tipo          | notas                                                        |
|-------------|--------------|--------------------------------------------------------------|
| `id`         | uuid PK       | generado automáticamente                                     |
| `title`      | text NOT NULL | título visible del proyecto                                  |
| `slug`       | text UNIQUE   | identificador URL-friendly                                   |
| `category`   | text NOT NULL | enum: `branding` · `identidad` · `editorial` · `packaging` · `ilustración` · `web` · `motion` · `ux-ui` |
| `authors`    | text[]        | array de autores: `cuac`, `natalia`, `nathali` (puede ser múltiple) |
| `description`| text          | cuerpo largo del proyecto                                    |
| `cover_url`  | text          | URL de imagen principal (Supabase Storage)                   |
| `images`     | text[]        | galería adicional (hasta 8 URLs de Storage)                  |
| `tags`       | text[]        | etiquetas libres: cliente, sector, año, etc.                 |
| `featured`   | boolean       | aparece primero en la lista                                  |
| `published`  | boolean       | `false` = borrador, no visible en web pública                |
| `created_at` | timestamptz   | auto                                                         |

### Storage

Bucket: `portfolio`  
Estructura: `/portfolio/{slug}/cover.jpg`, `/portfolio/{slug}/img-1.jpg`, etc.

### RLS

- Lectura pública: solo registros con `published = true`
- Escritura: requiere sesión autenticada (mismo auth de Supabase que usa el admin actual)

---

## 3. Rutas Angular

```
/portafolio                    → PortfolioShellComponent (theme: 'cuac')
/portafolio/natalia            → PortfolioShellComponent (theme: 'natalia')
/portafolio/nathali            → PortfolioShellComponent (theme: 'nathali')

/admin/portafolio              → AdminPortfolioListComponent
/admin/portafolio/nuevo        → AdminPortfolioFormComponent
/admin/portafolio/:id/editar   → AdminPortfolioFormComponent
```

Las rutas `/portafolio/natalia` y `/portafolio/nathali` pasan el tema via `route.data` (`{ theme: 'natalia' }`). El shell lo lee con `inject(ActivatedRoute)`.

---

## 4. Componentes públicos

### `PortfolioShellComponent`

- Recibe `theme: 'cuac' | 'natalia' | 'nathali'` desde route data
- Aplica `[attr.data-theme]="theme"` en el host para activar tokens CSS
- Filtra proyectos de Supabase por `authors.includes(theme)`
- Contiene: hero, fila de filtros por categoría, `PortfolioGridComponent`, y (solo en theme `cuac`) `PortfolioPersonalFooterComponent`

### `PortfolioGridComponent`

- `@Input() projects: Project[]`
- `@Input() accentColor: string` (para el estado activo de pills)
- Grid 3-col desktop / 2-col tablet / 1-col móvil
- Tarjetas: cover a pantalla completa, footer semitransparente con título + categoría
- Hover: escala leve + revelado de categoría tag
- Pills de filtro por categoría sobre el grid; estado activo usa `--theme-accent`

### `PortfolioPersonalFooterComponent`

- Bloque con fondo `--mist`, dos tarjetas horizontales
- Izquierda: Natalia (acento `#E87A89`), derecha: Nathali (acento `#8B9ED9`)
- Cada tarjeta muestra nombre, especialidades y enlace "Ver portafolio →"
- Encabezado: *"El equipo también tiene voz propia."*
- Solo se renderiza cuando `theme === 'cuac'`

---

## 5. Componentes admin

### `AdminPortfolioListComponent`

- Ruta: `/admin/portafolio`
- Tabla con columnas: cover thumb, título, categoría, autores (chips de color), estado, fecha
- Acciones por fila: editar, toggle published (inline, sin abrir formulario), eliminar
- Botón "Nuevo proyecto" → `/admin/portafolio/nuevo`
- Entrada en el sidebar del admin shell (junto a Inventario y Cotizaciones)

### `AdminPortfolioFormComponent`

- Ruta: `/admin/portafolio/nuevo` y `/admin/portafolio/:id/editar`
- Campos:
  - Título (text)
  - Slug (auto-generado desde título, editable)
  - Categoría (select)
  - Autores (checkboxes: Cuac / Natalia / Nathali)
  - Descripción (textarea)
  - Cover (upload a Supabase Storage)
  - Galería (hasta 8 imágenes, drag-and-drop, upload a Storage)
  - Tags (input multi-tag)
  - Destacado (toggle)
  - Publicado (toggle)
- Guarda en tabla `portfolio_projects`

---

## 6. Tokens de tema

```scss
// Tokens base (en _tokens.scss, ya existentes)
--deep:  #011E54;
--display: 'Fauna One', Georgia, serif;
--sans:    'Manrope', system-ui, sans-serif;

// Tokens de tema (sobreescritos por [data-theme])
[data-theme="cuac"] {
  --theme-primary: #011E54;
  --theme-accent:  #EC3813;
  --theme-surface: #F0F1F6;
}

[data-theme="natalia"] {
  --theme-primary: #E87A89;
  --theme-accent:  #C4556A;
  --theme-surface: #FDEEF0;
}

[data-theme="nathali"] {
  --theme-primary: #8B9ED9;
  --theme-accent:  #5C6FC7;
  --theme-surface: #EEF0FA;
}
```

Lo que comparten los tres temas: `--deep` (#011E54) como color de hero/fondo, Fauna One + Manrope, sistema de espaciado (8pt grid), border-radii, estructura de grid.

---

## 7. Cambios en componentes existentes

### `TopbarComponent`
- Añadir enlace "Portafolio" en `<nav class="primary">` y en el `<nav class="mobile-nav">`
- Usar `routerLink="/portafolio"`

### Hero (`hero.component.html`)
- Añadir botón secundario "Ver portafolio →" junto al CTA "Empezar un proyecto"
- Estilo: `btn btn-ghost-light` (ya existe en el sistema)

### Footer
- Añadir enlace "Portafolio" en la columna de navegación del footer

### `admin-shell.component.ts` + template
- Añadir `isPortafolioRoute` computed signal
- Añadir `goPortafolio()` método
- Añadir entrada "Portafolio" en el sidebar nav

### `app.routes.ts`
- Registrar las 5 rutas nuevas

---

## 8. Nuevo servicio

### `PortfolioService`

```typescript
// src/app/core/services/portfolio.service.ts
getPublished(author?: string): Promise<Project[]>
getAll(): Promise<Project[]>           // admin
getById(id: string): Promise<Project>
create(data: ProjectPayload): Promise<void>
update(id: string, data: Partial<ProjectPayload>): Promise<void>
remove(id: string): Promise<void>
uploadImage(slug: string, file: File, name: string): Promise<string>  // retorna URL
```

---

## 9. UX de páginas personales

- **Hero:** fondo `--deep`, nombre en Fauna One, rol en Manrope, tagline en itálica
- **Breadcrumb:** "← Cuac Design" (mismo estilo que `.universe-link` del topbar)
- **Acento:** `--theme-accent` reemplaza `--ember` en pills activas, hovers y detalles
- **Sin bloque personal:** `PortfolioPersonalFooterComponent` no aparece en temas `natalia` y `nathali`

---

## 10. Lo que queda fuera de este scope

- Página de detalle de proyecto (`/portafolio/:slug`) — se puede añadir en una iteración siguiente
- Autenticación propia para Natalia/Nathali para subir sus proyectos directamente
- SEO / meta tags dinámicos
- Animaciones de transición entre rutas
