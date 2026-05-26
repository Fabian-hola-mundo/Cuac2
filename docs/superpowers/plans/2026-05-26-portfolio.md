# Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un módulo de portafolio público (Cuac + Natalia + Nathali) y un admin CRUD de proyectos conectado a Supabase.

**Architecture:** Una tabla Supabase `portfolio_projects` con campo `authors[]` permite que un proyecto aparezca en uno o varios portafolios. Un único `PortafolioShellComponent` parametrizado por `theme` (`cuac | natalia | nathali`) vía route data maneja las tres páginas públicas. El admin sigue el mismo patrón list+form que el módulo de inventario existente.

**Tech Stack:** Angular 17+ standalone, SCSS con CSS custom properties, Supabase JS v2, Supabase Storage para imágenes, ReactiveFormsModule para el formulario admin.

**Spec:** `docs/superpowers/specs/2026-05-26-portfolio-design.md`

---

## File Map

**Archivos nuevos:**
- `src/app/core/services/portfolio.service.ts`
- `src/app/pages/portafolio/portafolio-shell.component.ts`
- `src/app/pages/portafolio/portafolio-shell.component.html`
- `src/app/pages/portafolio/portafolio-shell.component.scss`
- `src/app/pages/admin/portafolio/admin-portafolio-list.component.ts`
- `src/app/pages/admin/portafolio/admin-portafolio-list.component.html`
- `src/app/pages/admin/portafolio/admin-portafolio-list.component.scss`
- `src/app/pages/admin/portafolio/admin-portafolio-form.component.ts`
- `src/app/pages/admin/portafolio/admin-portafolio-form.component.html`
- `src/app/pages/admin/portafolio/admin-portafolio-form.component.scss`

**Archivos modificados:**
- `src/styles/_tokens.scss` — tokens `[data-theme]`
- `src/app/app.routes.ts` — 5 rutas nuevas
- `src/app/pages/admin/admin-shell.component.ts` — `isPortafolioRoute`, `goPortafolio()`, crumbs
- `src/app/pages/admin/admin-shell.component.html` — nav entry "Portafolio"
- `src/app/layout/topbar/topbar.component.html` — link "Portafolio"
- `src/app/pages/home/sections/hero/hero.component.html` — botón "Ver portafolio"
- `src/app/layout/footer/footer.component.html` — link "Portafolio"

---

## Task 1: Supabase — Tabla, RLS y Storage bucket

**Files:**
- No hay archivos de código. Ejecutar SQL en el dashboard de Supabase (SQL Editor).

- [ ] **Step 1: Crear la tabla `portfolio_projects`**

Abrir Supabase Dashboard → SQL Editor → pegar y ejecutar:

```sql
CREATE TABLE IF NOT EXISTS portfolio_projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  slug        text UNIQUE NOT NULL,
  category    text NOT NULL,
  authors     text[] NOT NULL DEFAULT '{}',
  description text,
  cover_url   text,
  images      text[] NOT NULL DEFAULT '{}',
  tags        text[] NOT NULL DEFAULT '{}',
  featured    boolean NOT NULL DEFAULT false,
  published   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Habilitar RLS y crear políticas**

```sql
ALTER TABLE portfolio_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolio_public_read"
  ON portfolio_projects FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY "portfolio_auth_all"
  ON portfolio_projects FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 3: Crear el bucket de Storage**

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "portfolio_storage_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'portfolio');

CREATE POLICY "portfolio_storage_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'portfolio');

CREATE POLICY "portfolio_storage_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'portfolio');

CREATE POLICY "portfolio_storage_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'portfolio');
```

- [ ] **Step 4: Verificar**

En Supabase Dashboard → Table Editor: debe aparecer `portfolio_projects`.
En Storage: debe aparecer el bucket `portfolio` marcado como público.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-05-26-portfolio.md
git commit -m "chore: add portfolio implementation plan"
```

---

## Task 2: PortfolioService

**Files:**
- Create: `src/app/core/services/portfolio.service.ts`

- [ ] **Step 1: Crear el servicio**

```typescript
// src/app/core/services/portfolio.service.ts
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface PortfolioProject {
  id: string;
  title: string;
  slug: string;
  category: string;
  authors: string[];
  description: string | null;
  cover_url: string | null;
  images: string[];
  tags: string[];
  featured: boolean;
  published: boolean;
  created_at: string;
}

export type ProjectPayload = Omit<PortfolioProject, 'id' | 'created_at'>;

export const PORTFOLIO_CATEGORIES = [
  { id: 'branding',    label: 'Branding'    },
  { id: 'identidad',   label: 'Identidad'   },
  { id: 'editorial',   label: 'Editorial'   },
  { id: 'packaging',   label: 'Packaging'   },
  { id: 'ilustración', label: 'Ilustración' },
  { id: 'web',         label: 'Web'         },
  { id: 'motion',      label: 'Motion'      },
  { id: 'ux-ui',       label: 'UX/UI'       },
];

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private sb = inject(SupabaseService);

  async getPublished(author?: string): Promise<PortfolioProject[]> {
    let q = this.sb.db
      .from('portfolio_projects')
      .select('*')
      .eq('published', true)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });
    if (author) q = (q as any).contains('authors', [author]);
    const { data } = await q;
    return (data ?? []) as PortfolioProject[];
  }

  async getAll(): Promise<PortfolioProject[]> {
    const { data } = await this.sb.db
      .from('portfolio_projects')
      .select('*')
      .order('created_at', { ascending: false });
    return (data ?? []) as PortfolioProject[];
  }

  async getById(id: string): Promise<PortfolioProject | null> {
    const { data } = await this.sb.db
      .from('portfolio_projects')
      .select('*')
      .eq('id', id)
      .single();
    return data as PortfolioProject | null;
  }

  async create(payload: ProjectPayload): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await this.sb.db
      .from('portfolio_projects')
      .insert(payload)
      .select('id')
      .single();
    return { id: (data as any)?.id ?? null, error: error?.message ?? null };
  }

  async update(id: string, payload: Partial<ProjectPayload>): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('portfolio_projects')
      .update(payload)
      .eq('id', id);
    return { error: error?.message ?? null };
  }

  async remove(id: string): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('portfolio_projects')
      .delete()
      .eq('id', id);
    return { error: error?.message ?? null };
  }

  async uploadImage(slug: string, file: File, name: string): Promise<string | null> {
    const path = `${slug}/${name}`;
    const { error } = await this.sb.db.storage
      .from('portfolio')
      .upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = this.sb.db.storage
      .from('portfolio')
      .getPublicUrl(path);
    return data.publicUrl;
  }
}
```

- [ ] **Step 2: Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Esperado: sin errores de TypeScript. Si hay error de `contains` en Supabase types, el cast `(q as any)` ya lo evita.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/portfolio.service.ts
git commit -m "feat: add PortfolioService with Supabase CRUD and Storage upload"
```

---

## Task 3: Tokens CSS de tema

**Files:**
- Modify: `src/styles/_tokens.scss`

- [ ] **Step 1: Añadir los bloques `[data-theme]` al final del archivo**

Abrir `src/styles/_tokens.scss` y añadir al final (después de la llave de cierre de `:root`):

```scss
[data-theme="cuac"] {
  --theme-primary: #011E54;
  --theme-accent:  #EC3813;
  --theme-surface: #F0F1F6;
  --theme-on-primary: #FAFAFB;
}

[data-theme="natalia"] {
  --theme-primary: #E87A89;
  --theme-accent:  #C4556A;
  --theme-surface: #FDEEF0;
  --theme-on-primary: #FAFAFB;
}

[data-theme="nathali"] {
  --theme-primary: #8B9ED9;
  --theme-accent:  #5C6FC7;
  --theme-surface: #EEF0FA;
  --theme-on-primary: #FAFAFB;
}
```

- [ ] **Step 2: Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | tail -10
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/styles/_tokens.scss
git commit -m "feat: add data-theme CSS custom property tokens for portfolio themes"
```

---

## Task 4: PortafolioShellComponent (páginas públicas)

**Files:**
- Create: `src/app/pages/portafolio/portafolio-shell.component.ts`
- Create: `src/app/pages/portafolio/portafolio-shell.component.html`
- Create: `src/app/pages/portafolio/portafolio-shell.component.scss`

- [ ] **Step 1: Crear el directorio**

```bash
mkdir src\app\pages\portafolio
```

- [ ] **Step 2: Crear el componente TypeScript**

```typescript
// src/app/pages/portafolio/portafolio-shell.component.ts
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  PortfolioService,
  PortfolioProject,
  PORTFOLIO_CATEGORIES,
} from '../../core/services/portfolio.service';

type Theme = 'cuac' | 'natalia' | 'nathali';

const HERO_DATA: Record<Theme, { name: string; role: string; tagline: string }> = {
  cuac: {
    name: 'Nuestro trabajo',
    role: 'Cuac Design · Bogotá',
    tagline: 'Branding, diseño editorial, ilustración y diseño digital.',
  },
  natalia: {
    name: 'Natalia Castañeda Caicedo',
    role: 'Diseño editorial, ilustración y branding',
    tagline: 'tagline provisional',
  },
  nathali: {
    name: 'Nathali Ramírez Ortiz',
    role: 'Diseño UI/UX, ilustración y branding',
    tagline: 'tagline provisional',
  },
};

@Component({
  selector: 'app-portafolio-shell',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portafolio-shell.component.html',
  styleUrl: './portafolio-shell.component.scss',
  host: { '[attr.data-theme]': 'theme' },
})
export class PortafolioShellComponent implements OnInit {
  private portfolioSvc = inject(PortfolioService);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);

  theme: Theme = 'cuac';
  readonly categorias = PORTFOLIO_CATEGORIES;
  readonly cargando   = signal(false);
  readonly projects   = signal<PortfolioProject[]>([]);
  readonly catFiltro  = signal<string>('all');

  get hero() { return HERO_DATA[this.theme]; }
  get isCuac() { return this.theme === 'cuac'; }

  filteredProjects = computed(() => {
    const cat  = this.catFiltro();
    const list = this.projects();
    return cat === 'all' ? list : list.filter(p => p.category === cat);
  });

  async ngOnInit() {
    this.theme = (this.route.snapshot.data['theme'] as Theme) ?? 'cuac';
    this.cargando.set(true);
    const data = await this.portfolioSvc.getPublished(this.theme);
    this.projects.set(data);
    this.cargando.set(false);
  }
}
```

- [ ] **Step 3: Crear el template HTML**

```html
<!-- src/app/pages/portafolio/portafolio-shell.component.html -->
<div class="port-hero">
  <div class="port-hero-inner">
    @if (!isCuac) {
      <a class="back-link" routerLink="/portafolio">← Cuac Design</a>
    }
    <div class="eyebrow">
      <span class="pulse"></span>
      {{ isCuac ? 'Estudio · Cuac Design' : 'Portafolio personal' }}
    </div>
    <h1>{{ hero.name }}</h1>
    <p class="hero-role">{{ hero.role }}</p>
    <em class="hero-tagline">{{ hero.tagline }}</em>
  </div>
</div>

<div class="port-content">

  <div class="chips">
    <button class="chip" [class.is-on]="catFiltro() === 'all'" (click)="catFiltro.set('all')">
      Todos
    </button>
    @for (c of categorias; track c.id) {
      <button class="chip" [class.is-on]="catFiltro() === c.id" (click)="catFiltro.set(c.id)">
        {{ c.label }}
      </button>
    }
  </div>

  @if (cargando()) {
    <p class="port-loading">Cargando proyectos…</p>
  }

  @if (!cargando() && filteredProjects().length > 0) {
    <div class="port-grid">
      @for (p of filteredProjects(); track p.id) {
        <article class="port-card" [class.is-featured]="p.featured">
          <div
            class="port-card-cover"
            [class.has-image]="!!p.cover_url"
            [style.backgroundImage]="p.cover_url ? 'url(' + p.cover_url + ')' : null">
            <div class="port-card-foot">
              <span class="port-card-cat">{{ p.category }}</span>
              <strong class="port-card-title">{{ p.title }}</strong>
            </div>
          </div>
        </article>
      }
    </div>
  }

  @if (!cargando() && filteredProjects().length === 0) {
    <div class="port-empty">
      <p>Sin proyectos en esta categoría aún.</p>
    </div>
  }

  @if (isCuac) {
    <div class="personal-footer">
      <p class="pf-label">El equipo también tiene voz propia.</p>
      <div class="pf-grid">
        <a class="pf-card pf-natalia" routerLink="/portafolio/natalia">
          <strong>Natalia Castañeda Caicedo</strong>
          <span>Diseño editorial, ilustración y branding</span>
          <span class="pf-link">Ver portafolio →</span>
        </a>
        <a class="pf-card pf-nathali" routerLink="/portafolio/nathali">
          <strong>Nathali Ramírez Ortiz</strong>
          <span>Diseño UI/UX, ilustración y branding</span>
          <span class="pf-link">Ver portafolio →</span>
        </a>
      </div>
    </div>
  }

</div>
```

- [ ] **Step 4: Crear los estilos SCSS**

```scss
// src/app/pages/portafolio/portafolio-shell.component.scss
:host { display: block; }

// ── Hero ──────────────────────────────────────────────────────────────────────
.port-hero {
  background: var(--deep);
  color: var(--paper);
  padding: var(--s-10) var(--s-7) var(--s-8);

  &-inner {
    max-width: 1280px;
    margin: 0 auto;
  }
}

.back-link {
  display: inline-block;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(240, 241, 246, 0.5);
  text-decoration: none;
  margin-bottom: var(--s-5);
  transition: color 0.2s;

  &:hover { color: var(--paper); }
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(240, 241, 246, 0.5);
  margin-bottom: var(--s-4);
}

.pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--theme-accent, var(--ember));
  display: inline-block;
  animation: pulse-beat 2s ease-in-out infinite;
}

@keyframes pulse-beat {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.7); }
}

h1 {
  font-family: var(--display);
  font-size: clamp(40px, 5vw, 72px);
  line-height: 1.02;
  letter-spacing: -0.02em;
  color: var(--paper);
  margin-bottom: var(--s-4);
}

.hero-role {
  font-size: 17px;
  color: rgba(240, 241, 246, 0.65);
  margin-bottom: var(--s-3);
}

.hero-tagline {
  font-family: var(--display);
  font-size: 20px;
  color: var(--theme-accent, var(--ember));
  font-style: italic;
}

// ── Content ───────────────────────────────────────────────────────────────────
.port-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--s-7);
}

// ── Category chips ────────────────────────────────────────────────────────────
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-bottom: var(--s-7);
}

.chip {
  background: transparent;
  border: 1px solid var(--carbon, #151F28);
  border-radius: var(--r-pill);
  padding: 6px 14px;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  color: var(--ink, #151F28);

  &.is-on,
  &:hover {
    background: var(--theme-accent, var(--ember));
    border-color: var(--theme-accent, var(--ember));
    color: #fff;
  }
}

// ── Grid ──────────────────────────────────────────────────────────────────────
.port-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s-5);
  margin-bottom: var(--s-9);
}

.port-card {
  border-radius: var(--r-lg);
  overflow: hidden;
  cursor: pointer;

  &.is-featured { grid-column: span 2; }
}

.port-card-cover {
  aspect-ratio: 4 / 3;
  background: var(--mist, #F0F1F6);
  background-size: cover;
  background-position: center;
  position: relative;
  transition: transform 0.3s ease;

  .port-card:hover & { transform: scale(1.02); }

  &.has-image .port-card-foot { background: linear-gradient(transparent, rgba(21,31,40,0.75)); }
}

.port-card-foot {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--s-5);
  display: flex;
  flex-direction: column;
  gap: 4px;
  transform: translateY(4px);
  opacity: 0;
  transition: opacity 0.2s, transform 0.2s;

  .port-card:hover & { opacity: 1; transform: translateY(0); }
}

.port-card-cat {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--theme-accent, var(--ember));
}

.port-card-title {
  font-family: var(--display);
  font-size: 20px;
  color: var(--paper, #FAFAFB);
  line-height: 1.1;
}

// ── Empty / Loading ───────────────────────────────────────────────────────────
.port-loading,
.port-empty {
  text-align: center;
  padding: var(--s-9) 0;
  color: rgba(21, 31, 40, 0.45);
  font-size: 15px;
}

.port-empty p {
  font-family: var(--display);
  font-size: 22px;
  color: rgba(21, 31, 40, 0.4);
}

// ── Personal footer ───────────────────────────────────────────────────────────
.personal-footer {
  border-top: 1px solid rgba(21, 31, 40, 0.1);
  padding-top: var(--s-8);
  margin-top: var(--s-4);
}

.pf-label {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(21, 31, 40, 0.4);
  margin-bottom: var(--s-5);
}

.pf-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-5);
}

.pf-card {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  padding: var(--s-6);
  border-radius: var(--r-lg);
  background: var(--mist, #F0F1F6);
  text-decoration: none;
  color: var(--ink, #151F28);
  transition: background 0.2s;
  cursor: pointer;

  strong {
    font-family: var(--display);
    font-size: 22px;
    line-height: 1.1;
  }

  span { font-size: 14px; color: rgba(21, 31, 40, 0.6); }
}

.pf-natalia { border-top: 3px solid #E87A89; &:hover { background: #FDEEF0; } }
.pf-nathali { border-top: 3px solid #8B9ED9; &:hover { background: #EEF0FA; } }

.pf-link {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  margin-top: var(--s-3);
  color: var(--ink, #151F28) !important;
}

// ── Responsive ────────────────────────────────────────────────────────────────
@media (max-width: 1024px) {
  .port-grid { grid-template-columns: repeat(2, 1fr); }
  .port-card.is-featured { grid-column: span 1; }
}

@media (max-width: 640px) {
  .port-hero { padding: var(--s-9) var(--s-5) var(--s-7); }
  .port-content { padding: var(--s-6) var(--s-5); }
  .port-grid { grid-template-columns: 1fr; }
  .pf-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 5: Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/portafolio/
git commit -m "feat: add PortafolioShellComponent with cuac/natalia/nathali themes"
```

---

## Task 5: AdminPortfolioListComponent

**Files:**
- Create: `src/app/pages/admin/portafolio/admin-portafolio-list.component.ts`
- Create: `src/app/pages/admin/portafolio/admin-portafolio-list.component.html`
- Create: `src/app/pages/admin/portafolio/admin-portafolio-list.component.scss`

- [ ] **Step 1: Crear el directorio**

```bash
mkdir src\app\pages\admin\portafolio
```

- [ ] **Step 2: Crear el componente TypeScript**

```typescript
// src/app/pages/admin/portafolio/admin-portafolio-list.component.ts
import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  PortfolioService,
  PortfolioProject,
  PORTFOLIO_CATEGORIES,
} from '../../../core/services/portfolio.service';

@Component({
  selector: 'app-admin-portafolio-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-portafolio-list.component.html',
  styleUrl: './admin-portafolio-list.component.scss',
})
export class AdminPortafolioListComponent implements OnInit {
  private router   = inject(Router);
  private portfolio = inject(PortfolioService);

  readonly categorias  = PORTFOLIO_CATEGORIES;
  readonly cargando    = signal(false);
  readonly projects    = signal<PortfolioProject[]>([]);
  readonly catFiltro   = signal<string>('all');
  readonly errorMsg    = signal<string | null>(null);
  readonly confirmId   = signal<string | null>(null);

  filteredProjects = computed(() => {
    const cat  = this.catFiltro();
    const list = this.projects();
    return cat === 'all' ? list : list.filter(p => p.category === cat);
  });

  async ngOnInit() {
    this.cargando.set(true);
    this.projects.set(await this.portfolio.getAll());
    this.cargando.set(false);
  }

  nuevo()                      { this.router.navigate(['/admin/portafolio/nuevo']); }
  editar(p: PortfolioProject)  { this.router.navigate(['/admin/portafolio', p.id, 'editar']); }

  async togglePublished(p: PortfolioProject) {
    const result = await this.portfolio.update(p.id, { published: !p.published });
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.projects.update(list =>
      list.map(x => x.id === p.id ? { ...x, published: !x.published } : x)
    );
  }

  async confirmarEliminar(p: PortfolioProject) {
    this.confirmId.set(p.id);
  }

  async eliminar(p: PortfolioProject) {
    const result = await this.portfolio.remove(p.id);
    this.confirmId.set(null);
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.projects.update(list => list.filter(x => x.id !== p.id));
  }

  cancelarEliminar() { this.confirmId.set(null); }

  authorLabel(authors: string[]): string {
    return authors.map(a => {
      if (a === 'cuac')    return 'Cuac';
      if (a === 'natalia') return 'Natalia';
      if (a === 'nathali') return 'Nathali';
      return a;
    }).join(' · ');
  }

  authorColor(author: string): string {
    if (author === 'natalia') return '#E87A89';
    if (author === 'nathali') return '#8B9ED9';
    return '#011E54';
  }

  catLabel(id: string): string {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }
}
```

- [ ] **Step 3: Crear el template HTML**

```html
<!-- src/app/pages/admin/portafolio/admin-portafolio-list.component.html -->
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Estudio · Cuac Design</div>
    <h1>Proyectos del <em>portafolio</em>.</h1>
    <p class="sub">Gestiona todos los proyectos públicos y personales.</p>
  </div>
  <div class="ph-r">
    <button class="btn-sm solid" (click)="nuevo()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg>
      Nuevo proyecto
    </button>
  </div>
</div>

<div class="chips" style="margin-bottom:var(--s-5)">
  <button class="chip" [class.is-on]="catFiltro() === 'all'" (click)="catFiltro.set('all')">Todas</button>
  @for (c of categorias; track c.id) {
    <button class="chip" [class.is-on]="catFiltro() === c.id" (click)="catFiltro.set(c.id)">{{ c.label }}</button>
  }
</div>

@if (errorMsg()) {
  <p style="color:var(--terra);font-size:13px;padding:8px 0">{{ errorMsg() }}</p>
}

@if (cargando()) {
  <p style="color:var(--carbon-50);font-size:14px;padding:12px 0">Cargando proyectos…</p>
}

@if (!cargando() && filteredProjects().length > 0) {
<div class="panel">
  <table class="tbl">
    <thead>
      <tr>
        <th>Proyecto</th>
        <th>Categoría</th>
        <th>Autores</th>
        <th>Estado</th>
        <th class="actions-col">Acciones</th>
      </tr>
    </thead>
    <tbody>
      @for (p of filteredProjects(); track p.id) {
      <tr>
        <td>
          <div class="pname">
            <div class="thumb" [style.backgroundImage]="p.cover_url ? 'url(' + p.cover_url + ')' : null"
                 [style.background]="!p.cover_url ? 'var(--mist)' : null">
              @if (!p.cover_url) { <span>{{ p.title[0] }}</span> }
            </div>
            <div class="meta">
              <strong>{{ p.title }}</strong>
              @if (p.featured) { <span class="featured-badge">Destacado</span> }
            </div>
          </div>
        </td>
        <td class="id">{{ catLabel(p.category) }}</td>
        <td>
          <div class="author-chips">
            @for (a of p.authors; track a) {
              <span class="author-chip" [style.background]="authorColor(a) + '22'" [style.color]="authorColor(a)">
                {{ a === 'cuac' ? 'Cuac' : a === 'natalia' ? 'Natalia' : 'Nathali' }}
              </span>
            }
          </div>
        </td>
        <td>
          @if (p.published) {
            <span class="badge ok"><span class="pdot"></span>Publicado</span>
          } @else {
            <span class="badge"><span class="pdot"></span>Borrador</span>
          }
        </td>
        <td class="actions-col">
          @if (confirmId() === p.id) {
            <span style="font-size:12px;color:var(--terra)">¿Eliminar?</span>
            <button class="btn-sm ghost err" (click)="eliminar(p)">Sí</button>
            <button class="btn-sm ghost" (click)="cancelarEliminar()">No</button>
          } @else {
            <button class="btn-sm ghost" (click)="editar(p)">Editar</button>
            <button class="btn-sm ghost" (click)="togglePublished(p)">
              {{ p.published ? 'Despublicar' : 'Publicar' }}
            </button>
            <button class="btn-sm ghost err" (click)="confirmarEliminar(p)">Eliminar</button>
          }
        </td>
      </tr>
      }
    </tbody>
  </table>
</div>
}

@if (!cargando() && filteredProjects().length === 0 && !errorMsg()) {
<div class="panel" style="padding:64px 32px;text-align:center">
  <p style="font-family:var(--display);font-size:22px;letter-spacing:-0.01em;margin-bottom:8px">Sin proyectos aún.</p>
  <p style="color:var(--carbon-50);font-size:14px;margin-bottom:24px">Crea el primer proyecto del portafolio.</p>
  <button class="btn-sm solid" (click)="nuevo()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg>
    Nuevo proyecto
  </button>
</div>
}
```

- [ ] **Step 4: Crear los estilos SCSS**

```scss
// src/app/pages/admin/portafolio/admin-portafolio-list.component.scss
:host { display: block; }

.author-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.author-chip {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  white-space: nowrap;
}

.featured-badge {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ember);
  padding: 2px 6px;
  border-radius: var(--r-sm);
  background: rgba(236, 56, 19, 0.1);
}

.actions-col {
  display: flex;
  gap: 4px;
  align-items: center;
  white-space: nowrap;
}

.thumb {
  width: 36px;
  height: 36px;
  border-radius: var(--r-sm);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-size: 16px;
  color: var(--carbon);
  flex-shrink: 0;
}

.btn-sm.err { color: var(--terra, #E8623D); }
```

- [ ] **Step 5: Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/admin/portafolio/admin-portafolio-list.component.*
git commit -m "feat: add AdminPortafolioListComponent"
```

---

## Task 6: AdminPortafolioFormComponent

**Files:**
- Create: `src/app/pages/admin/portafolio/admin-portafolio-form.component.ts`
- Create: `src/app/pages/admin/portafolio/admin-portafolio-form.component.html`
- Create: `src/app/pages/admin/portafolio/admin-portafolio-form.component.scss`

- [ ] **Step 1: Crear el componente TypeScript**

```typescript
// src/app/pages/admin/portafolio/admin-portafolio-form.component.ts
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  PortfolioService,
  PORTFOLIO_CATEGORIES,
} from '../../../core/services/portfolio.service';

@Component({
  selector: 'app-admin-portafolio-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-portafolio-form.component.html',
  styleUrl: './admin-portafolio-form.component.scss',
})
export class AdminPortafolioFormComponent implements OnInit {
  private router   = inject(Router);
  private route    = inject(ActivatedRoute);
  private fb       = inject(FormBuilder);
  private portfolio = inject(PortfolioService);

  readonly categorias = PORTFOLIO_CATEGORIES;
  readonly editId     = signal<string | null>(null);
  readonly guardando  = signal(false);
  readonly errorMsg   = signal<string | null>(null);
  readonly isEdit     = computed(() => this.editId() !== null);

  // Image state
  readonly coverPreview  = signal<string | null>(null);
  readonly galleryPreviews = signal<string[]>([]);
  private coverFile?: File;
  private galleryFiles: File[] = [];
  private existingImages: string[] = [];

  // Authors (managed as signal, not FormControl)
  readonly selectedAuthors = signal<string[]>(['cuac']);

  // Tags
  readonly tags     = signal<string[]>([]);
  tagInput          = '';

  form = this.fb.group({
    title:       ['', [Validators.required, Validators.minLength(2)]],
    slug:        ['', [Validators.required]],
    category:    ['branding', Validators.required],
    description: [''],
    featured:    [false],
    published:   [false],
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      const p = await this.portfolio.getById(id);
      if (p) {
        this.form.patchValue({
          title:       p.title,
          slug:        p.slug,
          category:    p.category,
          description: p.description ?? '',
          featured:    p.featured,
          published:   p.published,
        });
        this.selectedAuthors.set(p.authors);
        this.tags.set(p.tags);
        this.coverPreview.set(p.cover_url);
        this.galleryPreviews.set(p.images);
        this.existingImages = p.images;
      }
    }
  }

  // Slug auto-generation from title
  onTitleChange(val: string) {
    if (!this.isEdit()) {
      const slug = val.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      this.form.patchValue({ slug });
    }
  }

  toggleAuthor(a: string) {
    const current = this.selectedAuthors();
    if (current.includes(a)) {
      if (current.length > 1) this.selectedAuthors.set(current.filter(x => x !== a));
    } else {
      this.selectedAuthors.set([...current, a]);
    }
  }

  onCoverChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.coverFile = file;
    this.coverPreview.set(URL.createObjectURL(file));
  }

  onGalleryChange(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.galleryFiles = files;
    this.galleryPreviews.set(files.map(f => URL.createObjectURL(f)));
  }

  addTag() {
    const t = this.tagInput.trim();
    if (t && !this.tags().includes(t)) this.tags.update(list => [...list, t]);
    this.tagInput = '';
  }

  removeTag(t: string) { this.tags.update(list => list.filter(x => x !== t)); }

  async guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set(null);

    const v    = this.form.value;
    const slug = v.slug!;
    let coverUrl: string | null = this.coverPreview() ?? null;

    // Upload cover if new file selected
    if (this.coverFile) {
      const ext = this.coverFile.name.split('.').pop() ?? 'jpg';
      coverUrl  = await this.portfolio.uploadImage(slug, this.coverFile, `cover.${ext}`);
    }

    // Upload gallery images if new files selected
    let images: string[] = this.existingImages;
    if (this.galleryFiles.length > 0) {
      const uploaded: string[] = [];
      for (let i = 0; i < this.galleryFiles.length; i++) {
        const f   = this.galleryFiles[i];
        const ext = f.name.split('.').pop() ?? 'jpg';
        const url = await this.portfolio.uploadImage(slug, f, `img-${i + 1}.${ext}`);
        if (url) uploaded.push(url);
      }
      images = uploaded;
    }

    const payload = {
      title:       v.title!,
      slug,
      category:    v.category!,
      authors:     this.selectedAuthors(),
      description: v.description ?? null,
      cover_url:   coverUrl,
      images,
      tags:        this.tags(),
      featured:    v.featured ?? false,
      published:   v.published ?? false,
    };

    const result = this.isEdit()
      ? await this.portfolio.update(this.editId()!, payload)
      : await this.portfolio.create(payload);

    this.guardando.set(false);
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.router.navigate(['/admin/portafolio']);
  }

  cancelar() { this.router.navigate(['/admin/portafolio']); }

  hasError(field: string) {
    const c = this.form.get(field);
    return c?.invalid && c?.touched;
  }
}
```

- [ ] **Step 2: Crear el template HTML**

```html
<!-- src/app/pages/admin/portafolio/admin-portafolio-form.component.html -->
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Estudio · Portafolio</div>
    <h1>{{ isEdit() ? 'Editar' : 'Nuevo' }} <em>proyecto</em>.</h1>
  </div>
  <div class="ph-r">
    <button class="btn-sm ghost" (click)="cancelar()">← Portafolio</button>
  </div>
</div>

<div class="grid-form-cols">

  <!-- Main form -->
  <div class="panel">
    <div class="panel-h">
      <h3>{{ isEdit() ? 'Editar proyecto' : 'Crear proyecto' }}</h3>
    </div>
    <div class="panel-b">
      <form [formGroup]="form" (ngSubmit)="guardar()">

        <div class="field">
          <label>Título <span class="opt">*</span></label>
          <input class="input" formControlName="title" placeholder="Nombre del proyecto"
            (input)="onTitleChange($any($event.target).value)" />
          @if (hasError('title')) {
            <span class="help" style="color:var(--terra)">Título requerido (mínimo 2 caracteres)</span>
          }
        </div>

        <div class="field">
          <label>Slug <span class="opt">*</span></label>
          <input class="input" formControlName="slug" placeholder="slug-del-proyecto" />
          <span class="help">Se genera automáticamente desde el título. Debe ser único.</span>
          @if (hasError('slug')) {
            <span class="help" style="color:var(--terra)">Slug requerido</span>
          }
        </div>

        <div class="field">
          <label>Categoría <span class="opt">*</span></label>
          <select class="input select" formControlName="category">
            @for (c of categorias; track c.id) {
              <option [value]="c.id">{{ c.label }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label>Autores <span class="opt">*</span></label>
          <div class="author-checks">
            @for (a of [['cuac','Cuac','#011E54'],['natalia','Natalia','#E87A89'],['nathali','Nathali','#8B9ED9']]; track a[0]) {
              <label class="author-opt" [class.is-on]="selectedAuthors().includes(a[0])"
                [style.border-color]="selectedAuthors().includes(a[0]) ? a[2] : null"
                (click)="toggleAuthor(a[0])">
                <span class="author-dot" [style.background]="a[2]"></span>
                {{ a[1] }}
              </label>
            }
          </div>
        </div>

        <div class="field">
          <label>Descripción</label>
          <textarea class="input" formControlName="description" rows="5"
            placeholder="Contexto del proyecto, proceso, entregables, impacto…"></textarea>
        </div>

        <div class="field">
          <label>Tags</label>
          <div class="tag-row">
            <input class="input" style="flex:1" [(ngModel)]="tagInput" [ngModelOptions]="{standalone:true}"
              placeholder="Añadir tag (Enter)" (keydown.enter)="$event.preventDefault(); addTag()" />
            <button type="button" class="btn-sm ghost" (click)="addTag()">Añadir</button>
          </div>
          @if (tags().length > 0) {
            <div class="tag-list">
              @for (t of tags(); track t) {
                <span class="tag-item">{{ t }} <button type="button" (click)="removeTag(t)">×</button></span>
              }
            </div>
          }
        </div>

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
        </div>

        @if (errorMsg()) {
          <p style="font-size:13px;color:var(--terra);margin-bottom:var(--s-4)">{{ errorMsg() }}</p>
        }

        <div style="display:flex;gap:10px;margin-top:var(--s-5)">
          <button class="btn-sm solid" type="submit" [disabled]="guardando()">
            {{ guardando() ? 'Guardando…' : (isEdit() ? 'Actualizar' : 'Crear proyecto') }}
          </button>
          <button class="btn-sm ghost" type="button" (click)="cancelar()">Cancelar</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Images panel -->
  <div style="display:flex;flex-direction:column;gap:var(--s-5)">

    <div class="panel" style="align-self:start">
      <div class="panel-h"><h3>Imagen de portada</h3></div>
      <div class="panel-b">
        @if (coverPreview()) {
          <div class="img-preview">
            <img [src]="coverPreview()" alt="Cover preview" />
          </div>
        }
        <label class="upload-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:14px;height:14px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          {{ coverPreview() ? 'Cambiar portada' : 'Subir portada' }}
          <input type="file" accept="image/*" (change)="onCoverChange($event)" hidden />
        </label>
        <span class="help">JPG, PNG o WebP. Proporción 4:3 recomendada.</span>
      </div>
    </div>

    <div class="panel" style="align-self:start">
      <div class="panel-h"><h3>Galería</h3><span class="sub">Hasta 8 imágenes</span></div>
      <div class="panel-b">
        @if (galleryPreviews().length > 0) {
          <div class="gallery-grid">
            @for (url of galleryPreviews(); track url) {
              <div class="gallery-thumb" [style.backgroundImage]="'url(' + url + ')'"></div>
            }
          </div>
        }
        <label class="upload-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:14px;height:14px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Seleccionar imágenes
          <input type="file" accept="image/*" multiple (change)="onGalleryChange($event)" hidden />
        </label>
        <span class="help">Selecciona múltiples imágenes a la vez.</span>
      </div>
    </div>

  </div>
</div>
```

- [ ] **Step 3: Crear los estilos SCSS**

```scss
// src/app/pages/admin/portafolio/admin-portafolio-form.component.scss
:host { display: block; }

.author-checks {
  display: flex;
  gap: var(--s-3);
  flex-wrap: wrap;
}

.author-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1.5px solid var(--carbon-08, rgba(21,31,40,0.08));
  border-radius: var(--r-md);
  cursor: pointer;
  font-size: 13.5px;
  transition: border-color 0.15s, background 0.15s;
  user-select: none;

  &.is-on { background: rgba(21, 31, 40, 0.04); }
}

.author-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-row {
  display: flex;
  gap: var(--s-3);
  margin-bottom: var(--s-3);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--mist, #F0F1F6);
  border-radius: var(--r-pill);
  font-size: 12.5px;

  button {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--carbon, #151F28);
    font-size: 14px;
    line-height: 1;
    padding: 0;
    opacity: 0.5;
    &:hover { opacity: 1; }
  }
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1.5px dashed rgba(21, 31, 40, 0.2);
  border-radius: var(--r-md);
  cursor: pointer;
  font-size: 13px;
  color: var(--carbon, #151F28);
  transition: border-color 0.15s, background 0.15s;
  margin-bottom: var(--s-3);

  &:hover {
    border-color: var(--ember, #EC3813);
    background: rgba(236, 56, 19, 0.04);
  }
}

.img-preview {
  border-radius: var(--r-md);
  overflow: hidden;
  margin-bottom: var(--s-4);
  aspect-ratio: 4 / 3;
  background: var(--mist);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s-2);
  margin-bottom: var(--s-4);
}

.gallery-thumb {
  aspect-ratio: 1;
  border-radius: var(--r-sm);
  background-size: cover;
  background-position: center;
  background-color: var(--mist);
}
```

- [ ] **Step 4: Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/portafolio/admin-portafolio-form.component.*
git commit -m "feat: add AdminPortafolioFormComponent with image upload"
```

---

## Task 7: Rutas y Admin Shell

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/pages/admin/admin-shell.component.ts`
- Modify: `src/app/pages/admin/admin-shell.component.html`

- [ ] **Step 1: Registrar rutas públicas en `app.routes.ts`**

Añadir las 5 nuevas rutas. El archivo completo queda:

```typescript
// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'cotizar',
    loadComponent: () =>
      import('./pages/cotizador/cotizador.component').then(m => m.CotizadorComponent),
  },
  {
    path: 'portafolio',
    loadComponent: () =>
      import('./pages/portafolio/portafolio-shell.component').then(m => m.PortafolioShellComponent),
    data: { theme: 'cuac' },
  },
  {
    path: 'portafolio/natalia',
    loadComponent: () =>
      import('./pages/portafolio/portafolio-shell.component').then(m => m.PortafolioShellComponent),
    data: { theme: 'natalia' },
  },
  {
    path: 'portafolio/nathali',
    loadComponent: () =>
      import('./pages/portafolio/portafolio-shell.component').then(m => m.PortafolioShellComponent),
    data: { theme: 'nathali' },
  },
  {
    path: 'cuaquiverso',
    loadComponent: () =>
      import('./pages/cuaquiverso/cuaquiverso.component').then(m => m.CuaquiversoComponent),
  },
  {
    path: 'identidadcorporativa',
    loadComponent: () =>
      import('./pages/identidadcorporativa/identidadcorporativa.component').then(
        m => m.IdentidadCorporativaComponent,
      ),
  },
  {
    path: 'designsystem',
    loadComponent: () =>
      import('./pages/designsystem/designsystem.component').then(
        m => m.DesignSystemComponent,
      ),
  },
  {
    path: 'cuaquiverso/tienda',
    loadComponent: () =>
      import('./pages/cuaquiverso/tienda/tienda.component').then(m => m.TiendaComponent),
  },
  {
    path: 'cuaquiverso/universo',
    loadComponent: () =>
      import('./pages/cuaquiverso/universo/universo.component').then(m => m.UniversoComponent),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin/admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/admin/admin-home.component').then(m => m.AdminHomeComponent),
      },
      {
        path: 'inventario',
        loadComponent: () =>
          import('./pages/admin/inventario/inventario-list.component').then(
            m => m.InventarioListComponent,
          ),
      },
      {
        path: 'inventario/nuevo',
        loadComponent: () =>
          import('./pages/admin/inventario/inventario-form.component').then(
            m => m.InventarioFormComponent,
          ),
      },
      {
        path: 'inventario/:id/editar',
        loadComponent: () =>
          import('./pages/admin/inventario/inventario-form.component').then(
            m => m.InventarioFormComponent,
          ),
      },
      {
        path: 'inventario/ventas',
        loadComponent: () =>
          import('./pages/admin/inventario/inventario-ventas.component').then(
            m => m.InventarioVentasComponent,
          ),
      },
      {
        path: 'cotizaciones',
        loadComponent: () =>
          import('./pages/admin/cotizaciones/cotizaciones-list.component').then(
            m => m.CotizacionesListComponent,
          ),
      },
      {
        path: 'portafolio',
        loadComponent: () =>
          import('./pages/admin/portafolio/admin-portafolio-list.component').then(
            m => m.AdminPortafolioListComponent,
          ),
      },
      {
        path: 'portafolio/nuevo',
        loadComponent: () =>
          import('./pages/admin/portafolio/admin-portafolio-form.component').then(
            m => m.AdminPortafolioFormComponent,
          ),
      },
      {
        path: 'portafolio/:id/editar',
        loadComponent: () =>
          import('./pages/admin/portafolio/admin-portafolio-form.component').then(
            m => m.AdminPortafolioFormComponent,
          ),
      },
    ],
  },
];
```

- [ ] **Step 2: Actualizar `admin-shell.component.ts`**

Añadir `isPortafolioRoute`, `goPortafolio()` y los crumbs de portafolio. Modificar las líneas relevantes:

En el bloque de signals computados (después de `isCotizacionesRoute`), añadir:

```typescript
isPortafolioRoute = computed(() => this.routerUrl().includes('/admin/portafolio'));
```

En el computed `crumbs`, añadir los casos de portafolio ANTES de los casos de inventario:

```typescript
crumbs = computed(() => {
  const url = this.routerUrl();
  if (url.includes('/portafolio/nuevo'))             return ['Estudio', 'Portafolio', 'Nuevo proyecto'];
  if (url.match(/\/portafolio\/.+\/editar/))         return ['Estudio', 'Portafolio', 'Editar proyecto'];
  if (url.includes('/portafolio'))                   return ['Estudio', 'Portafolio'];
  if (url.includes('/cotizaciones'))                 return ['Diseño', 'Cotizaciones'];
  if (url.includes('/inventario/ventas'))            return ['Evento', 'Inventario', 'Log de ventas'];
  if (url.includes('/inventario/nuevo'))             return ['Evento', 'Inventario', 'Nuevo producto'];
  if (url.match(/\/inventario\/.+\/editar/))         return ['Evento', 'Inventario', 'Editar producto'];
  if (url.includes('/inventario'))                   return ['Evento', 'Inventario'];

  const map: Record<ViewId, string[]> = {
    dashboard: ['Resumen'],
    productos: ['Catálogo', 'Productos'],
    pedidos:   ['Operación', 'Pedidos'],
    clientes:  ['Comunidad', 'Clientes'],
    pagos:     ['Caja', 'Pagos'],
    contenido: ['Universo', 'Personajes y contenido'],
    ajustes:   ['Sistema', 'Ajustes'],
  };
  return map[this.state.view()] ?? ['—'];
});
```

Añadir el método `goPortafolio()` junto a los otros métodos de navegación:

```typescript
goPortafolio() { this.router.navigate(['/admin/portafolio']); }
```

- [ ] **Step 3: Añadir "Portafolio" en el sidebar HTML**

En `admin-shell.component.html`, añadir una nueva sección después de la sección "Evento" (antes del bloque `sb-foot`):

```html
    <div class="sb-section">Estudio</div>
    <div class="sb-nav">
      <a [class.is-active]="isPortafolioRoute()" (click)="goPortafolio()">
        <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        <span>Portafolio</span>
      </a>
    </div>
```

- [ ] **Step 4: Verificar compilación y navegación**

```bash
npx ng build --configuration development 2>&1 | tail -20
npx ng serve --open
```

Verificar manualmente:
- Navegar a `http://localhost:4200/portafolio` → debe mostrar la página de Cuac
- Navegar a `http://localhost:4200/portafolio/natalia` → debe mostrar el tema rosado
- Navegar a `http://localhost:4200/portafolio/nathali` → debe mostrar el tema azul-violeta
- Navegar a `http://localhost:4200/admin/portafolio` → debe mostrar la lista (vacía)
- El sidebar debe mostrar la sección "Estudio" con "Portafolio"

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts src/app/pages/admin/admin-shell.component.ts src/app/pages/admin/admin-shell.component.html
git commit -m "feat: register portfolio routes and add admin sidebar nav entry"
```

---

## Task 8: CTAs — Topbar, Hero y Footer

**Files:**
- Modify: `src/app/layout/topbar/topbar.component.html`
- Modify: `src/app/pages/home/sections/hero/hero.component.html`
- Modify: `src/app/layout/footer/footer.component.html`

- [ ] **Step 1: Añadir "Portafolio" en el topbar**

En `src/app/layout/topbar/topbar.component.html`, en el `<nav class="primary">` añadir el link después de "Casos":

```html
<a href="#servicios">Servicios</a>
<a href="#empresas">Empresas</a>
<a href="#proceso">Proceso</a>
<a href="#casos">Casos</a>
<a routerLink="/portafolio">Portafolio</a>
<a href="#contacto">Contacto</a>
```

Y en el `<nav class="mobile-nav">` añadir el mismo link:

```html
<a href="#servicios" (click)="closeMenu()">Servicios</a>
<a href="#empresas" (click)="closeMenu()">Empresas</a>
<a href="#proceso" (click)="closeMenu()">Proceso</a>
<a href="#casos" (click)="closeMenu()">Casos</a>
<a routerLink="/portafolio" (click)="closeMenu()">Portafolio</a>
<a href="#contacto" (click)="closeMenu()">Contacto</a>
```

- [ ] **Step 2: Añadir botón "Ver portafolio" en el hero**

En `src/app/pages/home/sections/hero/hero.component.html`, en el div `.hero-ctas`:

```html
<div class="hero-ctas">
  <a class="btn btn-primary" href="#contacto">Empezar un proyecto &rarr;</a>
  <a class="btn btn-ghost-light" routerLink="/portafolio">Ver portafolio</a>
</div>
```

El botón "Ver portafolio" reemplaza el actual "Ver trabajo reciente" que apuntaba a `#casos`.

- [ ] **Step 3: Añadir link en el footer**

En `src/app/layout/footer/footer.component.html`, en la columna "Estudio" (la que tiene "Para empresas", "Proceso", etc.), añadir "Portafolio":

```html
<div class="footer-col">
  <h5>Estudio</h5>
  <a href="#empresas">Para empresas</a>
  <a href="#proceso">Proceso</a>
  <a routerLink="/portafolio">Portafolio</a>
  <a href="#contacto">Empezar un proyecto</a>
</div>
```

- [ ] **Step 4: Asegurar que `HeroComponent` importa `RouterLink`**

Verificar que `src/app/pages/home/sections/hero/hero.component.ts` tiene `RouterLink` en `imports`. Si no, añadirlo:

```typescript
import { RouterLink } from '@angular/router';
// ...
imports: [RouterLink],
```

- [ ] **Step 5: Verificar compilación final**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Esperado: sin errores.

- [ ] **Step 6: Commit final**

```bash
git add src/app/layout/topbar/topbar.component.html
git add src/app/pages/home/sections/hero/hero.component.html
git add src/app/pages/home/sections/hero/hero.component.ts
git add src/app/layout/footer/footer.component.html
git commit -m "feat: add portfolio CTAs to topbar, hero and footer"
```

---

## Self-Review

**Spec coverage:**

| Req. del spec | Cubierto en |
|---|---|
| Tabla `portfolio_projects` + RLS + Storage | Task 1 |
| `PortfolioService` CRUD + uploadImage | Task 2 |
| Tokens CSS `[data-theme]` | Task 3 |
| `PortafolioShellComponent` (3 temas) | Task 4 |
| Filtros por categoría | Task 4 (chips en shell) |
| Bloque personal en tema cuac | Task 4 (personal-footer) |
| Breadcrumb "← Cuac Design" en temas personales | Task 4 (back-link) |
| `AdminPortafolioListComponent` con toggle published inline | Task 5 |
| `AdminPortafolioFormComponent` con upload de imágenes | Task 6 |
| Rutas públicas y admin | Task 7 |
| Admin sidebar "Estudio → Portafolio" | Task 7 |
| Crumbs en admin | Task 7 |
| Topbar link "Portafolio" | Task 8 |
| Hero CTA "Ver portafolio" | Task 8 |
| Footer link "Portafolio" | Task 8 |

**Tipo check:**
- `PortfolioProject` definido en Task 2, usado en Tasks 4, 5, 6 — tipos consistentes.
- `PORTFOLIO_CATEGORIES` exportado en Task 2, importado en Tasks 4, 5, 6.
- `uploadImage(slug, file, name)` definido en Task 2, llamado en Task 6 con los 3 parámetros correctos.
- `getPublished(author?)` recibe string opcional — en Task 4 se pasa `this.theme` directamente.
- `create()` retorna `{ id, error }` — en Task 6 solo se usa `result.error`.

**Placeholder scan:** ninguno encontrado. Todos los steps tienen código completo.
