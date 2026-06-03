# Personajes del Cuaquiverso — Spec de diseño

**Fecha:** 2026-06-03
**Estado:** Aprobado

## Resumen

Crear el módulo completo de gestión de personajes del Cuaquiverso: tabla en Supabase, servicio Angular, admin CRUD con reordenamiento drag-and-drop, y página pública individual por personaje. Conectar las páginas existentes (`/cuaquiverso`, `/cuaquiverso/universo`) con datos reales en lugar del hardcode actual.

---

## 1. Modelo de datos

### Tabla `personajes` (Supabase)

```sql
CREATE TABLE personajes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text        UNIQUE NOT NULL,
  nombre       text        NOT NULL,
  sort_order   integer     NOT NULL DEFAULT 0,
  region       text,
  color        text,
  wire_color   text,
  slogan       text,
  bio          text,
  musica       text,
  personalidad text,
  fauna_flora  text,
  cover_url    text,
  galeria_urls text[]      DEFAULT '{}',
  activo       boolean     NOT NULL DEFAULT true,
  creado_en    timestamptz DEFAULT now()
);
```

### Seed inicial

Los 8 personajes existentes se insertan en la migración con sus datos actuales:

| key | nombre | color | wire_color | sort_order |
|---|---|---|---|---|
| cuac | Cuac | #2A6FDB | #5C95EA | 1 |
| kiki | Kiki | #FF6FA8 | #FFB1CF | 2 |
| roar | Roar | #3D4856 | #7A8694 | 3 |
| yeison | Yeison | #E8A434 | #FFD27A | 4 |
| abejandro | Abejandro | #E8623D | #F5957C | 5 |
| atolita | Atolita | #8B6FD8 | #B9A4F0 | 6 |
| colibriana | Colibriana | #1F8A5B | #5BB890 | 7 |
| tiburcio | Tiburcio | #2E8FB8 | #7DC1DC | 8 |

### Storage

Bucket: `personajes-media` (público)
- Cover: `personajes-media/cover/{id}/{filename}`
- Galería: `personajes-media/gallery/{id}/{filename}`

---

## 2. Servicio: `PersonajesService`

**Archivo:** `src/app/core/services/personajes.service.ts`

Signal-based, mismo patrón que `InventarioService`.

```ts
interface Personaje {
  id: string;
  key: string;
  nombre: string;
  sort_order: number;
  region: string | null;
  color: string | null;
  wire_color: string | null;
  slogan: string | null;
  bio: string | null;
  musica: string | null;
  personalidad: string | null;
  fauna_flora: string | null;
  cover_url: string | null;
  galeria_urls: string[];
  activo: boolean;
  creado_en: string;
}
```

**Métodos:**
- `load()`: fetch todos los personajes ordenados por `sort_order`, activos e inactivos (para admin)
- `activos()`: computed — solo `activo === true`
- `getByKey(key)`: busca en la lista en memoria; si no, fetch puntual
- `create(data, coverFile?, galleryFiles[])`: insert + upload imágenes
- `update(id, data, coverFile?, newGalleryFiles[], removedUrls[])`: update + upload nuevas + eliminar removidas
- `updateOrder(items: {id: string, sort_order: number}[])`: batch upsert de sort_order
- `delete(id)`: elimina registro + archivos del bucket

**Init:** `APP_INITIALIZER` o inyección en el admin shell y en cuaquiverso — llamar `load()` una vez por sesión.

---

## 3. Admin

### 3.1 Rutas

Agregadas como child routes del admin router:

```
/admin/personajes              PersonajesListComponent
/admin/personajes/nuevo        PersonajeFormComponent
/admin/personajes/:id          PersonajeDetailComponent
/admin/personajes/:id/editar   PersonajeFormComponent
```

### 3.2 Admin shell — ajustes

- El nav item `contenido` navega a `/admin/personajes` (actualmente solo setea `state.view`)
- Crumbs nuevos en `admin-shell.component.ts`:
  - `/personajes/nuevo` → `['Universo', 'Personajes', 'Nuevo']`
  - `/personajes/:id/editar` → `['Universo', 'Personajes', 'Editar']`
  - `/personajes/:id` → `['Universo', 'Personajes', 'Detalle']`
  - `/personajes` → `['Universo', 'Personajes']`

### 3.3 PersonajesListComponent

**Archivo:** `src/app/pages/admin/personajes/personajes-list.component.ts`

- Lista todos los personajes ordenados por `sort_order`
- Columnas: drag handle · thumbnail (40×40) · nombre · región · `activo` toggle · acciones (ver / editar / eliminar)
- **Reordenamiento:** `CdkDragDrop` (`@angular/cdk/drag-drop`)
  - `cdkDropList` en el contenedor
  - `cdkDrag` + `cdkDragHandle` en cada fila
  - `cdkDragPreview` con nombre del personaje
  - Al soltar (`cdkDropListDropped`): `moveItemInArray`, recalcular `sort_order` (índice + 1), llamar `service.updateOrder()`
- Botón "Nuevo personaje" top right → `/admin/personajes/nuevo`
- Confirmación antes de eliminar (inline, no modal)
- Toast de éxito/error tomado del admin shell via output o service

### 3.4 PersonajeFormComponent

**Archivo:** `src/app/pages/admin/personajes/personaje-form.component.ts`

Modo create/edit — mismo componente, `isEdit` derivado de `route.snapshot.paramMap.get('id')`.

**Campos (ReactiveFormsModule):**

| Campo | Control | Validación |
|---|---|---|
| nombre | text | required, minLength(2) |
| key | text | required, pattern `[a-z0-9-]+` |
| region | text | — |
| color | color | default `#2A6FDB` |
| wire_color | color | default `#5C95EA` |
| slogan | text | maxLength(120) |
| bio | textarea | — |
| musica | text | — |
| personalidad | text | — |
| fauna_flora | text | — |
| activo | boolean | default true |

**Imágenes:**
- `key` se auto-genera desde `nombre` (kebab-case) al escribir, pero el campo queda editable. En modo edición el key está deshabilitado (no cambia el slug de URLs existentes).
- **Cover:** input file + preview, misma lógica que `ProductoFormComponent.coverPreview`
- **Galería:** input file múltiple (accept image/*, máx 8 total). Muestra grid de previews con botón ✕ por imagen. En edición, las fotos existentes se muestran con opción de eliminar (marca `removedUrls`), las nuevas se suben al guardar.

**Guardar:** upload de imágenes primero → luego insert/update del registro con las URLs resultantes.

### 3.5 PersonajeDetailComponent

**Archivo:** `src/app/pages/admin/personajes/personaje-detail.component.ts`

- Cover a ancho completo (max 400px), o placeholder si no hay imagen
- Grid 2 columnas con todos los campos de texto
- Galería en grid 3×N
- Chip de estado activo/inactivo
- Contador "X productos vinculados" (query a `productos_evento` por `personaje = key`)
- Acciones: Editar · Eliminar · "Ver en sitio →" (link a `/cuaquiverso/personaje/:key`)

---

## 4. Página pública: PersonajePageComponent

**Archivo:** `src/app/pages/cuaquiverso/personaje/personaje-page.component.ts`
**Ruta:** `/cuaquiverso/personaje/:slug`

### Estructura

1. **Topbar** — mismo que universo/tienda (tienda · universo · carrito)
2. **Hero** — `background: color del personaje`, nombre en Fauna One grande (clamp 56px–96px), número de orden (ej. `01`) + región como subtítulo. Sin imagen.
3. **Identity strip** — franja blanca/paper con 4 celdas: Región · Música · Carácter · Fauna/Flora. Si un campo está vacío, la celda se oculta.
4. **Bio** — eyebrow "Sobre [nombre]", cuerpo del texto. Se oculta si `bio` es null.
5. **Galería** — grid asimétrico: imagen principal grande a la izquierda (60% ancho), columna de thumbnails a la derecha. Componente mantiene un `selectedImage = signal(galeria_urls[0])`. Clic en thumbnail actualiza el signal. Se oculta si `galeria_urls` está vacío.
6. **Productos** — eyebrow "Objetos de [nombre]", scroll horizontal de tarjetas de producto (mismo estilo que tienda), filtrados por `personaje === slug`. Se oculta si no hay productos activos.
7. **Nav personajes** — franja inferior: ← personaje anterior · personaje siguiente → ordenados por `sort_order`.

**Manejo de errores:**
- Slug no encontrado → `router.navigate(['/cuaquiverso/universo'])`
- SEO: `SeoService.set()` con nombre, bio (truncada) y cover_url como og:image

---

## 5. Conexión de páginas existentes

### `cuaquiverso.component.ts` — El elenco (sección `#elenco`)

- Inyectar `PersonajesService`
- Los `cast-card` se renderizan con `@for (p of personajesService.activos())` en lugar del hardcode
- Cada cast-card: `routerLink="/cuaquiverso/personaje/{{p.key}}"`
- La `face` muestra la inicial del nombre; el color de fondo usa `p.color`

### `universo.component.ts`

- Inyectar `PersonajesService`
- `ch-index-row`: `@for` sobre `activos()`, `href="/cuaquiverso/personaje/{{p.key}}"` (reemplaza `href="#"`)
- Grid de personajes (`.uni-grid`): misma dinámica, link a personaje individual
- **Three.js hero:** el array `characters` se construye desde `PersonajesService.activos()` mapeando `{ key, name, color, wire }`. La inicialización de Three.js (`initHeroScene`) se dispara dentro de `afterNextRender` pero debe esperar a que el servicio haya cargado: usar `toObservable(personajesService.activos)` y esperar el primer valor no vacío (o que `load()` haya resuelto) antes de construir los orbs. El `onClick` ya navega correctamente a `/cuaquiverso/personaje/:key`.

### `inventario.service.ts` — `CHARACTERS`

Se mantiene estático. Es solo para el dropdown del form de productos y no necesita sincronizarse con Supabase.

---

## 6. Dependencias nuevas

- `@angular/cdk` (drag-drop) — agregar a `package.json`

---

## 7. Archivos a crear / modificar

### Nuevos
- `src/app/core/services/personajes.service.ts`
- `src/app/pages/admin/personajes/personajes-list.component.ts` + `.html` + `.scss`
- `src/app/pages/admin/personajes/personaje-form.component.ts` + `.html` + `.scss`
- `src/app/pages/admin/personajes/personaje-detail.component.ts` + `.html` + `.scss`
- `src/app/pages/cuaquiverso/personaje/personaje-page.component.ts` + `.html` + `.scss`

### Modificados
- `src/app/app.routes.ts` — agregar rutas admin + pública
- `src/app/pages/admin/admin-shell.component.ts` — nav contenido + crumbs
- `src/app/pages/cuaquiverso/cuaquiverso.component.ts` — inyectar PersonajesService, elenco dinámico
- `src/app/pages/cuaquiverso/universo/universo.component.ts` — inyectar PersonajesService, index + Three.js dinámicos
- `package.json` — agregar `@angular/cdk`

### Migración Supabase
- `supabase/migrations/20260603_create_personajes.sql` — CREATE TABLE + seed de los 8 personajes

---

## 8. Fuera de scope

- Autenticación pública por personaje (favoritos, follows)
- Animaciones de transición entre páginas de personaje
- Versión en inglés
- Comentarios o ratings de personajes
