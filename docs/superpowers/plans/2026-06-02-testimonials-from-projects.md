# Testimonios anclados a proyectos del portafolio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La sección "Lo que dicen" del home carga testimonios reales desde los proyectos del portafolio que tengan `show_testimonial = true`, con un máximo de 3 activos simultáneamente.

**Architecture:** Se agregan 3 columnas a `portfolio_projects` en Supabase (`client_person`, `client_role`, `show_testimonial`), un nuevo método `getTestimonials()` + `countActiveTestimonials()` en `PortfolioService`, 3 campos nuevos en el form admin, y `TestimonialsComponent` pasa a ser async con signals.

**Tech Stack:** Angular 17+ (signals, `@if`, standalone components), Supabase (PostgreSQL), TypeScript

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| Supabase SQL | Migración | Agregar 3 columnas |
| `src/app/core/services/portfolio.service.ts` | Modificar | Interface + 2 métodos nuevos |
| `src/app/pages/admin/portafolio/admin-portafolio-form.component.ts` | Modificar | 3 FormControls + validación máx 3 |
| `src/app/pages/admin/portafolio/admin-portafolio-form.component.html` | Modificar | 3 campos nuevos en UI |
| `src/app/pages/home/sections/testimonials/testimonials.component.ts` | Modificar | Async, signals, mapeo desde DB |
| `src/app/pages/home/sections/testimonials/testimonials.component.html` | Modificar | `@if` loading/vacío |

---

## Task 1: Migración Supabase

**Files:**
- Supabase dashboard → SQL Editor

- [ ] **Step 1: Ejecutar la migración en Supabase**

En el dashboard de Supabase → SQL Editor, ejecutar:

```sql
ALTER TABLE portfolio_projects
  ADD COLUMN IF NOT EXISTS client_person    text,
  ADD COLUMN IF NOT EXISTS client_role      text,
  ADD COLUMN IF NOT EXISTS show_testimonial boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Verificar columnas**

En Supabase → Table Editor → `portfolio_projects`, confirmar que aparecen las tres nuevas columnas con sus tipos correctos.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "feat(db): add client_person, client_role, show_testimonial to portfolio_projects"
```

---

## Task 2: Actualizar `PortfolioService`

**Files:**
- Modify: `src/app/core/services/portfolio.service.ts`

- [ ] **Step 1: Agregar campos al interface `PortfolioProject`**

En `portfolio.service.ts`, dentro del interface `PortfolioProject` (línea ~43), agregar después de `client_comment`:

```ts
export interface PortfolioProject {
  id:               string;
  title:            string;
  slug:             string;
  category:         string;
  authors:          string[];
  headline:         string | null;
  client_name:      string | null;
  description:      string | null;
  client_comment:   string | null;
  client_person:    string | null;   // ← nuevo
  client_role:      string | null;   // ← nuevo
  show_testimonial: boolean;          // ← nuevo
  cover_url:        string | null;
  images:           string[];
  tags:             string[];
  links:            ProjectLink[];
  featured:         boolean;
  published:        boolean;
  created_at:       string;
}
```

- [ ] **Step 2: Agregar `getTestimonials()` al servicio**

Al final de la clase `PortfolioService`, antes del cierre `}`, agregar:

```ts
async getTestimonials(): Promise<PortfolioProject[]> {
  const { data, error } = await this.sb.db
    .from('portfolio_projects')
    .select('*')
    .eq('published', true)
    .eq('show_testimonial', true)
    .not('client_comment', 'is', null)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) console.error('[portfolio] getTestimonials:', error.message);
  return (data ?? []) as PortfolioProject[];
}
```

- [ ] **Step 3: Agregar `countActiveTestimonials()` al servicio**

Inmediatamente después de `getTestimonials()`:

```ts
async countActiveTestimonials(excludeId?: string): Promise<number> {
  let q = this.sb.db
    .from('portfolio_projects')
    .select('id', { count: 'exact', head: true })
    .eq('show_testimonial', true);
  if (excludeId) q = (q as any).neq('id', excludeId);
  const { count, error } = await q;
  if (error) console.error('[portfolio] countActiveTestimonials:', error.message);
  return count ?? 0;
}
```

- [ ] **Step 4: Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Esperado: sin errores de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/portfolio.service.ts
git commit -m "feat(portfolio): add client_person/role/show_testimonial to interface + getTestimonials + countActiveTestimonials"
```

---

## Task 3: Actualizar el form admin (TypeScript)

**Files:**
- Modify: `src/app/pages/admin/portafolio/admin-portafolio-form.component.ts`

- [ ] **Step 1: Agregar signal de error para testimonial y señal de carga del conteo**

Dentro de la clase `AdminPortafolioFormComponent`, después de `readonly errorMsg = signal<string | null>(null);`, agregar:

```ts
readonly testimonialError = signal<string | null>(null);
```

- [ ] **Step 2: Agregar los 3 nuevos FormControls al form group**

Reemplazar la definición del `form` existente:

```ts
form = this.fb.group({
  title:            ['', [Validators.required, Validators.minLength(2)]],
  slug:             ['', [Validators.required]],
  category:         ['branding', Validators.required],
  headline:         [''],
  client_name:      [''],
  client_person:    [''],
  client_role:      [''],
  description:      [''],
  client_comment:   [''],
  show_testimonial: [false],
  featured:         [false],
  published:        [false],
});
```

- [ ] **Step 3: Agregar `patchValue` de los 3 campos nuevos en `ngOnInit`**

Dentro del bloque `if (p)` del `ngOnInit`, en el `this.form.patchValue({ ... })`, agregar los 3 campos nuevos:

```ts
this.form.patchValue({
  title:            p.title,
  slug:             p.slug,
  category:         p.category,
  headline:         p.headline ?? '',
  client_name:      p.client_name ?? '',
  client_person:    p.client_person ?? '',
  client_role:      p.client_role ?? '',
  description:      p.description ?? '',
  client_comment:   p.client_comment ?? '',
  show_testimonial: p.show_testimonial,
  featured:         p.featured,
  published:        p.published,
});
```

- [ ] **Step 4: Agregar handler de validación del toggle `show_testimonial`**

Después del método `toggleAuthor()`, agregar:

```ts
async onShowTestimonialChange(checked: boolean) {
  this.testimonialError.set(null);
  if (!checked) return;
  const count = await this.portfolio.countActiveTestimonials(this.editId() ?? undefined);
  if (count >= 3) {
    this.form.patchValue({ show_testimonial: false });
    this.testimonialError.set('Ya tienes 3 testimonios activos. Desactiva uno antes de agregar otro.');
  }
}
```

- [ ] **Step 5: Agregar los 3 campos nuevos al payload en `guardar()`**

Dentro del método `guardar()`, en el objeto `payload`, agregar los 3 campos después de `client_comment`:

```ts
const payload = {
  title:            v.title!,
  slug,
  category:         v.category!,
  authors:          this.selectedAuthors(),
  headline:         v.headline || null,
  client_name:      v.client_name || null,
  client_person:    v.client_person || null,
  client_role:      v.client_role || null,
  description:      v.description || null,
  client_comment:   v.client_comment || null,
  show_testimonial: v.show_testimonial ?? false,
  cover_url:        coverUrl,
  images,
  tags:             this.tags(),
  links:            this.cleanLinks(),
  featured:         v.featured ?? false,
  published:        v.published ?? false,
};
```

- [ ] **Step 6: Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Esperado: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/admin/portafolio/admin-portafolio-form.component.ts
git commit -m "feat(admin): add client_person, client_role, show_testimonial to portafolio form TS"
```

---

## Task 4: Actualizar el form admin (HTML)

**Files:**
- Modify: `src/app/pages/admin/portafolio/admin-portafolio-form.component.html`

- [ ] **Step 1: Agregar campo `client_person` después de `client_name`**

Localizar el campo `client_name` (línea ~54-58) y agregar inmediatamente después:

```html
<div class="field">
  <label>Persona de contacto <span class="opt">opcional</span></label>
  <input class="input" formControlName="client_person"
    placeholder="Nombre y apellido" />
  <span class="help">Nombre que aparece en el testimonio.</span>
</div>

<div class="field">
  <label>Cargo <span class="opt">opcional</span></label>
  <input class="input" formControlName="client_role"
    placeholder="Fundadora · Marca de skincare" />
</div>
```

- [ ] **Step 2: Agregar toggle `show_testimonial` en la grid de toggles**

Localizar el bloque `<div class="grid-2">` con los toggles Destacado y Publicado y agregar el tercero:

```html
<div class="grid-2">
  <div class="field inv-toggle-row">
    <label>Destacado</label>
    <label class="inv-toggle">
      <input type="checkbox" formControlName="featured" />
      <span class="inv-slider"></span>
    </label>
  </div>
  <div class="field inv-toggle-row">
    <label>Publicado</label>
    <label class="inv-toggle">
      <input type="checkbox" formControlName="published" />
      <span class="inv-slider"></span>
    </label>
  </div>
  <div class="field inv-toggle-row">
    <label>En testimonios</label>
    <label class="inv-toggle">
      <input type="checkbox" formControlName="show_testimonial"
        (change)="onShowTestimonialChange($any($event.target).checked)" />
      <span class="inv-slider"></span>
    </label>
  </div>
</div>
@if (testimonialError()) {
  <p style="font-size:13px;color:var(--terra);margin-top:calc(var(--s-3)*-1);margin-bottom:var(--s-4)">
    {{ testimonialError() }}
  </p>
}
```

- [ ] **Step 3: Verificar en el browser**

Iniciar el servidor de desarrollo:
```bash
npx ng serve
```

Ir a `http://localhost:4200/admin/portafolio/nuevo`. Verificar que:
- Aparecen los campos "Persona de contacto" y "Cargo" después de "Cliente"
- Aparece el toggle "En testimonios" en la grid junto a Destacado/Publicado
- Al activar "En testimonios" en 4 proyectos distintos, el 4° muestra el error y no se activa

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/admin/portafolio/admin-portafolio-form.component.html
git commit -m "feat(admin): add client_person, client_role, show_testimonial fields to portafolio form UI"
```

---

## Task 5: Actualizar `TestimonialsComponent`

**Files:**
- Modify: `src/app/pages/home/sections/testimonials/testimonials.component.ts`
- Modify: `src/app/pages/home/sections/testimonials/testimonials.component.html`

- [ ] **Step 1: Reescribir `testimonials.component.ts`**

Reemplazar el contenido completo del archivo:

```ts
import { Component, OnInit, signal, inject } from '@angular/core';
import { PortfolioService } from '../../../core/services/portfolio.service';

interface TestimonialDisplay {
  quote:       string;
  name:        string;
  role:        string;
  initials:    string;
  avatarBg:    string;
  avatarColor: string;
}

const AVATAR_PALETTE: Array<{ bg: string; color: string }> = [
  { bg: 'var(--ember)', color: 'white'           },
  { bg: 'var(--deep)',  color: 'white'           },
  { bg: 'var(--coral)', color: 'var(--carbon)'   },
];

function toInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

@Component({
  selector: 'app-testimonials',
  standalone: true,
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.scss',
})
export class TestimonialsComponent implements OnInit {
  private portfolio = inject(PortfolioService);

  readonly loading      = signal(true);
  readonly testimonials = signal<TestimonialDisplay[]>([]);

  async ngOnInit() {
    const projects = await this.portfolio.getTestimonials();
    const mapped: TestimonialDisplay[] = projects.map((p, i) => {
      const palette = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
      return {
        quote:       p.client_comment!,
        name:        p.client_person ?? p.client_name ?? '',
        role:        p.client_role ?? '',
        initials:    toInitials(p.client_person ?? p.client_name),
        avatarBg:    palette.bg,
        avatarColor: palette.color,
      };
    });
    this.testimonials.set(mapped);
    this.loading.set(false);
  }
}
```

- [ ] **Step 2: Actualizar `testimonials.component.html`**

Reemplazar el contenido completo del archivo:

```html
@if (!loading() && testimonials().length > 0) {
  <div class="section" id="testi">
    <div class="eyebrow"><span class="dot"></span> 05 &mdash; Lo que dicen</div>
    <h2 class="h-section">Equipos que <em>volvieron</em> a trabajar con nosotros.</h2>

    <div class="testi-layout">
      @if (testimonials()[0]) {
        <article class="testi-featured">
          <p class="q-featured">{{ testimonials()[0].quote }}</p>
          <div class="a">
            <div class="av" [style.background]="testimonials()[0].avatarBg" [style.color]="testimonials()[0].avatarColor">{{ testimonials()[0].initials }}</div>
            <div class="a-meta">
              <div class="n">{{ testimonials()[0].name }}</div>
              <div class="r">{{ testimonials()[0].role }}</div>
            </div>
          </div>
        </article>
      }

      <div class="testi-secondary">
        @for (t of testimonials().slice(1); track t.name) {
          <article class="testi">
            <p class="q">{{ t.quote }}</p>
            <div class="a">
              <div class="av" [style.background]="t.avatarBg" [style.color]="t.avatarColor">{{ t.initials }}</div>
              <div class="a-meta">
                <div class="n">{{ t.name }}</div>
                <div class="r">{{ t.role }}</div>
              </div>
            </div>
          </article>
        }
      </div>
    </div>
  </div>
}
```

- [ ] **Step 3: Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Esperado: sin errores.

- [ ] **Step 4: Verificar en el browser**

Con `npx ng serve` activo, ir a `http://localhost:4200`:

- Si no hay proyectos con `show_testimonial = true`: la sección "Lo que dicen" no aparece — correcto.
- Activar `show_testimonial` en 1 proyecto con `client_comment` desde el admin (`/admin/portafolio/<id>/editar`), guardar, refrescar el home: la sección aparece con 1 testimonio en `testi-featured` y la columna secundaria vacía.
- Activar 2 proyectos más (total 3): los 3 aparecen — el primero como featured, los otros 2 en secondary.
- Intentar activar un 4°: el toggle no se activa y aparece el mensaje de error.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/home/sections/testimonials/testimonials.component.ts \
        src/app/pages/home/sections/testimonials/testimonials.component.html
git commit -m "feat(home): testimonials load from portfolio projects via getTestimonials()"
```

---

## Verificación final

- [ ] Home con 0 testimonios activos: sección oculta, no hay flash de layout
- [ ] Home con 1 testimonio: sección visible, featured con columna secondary vacía
- [ ] Home con 3 testimonios: layout completo (1 featured + 2 secondary)
- [ ] Admin: guardar un proyecto con `show_testimonial = true` y todos los campos llenos — datos aparecen correctamente en home
- [ ] Admin: intentar activar 4° testimonio → error inline, toggle revertido
- [ ] Admin edición: editar un proyecto que ya tiene `show_testimonial = true` no dispara el error de límite
