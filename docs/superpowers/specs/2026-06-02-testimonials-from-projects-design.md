# Spec: Testimonios anclados a proyectos del portafolio

**Fecha:** 2026-06-02
**Estado:** Aprobado

## Objetivo

La sección "Lo que dicen" (05) del home debe mostrar testimonios reales extraídos del campo `client_comment` de los proyectos del portafolio. El admin controla qué proyectos aparecen como testimonios mediante un toggle explícito.

---

## 1. Cambios de schema — Supabase

Tres columnas nuevas en la tabla `portfolio_projects`:

```sql
ALTER TABLE portfolio_projects
  ADD COLUMN client_person    text,
  ADD COLUMN client_role      text,
  ADD COLUMN show_testimonial boolean NOT NULL DEFAULT false;
```

- `client_person`: nombre de la persona de contacto (ej. "Mariana Restrepo")
- `client_role`: cargo y empresa (ej. "Fundadora · Marca de skincare")
- `show_testimonial`: toggle explícito — solo los proyectos con este flag en `true` y `published = true` aparecen en la sección

---

## 2. Interface `PortfolioProject` (`portfolio.service.ts`)

Agregar los tres campos al interface existente:

```ts
client_person:    string | null;
client_role:      string | null;
show_testimonial: boolean;
```

---

## 3. Nuevo método `getTestimonials()` en `PortfolioService`

```ts
async getTestimonials(): Promise<PortfolioProject[]>
```

- Filtra: `published = true` AND `show_testimonial = true`
- Solo retorna proyectos que tengan `client_comment` no nulo y no vacío
- Orden: `featured DESC`, `created_at DESC`
- No expone proyectos no publicados

---

## 4. Formulario admin (`admin-portafolio-form.component`)

### Campos nuevos en el formulario reactivo

| Campo | Control | Tipo | Posición |
|---|---|---|---|
| `client_person` | `FormControl<string>` | input text | Después de `client_name` |
| `client_role` | `FormControl<string>` | input text | Después de `client_person` |
| `show_testimonial` | `FormControl<boolean>` | toggle | Grid de toggles junto a Destacado / Publicado |

### Labels y ayuda

- `client_person`: "Persona de contacto" — placeholder "Nombre y apellido"
- `client_role`: "Cargo" — placeholder "Fundadora · Marca de skincare"
- `show_testimonial`: "En testimonios"

### Validación

- El toggle `show_testimonial` solo tiene efecto si `client_comment` tiene contenido (sin bloqueo en UI — el admin es responsable).
- **Máximo 3 proyectos con `show_testimonial = true`** simultáneamente. Al intentar activar el toggle en un cuarto proyecto, se muestra un mensaje de error inline: "Ya tienes 3 testimonios activos. Desactiva uno antes de agregar otro." El toggle no se activa.
- La validación se hace en el frontend al momento del toggle: el form consulta cuántos proyectos tienen `show_testimonial = true` (excluyendo el proyecto actual si es edición) y bloquea si ya hay 3.

---

## 5. `TestimonialsComponent`

### Fuente de datos

Reemplaza el array hardcodeado por una llamada a `PortfolioService.getTestimonials()` ejecutada en `ngOnInit`.

### Modelo de display (interno al componente)

```ts
interface TestimonialDisplay {
  quote:       string;
  name:        string;
  role:        string;
  initials:    string;
  avatarBg:    string;
  avatarColor: string;
}
```

### Mapeo desde `PortfolioProject`

| Campo proyecto | Campo display | Derivación |
|---|---|---|
| `client_comment` | `quote` | Directo |
| `client_person` | `name` | Directo (fallback: `client_name ?? ''`) |
| `client_role` | `role` | Directo (fallback: `''`) |
| `client_person` | `initials` | Primera letra de cada palabra, máx 2 letras |
| índice en array | `avatarBg` | Ciclo: índice 0→`var(--ember)`, 1→`var(--deep)`, 2→`var(--coral)`, luego repite |
| `avatarBg` | `avatarColor` | ember→`white`, deep→`white`, coral→`var(--carbon)` |

### Comportamiento vacío

Si `getTestimonials()` retorna un array vacío, la sección completa se oculta con `@if (testimonials().length > 0)`.

### Estado de carga

El componente usa una signal `loading = signal(true)` que se pone en `false` al resolverse la promesa. Mientras `loading()` es true, la sección no renderiza (evita flash de sección vacía).

---

## 6. Archivos modificados

| Archivo | Cambio |
|---|---|
| Supabase (migration SQL) | Agregar 3 columnas |
| `portfolio.service.ts` | Interface + `getTestimonials()` |
| `admin-portafolio-form.component.ts` | 3 nuevos FormControls |
| `admin-portafolio-form.component.html` | 3 nuevos campos en UI |
| `testimonials.component.ts` | Async, signals, mapeo |
| `testimonials.component.html` | `@if` para loading/vacío |

---

## 7. Fuera de alcance

- Ningún cambio a la tabla `portfolio_achievements` ni `portfolio_profiles`
- No se agrega ordenamiento manual de testimonios (se usa el orden del portafolio)
- No se valida que `client_comment` tenga contenido antes de activar `show_testimonial`
