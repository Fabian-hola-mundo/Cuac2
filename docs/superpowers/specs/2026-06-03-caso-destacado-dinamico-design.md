# Spec: Caso destacado dinámico

**Fecha:** 2026-06-03  
**Estado:** Aprobado

## Contexto

La sección "Caso destacado" (`app-case-study`) del home principal tiene contenido completamente hardcodeado. El portafolio de Cuac ya está gestionado desde `/admin` en Supabase (`portfolio_projects`). El objetivo es que esta sección muestre automáticamente el proyecto de Cuac más reciente marcado como `featured: true`.

## Alcance

- Modificar `PortfolioService` para agregar `getFeatured(author)`
- Refactorizar `CaseStudyComponent` para cargar datos dinámicamente
- Reemplazar el panel visual decorativo por un collage real de imágenes del proyecto
- El botón "Ver el caso completo" navega a `/portafolio/:slug`

Fuera de alcance: cambios en el modelo de datos, lógica de admin, otros componentes del home.

---

## 1. Servicio — `PortfolioService.getFeatured`

Nuevo método en `src/app/core/services/portfolio.service.ts`:

```ts
async getFeatured(author: PortfolioOwner): Promise<PortfolioProject | null>
```

Consulta:
- Tabla: `portfolio_projects`
- Filtros: `featured = true`, `published = true`, `authors contains [author]`
- Orden: `created_at DESC`
- Límite: 1

Devuelve el proyecto o `null` si no existe ninguno que cumpla los filtros.

---

## 2. `CaseStudyComponent` — lógica

**Archivo:** `src/app/pages/home/sections/case-study/case-study.component.ts`

Cambios:
- Implementa `OnInit`
- Inyecta `PortfolioService`
- Importa `RouterLink`, `CommonModule`
- Señales:
  - `project = signal<PortfolioProject | null>(null)`
  - `cargando = signal(true)`
- `ngOnInit`: llama `getFeatured('cuac')`, setea señales
- Getter helper `allImages()`: `[project.cover_url, ...project.images].filter(Boolean).slice(0, 5)`
- Getter `categoryLabel()`: mapea `project.category` a label vía `PORTFOLIO_CATEGORIES`

**Comportamiento si no hay proyecto destacado:**  
La sección entera no se renderiza (`@if (project())`). No se muestra placeholder ni estado de error.

---

## 3. Template — contenido dinámico

**Archivo:** `src/app/pages/home/sections/case-study/case-study.component.html`

| Campo actual | Fuente |
|---|---|
| `h2` hardcoded | `project().title` |
| `p` hardcoded | `project().headline ?? project().description` |
| Stat 1 (Duración → Categoría) | `categoryLabel()`, label "Categoría" |
| Stat 2 (Entregables → Cliente) | `project().client_name`, label "Cliente" |
| Stat 3 (Rondas → Disciplinas) | `project().tags.slice(0,3).join(' · ')`, label "Disciplinas" |
| Enlace mailto | `routerLink="/portafolio/{{ project().slug }}"` |

Stats omitidos si el campo es null/vacío (ej. no mostrar "Cliente" si `client_name` es null).

---

## 4. Collage de imágenes

**Reemplaza** el bloque `.case-vis` decorativo actual.

**Fuente de imágenes:**
```
[project.cover_url, ...project.images].filter(Boolean).slice(0, 5)
```

**Layouts según cantidad de imágenes:**

| N° imágenes | Layout grid |
|---|---|
| 0 | Panel derecho oculto; texto ocupa ancho completo |
| 1 | Una celda grande (100% del panel) |
| 2–3 | Dos columnas simples; primera imagen más alta |
| 4–5 | Grid asimétrico 2×2+1: imagen grande arriba-izquierda, resto en celdas menores |

Todas las imágenes usan `object-fit: cover`, `border-radius: var(--r-md)`.  
No hay lightbox ni interacción — es decorativo/narrativo.

**Si el proyecto no tiene imágenes (cover_url null e images vacío):**  
El panel derecho se oculta completamente y la columna de texto toma el ancho completo del grid.

---

## 5. Routing

El enlace "Ver el caso completo" pasa de `mailto:` a:
```html
<a class="case-link" [routerLink]="['/portafolio', project().slug]">
  Ver el caso completo <span aria-hidden="true">→</span>
</a>
```

---

## Criterios de éxito

1. Con un proyecto de Cuac marcado `featured=true` y `published=true`, la sección muestra sus datos reales
2. Al cambiar el proyecto destacado en `/admin`, el home lo refleja en el siguiente load
3. Si no hay ningún proyecto destacado, la sección no aparece
4. El botón navega correctamente a `/portafolio/:slug`
5. El collage muestra entre 1 y 5 imágenes según disponibilidad
6. El build compila sin errores
