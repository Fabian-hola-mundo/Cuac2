# Portafolio Redesign — Design Spec
**Fecha:** 2026-05-27
**Estado:** Aprobado, listo para implementación

---

## 1. Resumen

Rediseño completo de la sección de portafolios de Cuac Design: `portafolio-shell` (lista de proyectos) y `portafolio-detail` (detalle de proyecto). Aplica a las tres variantes temáticas: Cuac, Natalia Castañeda Caicedo y Nathali Ramírez Ortiz.

**Objetivos:**
- Hero con shader Three.js mouse-reactivo, distinto por persona
- Todos los portafolios en fondos claros (light)
- Rejilla masonry editorial con jerarquía visual clara
- Página de detalle con galería, metadata, quote, links externos y navegación entre proyectos
- Contraste WCAG AAA en texto sobre color/imagen
- UX fluida, sin cansar al usuario; el trabajo gráfico es el protagonista

---

## 2. Decisiones de diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| Fondo todos los portafolios | Light | Trabaja mejor con obra gráfica a color; no compite |
| Hero Three.js | GLSL shader fluid / orgánico | Más distintivo, GPU-only, muy fluido |
| Shader Cuac | Ember / naranja `#EC3813` sobre `#F0F1F6` | Coherencia con identidad de marca |
| Shader Natalia | Rosa cálido sobre crema `#FBF8F4` | Refleja su disciplina editorial e ilustración |
| Shader Nathali | Azul `#C0E8FD` sobre lavanda `#EEF2FD` | Refleja su disciplina UI/UX |
| Grid proyectos | Masonry 12 columnas | Jerarquía visual, proyectos featured más grandes |
| Filtros | Barra de tabs con indicador ember | Más limpio que chips, navegación más fluida |
| Detalle — links | Sección opcional "Ver en acción" | Conectar directamente con trabajo publicado |
| Detalle — siguiente proyecto | Navegación entre proyectos | UX estándar de portfolio |
| Tipografía | Manrope 800 para headings | Ya en uso, excelente en tamaño grande |

---

## 3. Design Tokens aplicables

```
Colores de fondo por tema:
  --cuac-bg:    #F0F1F6  (paper existente)
  --natalia-bg: #FBF8F4  (crema cálida)
  --nathali-bg: #EEF2FD  (lavanda fría)

Acentos por tema (ya en tokens parciales, verificar/añadir):
  --cuac-accent:    #EC3813  (ember existente)
  --natalia-accent: #C4556A
  --nathali-accent: #5C6FC7

Tipografía:
  --display: (Fauna One — headings display)
  Heading hero: Manrope 800, clamp(52px, 7vw, 100px), tracking -0.035em
  Body: Manrope 400/600, 17px, line-height 1.8
  Overlines: Manrope 700, 9-10px, tracking 0.22em, uppercase

Contraste WCAG AAA garantizado:
  #151F28 sobre #F0F1F6 → ratio ~12:1 (AAA ✓)
  #151F28 sobre #FBF8F4 → ratio ~12.5:1 (AAA ✓)
  #151F28 sobre #EEF2FD → ratio ~11.5:1 (AAA ✓)
  #F0F1F6 sobre hero cover con overlay rgba(21,31,40,0.78) → AAA ✓
```

---

## 4. Hero — `portafolio-shell`

### Estructura HTML
```
.port-hero
  canvas.shader-canvas        ← Three.js mount point
  nav.hero-nav                ← logo + back link
  .hero-content
    .hero-eyebrow             ← dot pulsante + label
    h1.hero-h1                ← nombre / "Nuestro trabajo"
    .hero-meta                ← rol + disciplinas
  .scroll-hint                ← línea animada + "Explorar"
```

### Three.js GLSL Shader

**Geometría:** `PlaneGeometry` full-viewport con `ShaderMaterial`.

**Vertex shader:** desplazamiento ondulado via `sin/cos` con `uTime` uniform para movimiento orgánico.

**Fragment shader:**
- 3 blobs de color (radial falloff gaussiano)
- Cada blob tiene: posición base, velocidad de deriva, radio, color RGBA
- `uMouse` uniform (vec2, normalizado 0-1) influye en posición de blobs vía lerp
- Composición: blobs se suman con `mix` y se multiplican contra el color de fondo
- Output mezclado con `uBgColor` para preservar el tono del fondo

**Uniforms por tema:**
```glsl
// Cuac
uBgColor:    vec3(0.941, 0.945, 0.965)  // #F0F1F6
uBlob1Color: vec3(0.925, 0.220, 0.075)  // ember
uBlob2Color: vec3(1.0,   0.510, 0.235)  // ember cálido
uBlob3Color: vec3(0.784, 0.157, 0.039)  // ember oscuro

// Natalia
uBgColor:    vec3(0.984, 0.973, 0.957)  // #FBF8F4
uBlob1Color: vec3(0.910, 0.478, 0.537)  // rosa
uBlob2Color: vec3(1.0,   0.706, 0.667)  // durazno
uBlob3Color: vec3(0.784, 0.314, 0.392)  // rosa oscuro

// Nathali
uBgColor:    vec3(0.933, 0.945, 0.992)  // #EEF2FD
uBlob1Color: vec3(0.392, 0.706, 0.941)  // azul cielo
uBlob2Color: vec3(0.627, 0.820, 0.992)  // #C0E8FD
uBlob3Color: vec3(0.275, 0.431, 0.784)  // azul medio
```

**Interacción mouse:**
- `mousemove` → actualizar `targetMouse` (vec2)
- En `requestAnimationFrame`: `currentMouse = lerp(currentMouse, targetMouse, 0.045)`
- `mouseleave` → `targetMouse` vuelve a posición de reposo `(0.5, 0.35)` lentamente

**Reduced motion:** `@media (prefers-reduced-motion: reduce)` → congelar `uTime`, desactivar lerp de mouse.

**Performance:**
- Canvas `pixelRatio = Math.min(window.devicePixelRatio, 2)`
- Destruir renderer en `ngOnDestroy`
- Resize con `ResizeObserver` (debounce 100ms)

### Dimensiones
- Cuac: `100vh`, min `560px`
- Natalia / Nathali: `80vh`, min `480px` (portafolios personales son más compactos)

### Contenido por tema
| Campo | Cuac | Natalia | Nathali |
|-------|------|---------|---------|
| eyebrow | `Estudio · Cuac Design` | `Portafolio personal` | `Portafolio personal` |
| h1 line 1 | `Nuestro` | `Natalia` | `Nathali` |
| h1 line 2 (italic, 0.7em, opacity 0.4) | `trabajo` | `Castañeda Caicedo` | `Ramírez Ortiz` |
| rol | `Cuac Design · Bogotá` | `Diseño editorial, ilustración y branding` | `Diseño UI/UX, ilustración y branding` |
| disciplinas | `Branding · Editorial · Ilustración · Web` | _(oculto)_ | _(oculto)_ |

---

## 5. Filtros — `portafolio-shell`

**Reemplaza** los chips actuales por una barra de tabs horizontal.

```html
<nav class="filter-bar" aria-label="Filtrar por categoría">
  <button class="filter-item" [class.active]="catFiltro()==='all'" aria-pressed="...">
    Todos <span class="filter-count">{{ totalCount }}</span>
  </button>
  @for (c of categorias) {
    <button class="filter-item" [class.active]="catFiltro()===c.id" aria-pressed="...">
      {{ c.label }} <span class="filter-count">{{ countFor(c.id) }}</span>
    </button>
  }
</nav>
```

**CSS:**
- Borde inferior `2px solid transparent` por defecto
- `.active`: `border-bottom-color: var(--theme-accent)`, `font-weight: 700`, color oscuro
- `overflow-x: auto; scrollbar-width: none` — scroll horizontal sin scrollbar visible
- Touch target: `min-height: 44px`, `padding: 0 20px`

---

## 6. Rejilla masonry — `portafolio-shell`

**Grid:** 12 columnas, gap `16px`.

**Patrones de span por fila** (el backend devuelve `featured: boolean`):

```
Fila con featured:
  featured → col-8, ar-landscape (4:3)
  siguiente → col-4, ar-portrait (3:4)   ← row-span-2 si hay dos

Fila estándar (3 tarjetas):
  col-4, ar-square  ×3

Fila mixta:
  col-5, ar-portrait + col-7, ar-landscape
```

El componente asigna spans en `filteredProjects = computed(...)` usando una función `assignSpans(projects[])` que alterna patrones según posición e índice.

**Responsive:**
- `≤1024px`: 6 columnas, featured → col-6, resto col-3
- `≤640px`: 1 columna, todos `col-12`

### Card

```html
<a class="port-card" [routerLink]="..." [attr.aria-label]="p.title + ' · ' + catLabel(p.category)">
  <div class="card-bg" [style.backgroundImage]="..."></div>
  <!-- Siempre visible — strip bottom -->
  <div class="card-label">
    <span class="card-cat">{{ catLabel(p.category) }}</span>
    <span class="card-title-sm">{{ p.title }}</span>
  </div>
  <!-- Hover overlay -->
  <div class="card-overlay" aria-hidden="true">
    <span class="overlay-cat">{{ catLabel(p.category) }}</span>
    <span class="overlay-title">{{ p.title }}</span>
    <span class="overlay-cta">Ver proyecto</span>
  </div>
</a>
```

**CSS card-overlay:**
- Default: `opacity: 0`
- `:hover`: `opacity: 1`
- `@media (hover: none)`: `opacity: 1` siempre (ya corregido)
- `:focus-within`: `opacity: 1` (ya corregido)
- `card-bg`: `transform: scale(1.04)` en hover, `transition: 0.5s cubic-bezier(0.25,0.46,0.45,0.94)`

---

## 7. Footer personal — `portafolio-shell` (solo Cuac)

**Estructura:** dos cards side-by-side, responsive a 1 col en `≤640px`.

Cada card:
- Fondo sólido tintado (`#FBF3F5` Natalia, `#F0F2FC` Nathali)
- `::before` pseudo-element con shader radial que aparece en `:hover`
- Tag "Portafolio personal", nombre grande Manrope 800, rol, CTA con flecha

---

## 8. Página de detalle — `portafolio-detail`

### Hero cover

```
.detail-hero
  .detail-hero-img          ← cover_url como background-image
  .detail-hero-overlay      ← gradiente doble: oscuro abajo + velo arriba
  .detail-hero-top-overlay  ← gradiente solo arriba para back-nav (AAA)
  nav.detail-back           ← ← Inicio / ← Portafolio [persona]
  .detail-hero-inner
    .detail-eyebrow
    h1.detail-h1
    p.detail-headline         ← p.headline, italic, optional
```

**Overlay:** `linear-gradient(to top, rgba(21,31,40,0.78) 0%, rgba(21,31,40,0.25) 45%, rgba(21,31,40,0.1) 70%, rgba(21,31,40,0.35) 100%)`

**Top overlay adicional:** `::after` con `linear-gradient(to bottom, rgba(21,31,40,0.45), transparent)`, `height: 180px` — garantiza contraste del back-nav.

### Body 2 columnas

```
grid-template-columns: 1fr 320px, gap: 64px
≤1024px: 1fr, sidebar inline horizontal
≤640px: 1 col, sidebar columna
```

**Columna principal:**
1. Sección "Sobre el proyecto" — `p.description` con `white-space: pre-line`
2. Sección "Galería" — grid 2 col, span-2 para imágenes impares
3. Sección "Ver en acción" — links externos (**nuevo, opcional**)
4. Navegación "Siguiente proyecto" — `nextProject` signal

**Sidebar (sticky en desktop):**
1. Meta card — categoría, cliente, equipo, disciplinas (tags)
2. Quote del cliente — `p.client_comment`, opcional

### Sección de links externos (nueva)

**Modelo de datos — campo nuevo en `portfolio_projects`:**
```typescript
interface ProjectLink {
  label: string;   // texto libre, ej: "Sitio web publicado"
  url:   string;   // URL completa
  type:  'web' | 'video' | 'behance' | 'instagram' | 'other';
}

// En PortfolioProject:
links: ProjectLink[];  // array vacío por defecto
```

**Migración Supabase:**
```sql
ALTER TABLE portfolio_projects
  ADD COLUMN links jsonb NOT NULL DEFAULT '[]'::jsonb;
```

**Iconos por tipo:**
| type | Ícono | Color de fondo |
|------|-------|----------------|
| web | 🌐 | `rgba(236,56,19,0.10)` |
| video | ▶ | `rgba(30,80,200,0.10)` |
| behance | 𝐁 | `rgba(20,100,220,0.10)` |
| instagram | ◻ | `rgba(180,40,120,0.10)` |
| other | 🔗 | `rgba(21,31,40,0.08)` |

**Comportamiento:**
- Máximo 5 links por proyecto
- Si `p.links.length === 0`, la sección no se renderiza
- Todos los links abren en `target="_blank" rel="noopener noreferrer"`
- Hover: `transform: translateX(3px)`, flecha `↗` cambia a ember

**Render:**
```html
@if (p.links.length > 0) {
  <section class="detail-section">
    <h2 class="section-overline">Ver en acción</h2>
    <div class="links-grid">
      @for (link of p.links; track link.url) {
        <a class="link-item" [href]="link.url" target="_blank" rel="noopener noreferrer">
          <div class="link-icon" [attr.data-type]="link.type">{{ linkIcon(link.type) }}</div>
          <div class="link-text">
            <span class="link-label">{{ link.label }}</span>
            <span class="link-url">{{ linkDomain(link.url) }}</span>
          </div>
          <span class="link-arrow" aria-hidden="true">↗</span>
        </a>
      }
    </div>
  </section>
}
```

### Navegación entre proyectos

`PortafolioDetailComponent` carga el proyecto anterior/siguiente del mismo autor:

```typescript
readonly nextProject = signal<PortfolioProject | null>(null);
readonly prevProject = signal<PortfolioProject | null>(null);

// En ngOnInit, después de cargar el proyecto:
const siblings = await this.portfolioSvc.getPublished(authorForTheme);
const idx = siblings.findIndex(p => p.id === current.id);
this.nextProject.set(siblings[idx + 1] ?? null);
this.prevProject.set(siblings[idx - 1] ?? null);
```

Renderizado al final de `.detail-main`, antes del footer.

### Lightbox — mejoras

- Al abrir: foco automático en botón cerrar (`lb-close.focus()` con `setTimeout 50ms`)
- Al cerrar: foco regresa al `gallery-item` que lo abrió
- `@media (hover: none)`: zoom icon siempre visible (ya corregido)

---

## 9. Admin — campo de links

En `admin-portafolio-form` (si existe) o en el componente de formulario de proyectos:

**UI del campo:**
- Lista dinámica de hasta 5 links
- Cada fila: `input[type=text]` para label + `input[type=url]` para URL + `select` para tipo + botón eliminar (×)
- Botón "Agregar link" (deshabilitado si hay 5)
- Validación: label requerido si hay URL, URL debe ser válida

---

## 10. Accesibilidad

| Elemento | Requisito |
|----------|-----------|
| Contraste texto/fondo | WCAG AAA (≥7:1) en todos los fondos light |
| Contraste text/hero cover | Overlay garantiza ≥4.5:1 en zona inferior (AA) |
| Contraste back-nav/hero | Top overlay garantiza ≥4.5:1 (AA) |
| `aria-pressed` en filtros | Sí — ya implementado |
| `aria-label` en tarjetas | Sí — `"título · categoría"` |
| Foco en lightbox | Sí — mueve a `lb-close` al abrir, regresa al trigger al cerrar |
| Touch targets | Min 44×44px en filtros, chips y botones |
| `prefers-reduced-motion` | Shader Three.js congela `uTime`, transiciones CSS desactivadas |
| Shader canvas | `aria-hidden="true"`, `role="presentation"` |
| Links externos | `rel="noopener noreferrer"`, texto descriptivo visible |

---

## 11. Archivos a crear / modificar

### Nuevos
- `src/app/pages/portafolio/shader/portfolio-shader.component.ts` — wrapper Angular para Three.js canvas
- `src/app/pages/portafolio/shader/portfolio-shader.component.scss`
- `src/assets/shaders/portfolio.vert.glsl`
- `src/assets/shaders/portfolio.frag.glsl`

### Modificados
- `src/app/core/services/portfolio.service.ts` — añadir `links: ProjectLink[]` al interface + métodos
- `src/app/pages/portafolio/portafolio-shell.component.html` — hero nuevo + filter bar nueva + grid nueva + personal footer nuevo
- `src/app/pages/portafolio/portafolio-shell.component.scss` — reescritura completa
- `src/app/pages/portafolio/portafolio-shell.component.ts` — `assignSpans()`, `countFor()`, shader theme
- `src/app/pages/portafolio/portafolio-detail.component.html` — links section + next/prev nav
- `src/app/pages/portafolio/portafolio-detail.component.scss` — actualizar hero overlay, links styles
- `src/app/pages/portafolio/portafolio-detail.component.ts` — `nextProject`, `prevProject`, `linkIcon()`, `linkDomain()`
- `src/app/pages/admin/portafolio/admin-portafolio-form.component.*` — campo links dinámico

### Supabase
- Migración: `ALTER TABLE portfolio_projects ADD COLUMN links jsonb NOT NULL DEFAULT '[]'::jsonb`
- Actualizar tipos generados

---

## 12. Orden de implementación sugerido

1. Migración Supabase + actualizar `PortfolioService` + tipos
2. `PortfolioShaderComponent` — Three.js con uniforms por tema
3. `portafolio-shell` — hero + shader integrado
4. `portafolio-shell` — filter bar + rejilla masonry + cards
5. `portafolio-shell` — footer personal
6. `portafolio-detail` — hero cover + overlay doble
7. `portafolio-detail` — body 2-col + galería + lightbox mejorado
8. `portafolio-detail` — sección links + navegación siguiente/anterior
9. Admin form — campo links dinámico
10. QA accesibilidad + `prefers-reduced-motion`
