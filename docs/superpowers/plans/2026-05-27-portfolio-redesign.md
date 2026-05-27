# Portfolio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full redesign of portafolio-shell and portafolio-detail with Three.js GLSL shader hero (all light backgrounds), 12-col masonry grid with filter tabs, links section, and next/prev project navigation.

**Architecture:** 10 focused tasks. Data layer first (tokens + types + migration) → new PortfolioShaderComponent → shell rewrite (hero + grid + filters + footer) → detail additions (links + next/prev) → admin form enhancement.

**Tech Stack:** Angular 17+ standalone with signals, Three.js (lazy `await import('three')`), GLSL shaders inlined as TS template literals, Supabase via existing PortfolioService, CSS grid 12-col masonry.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/styles/_tokens.scss` | Modify | Update theme hero tokens to light backgrounds |
| `src/app/core/services/portfolio.service.ts` | Modify | Add `ProjectLink` interface + `links` field to `PortfolioProject` |
| `src/app/pages/portafolio/shader/portfolio-shader.component.ts` | **Create** | Three.js GLSL shader wrapper |
| `src/app/pages/portafolio/shader/portfolio-shader.component.scss` | **Create** | Shader canvas fills host |
| `src/app/pages/portafolio/portafolio-shell.component.ts` | Rewrite | `assignSpans`, `countFor`, shader import, new `HERO_DATA` |
| `src/app/pages/portafolio/portafolio-shell.component.html` | Rewrite | Shader hero, filter tabs, masonry grid, personal footer |
| `src/app/pages/portafolio/portafolio-shell.component.scss` | Rewrite | Light hero, 12-col grid, filter tabs, card overlay |
| `src/app/pages/portafolio/portafolio-detail.component.ts` | Modify | `nextProject`, `prevProject`, `linkIcon()`, `linkDomain()` |
| `src/app/pages/portafolio/portafolio-detail.component.html` | Modify | Links section + next/prev nav |
| `src/app/pages/portafolio/portafolio-detail.component.scss` | Modify | Link item styles + next-project nav styles |
| `src/app/pages/admin/portafolio/admin-portafolio-form.component.ts` | Modify | `links` signal + add/remove/update methods |
| `src/app/pages/admin/portafolio/admin-portafolio-form.component.html` | Modify | Dynamic links field UI |
| `src/app/pages/admin/portafolio/admin-portafolio-form.component.scss` | Modify | Link row styles |

---

### Task 1: Update design tokens for light hero backgrounds

**Files:**
- Modify: `src/styles/_tokens.scss`

- [ ] **Step 1: Update the three `[data-theme]` blocks**

Replace the entire content of each `[data-theme]` block in `src/styles/_tokens.scss`:

```scss
[data-theme="cuac"] {
  --theme-primary:      #011E54;
  --theme-accent:       #EC3813;
  --theme-surface:      #F0F1F6;
  --theme-on-primary:   #FAFAFB;
  --theme-hero-bg:      #F0F1F6;
  --theme-hero-text:    #151F28;
  --theme-hero-muted:   rgba(21, 31, 40, 0.50);
  --theme-hero-accent:  #EC3813;
  --theme-page-bg:      #FAFAFB;
  --theme-chip-active:  #151F28;
}

[data-theme="natalia"] {
  --theme-primary:      #E87A89;
  --theme-accent:       #C4556A;
  --theme-surface:      #FDEEF0;
  --theme-on-primary:   #FAFAFB;
  --theme-hero-bg:      #FBF8F4;
  --theme-hero-text:    #151F28;
  --theme-hero-muted:   rgba(21, 31, 40, 0.50);
  --theme-hero-accent:  #C4556A;
  --theme-page-bg:      #FDF6F7;
  --theme-chip-active:  #7A2A3F;
}

[data-theme="nathali"] {
  --theme-primary:      #8B9ED9;
  --theme-accent:       #5C6FC7;
  --theme-surface:      #EEF0FA;
  --theme-on-primary:   #FAFAFB;
  --theme-hero-bg:      #EEF2FD;
  --theme-hero-text:    #151F28;
  --theme-hero-muted:   rgba(21, 31, 40, 0.50);
  --theme-hero-accent:  #5C6FC7;
  --theme-page-bg:      #F4F5FC;
  --theme-chip-active:  #2A3B8A;
}
```

- [ ] **Step 2: Verify build**

Run: `ng build --configuration development 2>&1 | Select-Object -Last 5`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/_tokens.scss
git commit -m "design: update portfolio theme tokens to light hero backgrounds (AAA contrast)"
```

---

### Task 2: Add ProjectLink to data layer

**Files:**
- Modify: `src/app/core/services/portfolio.service.ts`

- [ ] **Step 1: Add `ProjectLink` interface and `links` field to `PortfolioProject`**

In `src/app/core/services/portfolio.service.ts`, insert the `ProjectLink` interface immediately before the `PortfolioProject` interface, and add the `links` field to `PortfolioProject`:

```typescript
export interface ProjectLink {
  label: string;
  url:   string;
  type:  'web' | 'video' | 'behance' | 'instagram' | 'other';
}

export interface PortfolioProject {
  id:             string;
  title:          string;
  slug:           string;
  category:       string;
  authors:        string[];
  headline:       string | null;
  client_name:    string | null;
  description:    string | null;
  client_comment: string | null;
  cover_url:      string | null;
  images:         string[];
  tags:           string[];
  links:          ProjectLink[];
  featured:       boolean;
  published:      boolean;
  created_at:     string;
}
```

- [ ] **Step 2: Run Supabase migration**

In the Supabase project SQL editor, run:

```sql
ALTER TABLE portfolio_projects
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb;
```

Verify the column appears in `portfolio_projects` table structure. Existing rows automatically get `[]` as default.

- [ ] **Step 3: Verify TypeScript build**

Run: `ng build --configuration development 2>&1 | Select-Object -Last 5`
Expected: 0 errors. The `links: ProjectLink[]` field will resolve correctly because Supabase returns `[]` for any row that hadn't set the field.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/services/portfolio.service.ts
git commit -m "feat: add ProjectLink interface and links field to PortfolioProject"
```

---

### Task 3: Create PortfolioShaderComponent

**Files:**
- Create: `src/app/pages/portafolio/shader/portfolio-shader.component.ts`
- Create: `src/app/pages/portafolio/shader/portfolio-shader.component.scss`

- [ ] **Step 1: Create the shader component TypeScript**

Create `src/app/pages/portafolio/shader/portfolio-shader.component.ts`:

```typescript
import { Component, Input, afterNextRender, inject, DestroyRef, ElementRef } from '@angular/core';

type ShaderTheme = 'cuac' | 'natalia' | 'nathali';

interface ThemeColors {
  bg: [number, number, number];
  b1: [number, number, number];
  b2: [number, number, number];
  b3: [number, number, number];
}

const THEME_COLORS: Record<ShaderTheme, ThemeColors> = {
  cuac: {
    bg: [0.941, 0.945, 0.965],
    b1: [0.925, 0.220, 0.075],
    b2: [1.000, 0.510, 0.235],
    b3: [0.784, 0.157, 0.039],
  },
  natalia: {
    bg: [0.984, 0.973, 0.957],
    b1: [0.910, 0.478, 0.537],
    b2: [1.000, 0.706, 0.667],
    b3: [0.784, 0.314, 0.392],
  },
  nathali: {
    bg: [0.933, 0.945, 0.992],
    b1: [0.392, 0.706, 0.941],
    b2: [0.627, 0.820, 0.992],
    b3: [0.275, 0.431, 0.784],
  },
};

const VERT = /* glsl */`
  varying vec2 vUv;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.z += sin(pos.x * 2.2 + uTime * 0.60) * 0.018;
    pos.z += cos(pos.y * 1.9 + uTime * 0.45) * 0.015;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAG = /* glsl */`
  uniform float uTime;
  uniform vec2  uMouse;
  uniform vec3  uBgColor;
  uniform vec3  uBlob1Color;
  uniform vec3  uBlob2Color;
  uniform vec3  uBlob3Color;
  varying vec2  vUv;

  float gauss(vec2 uv, vec2 center, float r) {
    float d = distance(uv, center);
    return exp(-d * d / (2.0 * r * r));
  }

  void main() {
    vec2 uv = vUv;

    vec2 b1 = vec2(0.22, 0.58) + vec2(sin(uTime * 0.30) * 0.11, cos(uTime * 0.24) * 0.09);
    b1 = mix(b1, uMouse + vec2(-0.14, 0.08), 0.24);

    vec2 b2 = vec2(0.74, 0.36) + vec2(cos(uTime * 0.26) * 0.13, sin(uTime * 0.32) * 0.11);
    b2 = mix(b2, uMouse + vec2(0.10, -0.07), 0.18);

    vec2 b3 = vec2(0.50, 0.80) + vec2(sin(uTime * 0.18 + 1.4) * 0.15, cos(uTime * 0.21 + 0.7) * 0.12);
    b3 = mix(b3, uMouse + vec2(0.04, 0.14), 0.14);

    float g1 = gauss(uv, b1, 0.22);
    float g2 = gauss(uv, b2, 0.26);
    float g3 = gauss(uv, b3, 0.20);

    vec3 col = uBgColor;
    col = mix(col, mix(uBgColor, uBlob1Color, 0.40), g1 * 0.60);
    col = mix(col, mix(uBgColor, uBlob2Color, 0.35), g2 * 0.50);
    col = mix(col, mix(uBgColor, uBlob3Color, 0.38), g3 * 0.55);

    float vig = distance(uv, vec2(0.5, 0.5));
    col = mix(col, uBgColor * 0.97, vig * 0.30);

    gl_FragColor = vec4(col, 1.0);
  }
`;

@Component({
  selector: 'app-portfolio-shader',
  standalone: true,
  template: `<canvas aria-hidden="true" role="presentation"></canvas>`,
  styleUrl: './portfolio-shader.component.scss',
})
export class PortfolioShaderComponent {
  @Input() theme: ShaderTheme = 'cuac';

  private destroyRef = inject(DestroyRef);
  private el         = inject(ElementRef);

  constructor() {
    afterNextRender(() => { this.initShader(); });
  }

  private async initShader(): Promise<void> {
    const canvas   = this.el.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const host     = canvas.parentElement as HTMLElement;
    const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t        = THEME_COLORS[this.theme];

    const THREE = await import('three');

    const uniforms = {
      uTime:       { value: 0 },
      uMouse:      { value: new THREE.Vector2(0.5, 0.35) },
      uBgColor:    { value: new THREE.Vector3(...t.bg) },
      uBlob1Color: { value: new THREE.Vector3(...t.b1) },
      uBlob2Color: { value: new THREE.Vector3(...t.b2) },
      uBlob3Color: { value: new THREE.Vector3(...t.b3) },
    };

    const geo      = new THREE.PlaneGeometry(2, 2, 32, 32);
    const mat      = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG });
    const mesh     = new THREE.Mesh(geo, mat);
    const scene    = new THREE.Scene();
    scene.add(mesh);

    const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);

    const targetMouse  = new THREE.Vector2(0.5, 0.35);
    const currentMouse = new THREE.Vector2(0.5, 0.35);
    const REST         = new THREE.Vector2(0.5, 0.35);
    const LERP         = 0.045;

    const onMove = (e: MouseEvent) => {
      if (noMotion) return;
      const rect = host.getBoundingClientRect();
      targetMouse.set(
        (e.clientX - rect.left) / rect.width,
        1 - (e.clientY - rect.top) / rect.height,
      );
    };
    const onLeave = () => { if (!noMotion) targetMouse.copy(REST); };

    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w && h) renderer.setSize(w, h, false);
      }, 100);
    });
    ro.observe(host);

    const clock = new THREE.Clock();
    let rafId: number;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!noMotion) {
        uniforms.uTime.value = clock.getElapsedTime();
        currentMouse.lerp(targetMouse, LERP);
        uniforms.uMouse.value.copy(currentMouse);
      }
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(tick);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      clearTimeout(resizeTimer);
      host.removeEventListener('mousemove', onMove);
      host.removeEventListener('mouseleave', onLeave);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    });
  }
}
```

- [ ] **Step 2: Create the shader component SCSS**

Create `src/app/pages/portafolio/shader/portfolio-shader.component.scss`:

```scss
:host {
  display: block;
  position: absolute;
  inset: 0;
  pointer-events: none;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `ng build --configuration development 2>&1 | Select-Object -Last 5`
Expected: 0 errors. Component is standalone and not yet imported anywhere.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/portafolio/shader/
git commit -m "feat: add PortfolioShaderComponent — Three.js GLSL fluid blobs, mouse-reactive, per-theme"
```

---

### Task 4: Rewrite portafolio-shell TypeScript

**Files:**
- Modify: `src/app/pages/portafolio/portafolio-shell.component.ts`

- [ ] **Step 1: Full rewrite**

Replace the entire content of `src/app/pages/portafolio/portafolio-shell.component.ts`:

```typescript
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import {
  PortfolioService,
  PortfolioProject,
  PORTFOLIO_CATEGORIES,
} from '../../core/services/portfolio.service';
import { PortfolioShaderComponent } from './shader/portfolio-shader.component';

type Theme = 'cuac' | 'natalia' | 'nathali';

const THEME_AUTHOR: Record<Theme, string> = {
  cuac:    'cuac',
  natalia: 'natalia',
  nathali: 'nathali',
};

interface HeroData {
  eyebrow:     string;
  h1Main:      string;
  h1Sub:       string;
  rol:         string;
  disciplinas: string;
  height:      string;
}

const HERO_DATA: Record<Theme, HeroData> = {
  cuac: {
    eyebrow:     'Estudio · Cuac Design',
    h1Main:      'Nuestro',
    h1Sub:       'trabajo',
    rol:         'Cuac Design · Bogotá',
    disciplinas: 'Branding · Editorial · Ilustración · Web',
    height:      '100vh',
  },
  natalia: {
    eyebrow:     'Portafolio personal',
    h1Main:      'Natalia',
    h1Sub:       'Castañeda Caicedo',
    rol:         'Diseño editorial, ilustración y branding',
    disciplinas: '',
    height:      '80vh',
  },
  nathali: {
    eyebrow:     'Portafolio personal',
    h1Main:      'Nathali',
    h1Sub:       'Ramírez Ortiz',
    rol:         'Diseño UI/UX, ilustración y branding',
    disciplinas: '',
    height:      '80vh',
  },
};

export type SpanProject = PortfolioProject & { span: number; ar: string };

function assignSpans(projects: PortfolioProject[]): SpanProject[] {
  const out: SpanProject[] = [];
  let i = 0;
  while (i < projects.length) {
    const rem = projects.length - i;
    if (projects[i].featured && rem >= 2) {
      out.push({ ...projects[i],     span: 8, ar: '4/3' });
      out.push({ ...projects[i + 1], span: 4, ar: '3/4' });
      i += 2;
    } else if (rem >= 3) {
      out.push({ ...projects[i],     span: 4, ar: '1/1' });
      out.push({ ...projects[i + 1], span: 4, ar: '1/1' });
      out.push({ ...projects[i + 2], span: 4, ar: '1/1' });
      i += 3;
    } else if (rem === 2) {
      out.push({ ...projects[i],     span: 5, ar: '3/4' });
      out.push({ ...projects[i + 1], span: 7, ar: '4/3' });
      i += 2;
    } else {
      out.push({ ...projects[i], span: 12, ar: '16/9' });
      i += 1;
    }
  }
  return out;
}

@Component({
  selector: 'app-portafolio-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, PortfolioShaderComponent],
  templateUrl: './portafolio-shell.component.html',
  styleUrl: './portafolio-shell.component.scss',
  host: { '[attr.data-theme]': 'theme' },
})
export class PortafolioShellComponent implements OnInit {
  private portfolioSvc = inject(PortfolioService);
  private route        = inject(ActivatedRoute);

  theme: Theme = 'cuac';
  readonly categorias = PORTFOLIO_CATEGORIES;
  readonly cargando   = signal(false);
  readonly projects   = signal<PortfolioProject[]>([]);
  readonly catFiltro  = signal<string>('all');

  get hero(): HeroData  { return HERO_DATA[this.theme]; }
  get isCuac(): boolean { return this.theme === 'cuac'; }

  readonly filteredProjects = computed<SpanProject[]>(() => {
    const cat      = this.catFiltro();
    const list     = this.projects();
    const filtered = cat === 'all' ? list : list.filter(p => p.category === cat);
    return assignSpans(filtered);
  });

  readonly totalCount = computed(() => this.projects().length);

  countFor(catId: string): number {
    return this.projects().filter(p => p.category === catId).length;
  }

  catLabel(id: string): string {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }

  async ngOnInit() {
    this.theme = (this.route.snapshot.data['theme'] as Theme) ?? 'cuac';
    this.cargando.set(true);
    const data = await this.portfolioSvc.getPublished(THEME_AUTHOR[this.theme]);
    this.projects.set(data);
    this.cargando.set(false);
  }
}
```

- [ ] **Step 2: Build to verify types**

Run: `ng build --configuration development 2>&1 | Select-Object -Last 10`
Expected: 0 errors. `SpanProject`, `assignSpans`, and `PortfolioShaderComponent` all resolve correctly.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/portafolio/portafolio-shell.component.ts
git commit -m "feat: update portafolio-shell TS — assignSpans, countFor, HeroData, shader import"
```

---

### Task 5: Rewrite portafolio-shell HTML

**Files:**
- Modify: `src/app/pages/portafolio/portafolio-shell.component.html`

- [ ] **Step 1: Full rewrite**

Replace the entire content of `src/app/pages/portafolio/portafolio-shell.component.html`:

```html
<!-- ── Hero ─────────────────────────────────────────────────────────────────── -->
<div class="port-hero" [style.min-height]="hero.height">
  <app-portfolio-shader [theme]="theme"></app-portfolio-shader>

  <nav class="hero-nav" aria-label="Navegación de portafolio">
    <a class="hero-back" routerLink="/">← Inicio</a>
    @if (!isCuac) {
      <a class="hero-back" routerLink="/portafolio">← Cuac Design</a>
    }
  </nav>

  <div class="hero-content">
    <div class="hero-eyebrow">
      <span class="pulse" aria-hidden="true"></span>
      {{ hero.eyebrow }}
    </div>
    <h1 class="hero-h1">
      {{ hero.h1Main }}<br>
      <em class="hero-h1-sub">{{ hero.h1Sub }}</em>
    </h1>
    <p class="hero-meta">{{ hero.rol }}</p>
    @if (hero.disciplinas) {
      <p class="hero-disciplinas">{{ hero.disciplinas }}</p>
    }
  </div>

  <div class="scroll-hint" aria-hidden="true">
    <span class="scroll-line"></span>
    <span class="scroll-label">Explorar</span>
  </div>
</div>

<!-- ── Content ───────────────────────────────────────────────────────────────── -->
<div class="port-content">

  <!-- ── Filter bar ──────────────────────────────────────────────────────────── -->
  <nav class="filter-bar" aria-label="Filtrar por categoría">
    <button
      class="filter-item"
      [class.active]="catFiltro() === 'all'"
      [attr.aria-pressed]="catFiltro() === 'all'"
      (click)="catFiltro.set('all')">
      Todos <span class="filter-count">{{ totalCount() }}</span>
    </button>
    @for (c of categorias; track c.id) {
      @if (countFor(c.id) > 0) {
        <button
          class="filter-item"
          [class.active]="catFiltro() === c.id"
          [attr.aria-pressed]="catFiltro() === c.id"
          (click)="catFiltro.set(c.id)">
          {{ c.label }} <span class="filter-count">{{ countFor(c.id) }}</span>
        </button>
      }
    }
  </nav>

  <!-- ── Grid ────────────────────────────────────────────────────────────────── -->
  @if (cargando()) {
    <p class="port-loading" role="status">Cargando proyectos…</p>
  }

  @if (!cargando() && filteredProjects().length > 0) {
    <div class="port-grid">
      @for (p of filteredProjects(); track p.id) {
        <a
          class="port-card"
          [style.grid-column]="'span ' + p.span"
          [style.aspect-ratio]="p.ar"
          [routerLink]="['/portafolio', p.slug]"
          [attr.aria-label]="p.title + ' · ' + catLabel(p.category)">
          @if (p.cover_url) {
            <div class="card-bg" [style.backgroundImage]="'url(' + p.cover_url + ')'"></div>
          }
          <div class="card-label">
            <span class="card-cat">{{ catLabel(p.category) }}</span>
            <span class="card-title-sm">{{ p.title }}</span>
          </div>
          <div class="card-overlay" aria-hidden="true">
            <span class="overlay-cat">{{ catLabel(p.category) }}</span>
            <span class="overlay-title">{{ p.title }}</span>
            <span class="overlay-cta">Ver proyecto</span>
          </div>
        </a>
      }
    </div>
  }

  @if (!cargando() && filteredProjects().length === 0) {
    <div class="port-empty" role="status">
      <p>Sin proyectos en esta categoría aún.</p>
    </div>
  }

  <!-- ── Personal footer (Cuac only) ─────────────────────────────────────────── -->
  @if (isCuac) {
    <div class="personal-footer">
      <p class="pf-eyebrow">El equipo también tiene voz propia</p>
      <div class="pf-grid">
        <a class="pf-card pf-natalia" routerLink="/portafolio/natalia">
          <span class="pf-tag">Portafolio personal</span>
          <strong class="pf-name">Natalia Castañeda Caicedo</strong>
          <span class="pf-rol">Diseño editorial, ilustración y branding</span>
          <span class="pf-cta">Ver portafolio <span aria-hidden="true">→</span></span>
        </a>
        <a class="pf-card pf-nathali" routerLink="/portafolio/nathali">
          <span class="pf-tag">Portafolio personal</span>
          <strong class="pf-name">Nathali Ramírez Ortiz</strong>
          <span class="pf-rol">Diseño UI/UX, ilustración y branding</span>
          <span class="pf-cta">Ver portafolio <span aria-hidden="true">→</span></span>
        </a>
      </div>
    </div>
  }

</div>
```

- [ ] **Step 2: Build to verify template syntax**

Run: `ng build --configuration development 2>&1 | Select-Object -Last 10`
Expected: 0 template errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/portafolio/portafolio-shell.component.html
git commit -m "feat: rewrite portafolio-shell HTML — shader hero, filter tabs, masonry grid, personal footer"
```

---

### Task 6: Rewrite portafolio-shell SCSS

**Files:**
- Modify: `src/app/pages/portafolio/portafolio-shell.component.scss`

- [ ] **Step 1: Full rewrite**

Replace the entire content of `src/app/pages/portafolio/portafolio-shell.component.scss`:

```scss
:host {
  display: block;
  background: var(--theme-page-bg, var(--paper));
}

// ── Hero ──────────────────────────────────────────────────────────────────────
.port-hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0 0 var(--s-8);
  background: var(--theme-hero-bg, #F0F1F6);
  overflow: hidden;
}

.hero-nav {
  position: absolute;
  top: var(--s-6);
  left: var(--s-7);
  right: var(--s-7);
  display: flex;
  gap: var(--s-5);
  z-index: 10;
}

.hero-back {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--theme-hero-muted, rgba(21, 31, 40, 0.45));
  text-decoration: none;
  transition: color 0.2s;

  &:hover { color: var(--theme-hero-text, #151F28); }
}

.hero-content {
  position: relative;
  z-index: 10;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 0 var(--s-7);
}

.hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--theme-hero-muted, rgba(21, 31, 40, 0.45));
  margin-bottom: var(--s-4);
}

.pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--theme-accent, var(--ember));
  display: inline-block;
  flex-shrink: 0;
  animation: pulse-beat 2s ease-in-out infinite;
}

@keyframes pulse-beat {
  0%, 100% { opacity: 1;    transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.65); }
}

.hero-h1 {
  font-family: var(--sans);
  font-weight: 800;
  font-size: clamp(52px, 7vw, 100px);
  line-height: 1.0;
  letter-spacing: -0.035em;
  color: var(--theme-hero-text, #151F28);
  margin: 0 0 var(--s-4);
}

.hero-h1-sub {
  font-style: italic;
  font-size: 0.7em;
  opacity: 0.38;
  display: block;
}

.hero-meta {
  font-family: var(--sans);
  font-size: 16px;
  color: var(--theme-hero-muted, rgba(21, 31, 40, 0.55));
  margin: 0 0 var(--s-2);
  line-height: 1.5;
}

.hero-disciplinas {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--theme-hero-muted, rgba(21, 31, 40, 0.35));
  margin: 0;
}

// ── Scroll hint ───────────────────────────────────────────────────────────────
.scroll-hint {
  position: absolute;
  bottom: var(--s-6);
  right: var(--s-7);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-2);
  z-index: 10;
}

.scroll-line {
  width: 1px;
  height: 40px;
  background: var(--theme-hero-muted, rgba(21, 31, 40, 0.28));
  transform-origin: top;
  animation: scroll-drop 2.4s ease-in-out infinite;
}

.scroll-label {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--theme-hero-muted, rgba(21, 31, 40, 0.32));
  writing-mode: vertical-rl;
}

@keyframes scroll-drop {
  0%   { transform: scaleY(0);   opacity: 0; }
  25%  { transform: scaleY(1);   opacity: 1; }
  75%  { transform: scaleY(1);   opacity: 1; }
  100% { transform: scaleY(0) translateY(40px); opacity: 0; }
}

// ── Content wrapper ───────────────────────────────────────────────────────────
.port-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--s-7);
}

// ── Filter bar ────────────────────────────────────────────────────────────────
.filter-bar {
  display: flex;
  gap: 0;
  margin-bottom: var(--s-7);
  border-bottom: 1px solid rgba(21, 31, 40, 0.08);
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.filter-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0 var(--s-5);
  min-height: 44px;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: rgba(21, 31, 40, 0.42);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;

  &:hover { color: var(--theme-hero-text, #151F28); }

  &.active {
    color: var(--theme-hero-text, #151F28);
    border-bottom-color: var(--theme-accent, var(--ember));
    font-weight: 700;
  }
}

.filter-count {
  font-size: 10px;
  opacity: 0.5;
}

// ── 12-column masonry grid ────────────────────────────────────────────────────
.port-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
  margin-bottom: var(--s-9);
}

// ── Cards ─────────────────────────────────────────────────────────────────────
.port-card {
  position: relative;
  display: block;
  text-decoration: none;
  color: inherit;
  border-radius: var(--r-lg);
  overflow: hidden;
  background: var(--theme-surface, var(--mist));
  cursor: pointer;
}

.card-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);

  .port-card:hover & { transform: scale(1.04); }
}

.card-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--s-4) var(--s-5);
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: linear-gradient(transparent, rgba(21, 31, 40, 0.58));
  z-index: 2;
}

// No-image fallback: static label with dark text
.port-card:not(:has(.card-bg)) .card-label {
  background: transparent;
  position: static;
  padding: var(--s-5);

  .card-cat   { color: var(--theme-accent, var(--ember)); }
  .card-title-sm { color: var(--ink, #151F28); }
}

.card-cat {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--theme-accent, var(--ember));
}

.card-title-sm {
  font-family: var(--sans);
  font-weight: 700;
  font-size: 14px;
  color: #F0F1F6;
  line-height: 1.2;
}

.card-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: var(--s-6);
  background: rgba(21, 31, 40, 0.72);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 3;
}

.port-card:hover .card-overlay,
.port-card:focus-within .card-overlay { opacity: 1; }

.overlay-cat {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--theme-accent, var(--ember));
  margin-bottom: var(--s-2);
}

.overlay-title {
  font-family: var(--sans);
  font-weight: 800;
  font-size: clamp(16px, 2vw, 22px);
  color: var(--paper, #FAFAFB);
  line-height: 1.1;
  margin-bottom: var(--s-3);
}

.overlay-cta {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(240, 241, 246, 0.6);
}

// ── Loading / empty ───────────────────────────────────────────────────────────
.port-loading {
  text-align: center;
  padding: var(--s-9) 0;
  color: rgba(21, 31, 40, 0.38);
  font-size: 15px;
}

.port-empty {
  text-align: center;
  padding: var(--s-9) 0;

  p {
    font-family: var(--display);
    font-size: 22px;
    color: rgba(21, 31, 40, 0.38);
    margin: 0;
  }
}

// ── Personal footer ───────────────────────────────────────────────────────────
.personal-footer {
  border-top: 1px solid rgba(21, 31, 40, 0.07);
  padding-top: var(--s-8);
  margin-top: var(--s-4);
}

.pf-eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(21, 31, 40, 0.36);
  margin: 0 0 var(--s-6);
}

.pf-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-5);
}

.pf-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  padding: var(--s-7) var(--s-6);
  border-radius: var(--r-lg);
  text-decoration: none;
  color: var(--ink, #151F28);
  overflow: hidden;
  transition: transform 0.25s ease;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--r-lg);
    opacity: 0;
    transition: opacity 0.4s ease;
    pointer-events: none;
  }

  &:hover { transform: translateY(-2px); }
  &:hover::before { opacity: 1; }
}

.pf-natalia {
  background: #FBF3F5;

  &::before {
    background: radial-gradient(ellipse at 35% 65%, rgba(196, 85, 106, 0.20) 0%, transparent 62%);
  }
}

.pf-nathali {
  background: #F0F2FC;

  &::before {
    background: radial-gradient(ellipse at 65% 35%, rgba(92, 111, 199, 0.20) 0%, transparent 62%);
  }
}

.pf-tag {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(21, 31, 40, 0.36);
  position: relative;
  z-index: 1;
}

.pf-name {
  font-family: var(--sans);
  font-weight: 800;
  font-size: clamp(18px, 2.2vw, 26px);
  line-height: 1.1;
  color: var(--ink, #151F28);
  margin: var(--s-2) 0 0;
  position: relative;
  z-index: 1;
}

.pf-rol {
  font-size: 14px;
  color: rgba(21, 31, 40, 0.58);
  line-height: 1.5;
  position: relative;
  z-index: 1;
}

.pf-cta {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  margin-top: var(--s-4);
  position: relative;
  z-index: 1;
  color: var(--theme-accent, var(--ember));

  .pf-natalia & { color: #C4556A; }
  .pf-nathali & { color: #5C6FC7; }
}

// ── Touch: overlay always visible ─────────────────────────────────────────────
@media (hover: none) {
  .card-overlay         { opacity: 1; }
  .card-bg              { transform: none !important; }
  .card-title-sm        { color: #F0F1F6; }
  .port-card:not(:has(.card-bg)) .card-title-sm { color: var(--ink, #151F28); }
}

// ── Reduced motion ────────────────────────────────────────────────────────────
@media (prefers-reduced-motion: reduce) {
  .pulse        { animation: none; }
  .scroll-line  { animation: none; }
  .card-bg      { transition: none; }
  .card-overlay { transition: none; }
  .pf-card      { transition: none; }
  .filter-item  { transition: none; }
  .hero-back    { transition: none; }
}

// ── Responsive ────────────────────────────────────────────────────────────────
@media (max-width: 1024px) {
  .port-grid { grid-template-columns: repeat(6, 1fr); }

  // Remap inline span values to fit 6-col grid
  .port-card[style*="span 8"]  { grid-column: span 4 !important; }
  .port-card[style*="span 7"]  { grid-column: span 4 !important; }
  .port-card[style*="span 5"]  { grid-column: span 2 !important; }
  .port-card[style*="span 4"]  { grid-column: span 3 !important; }
  .port-card[style*="span 12"] { grid-column: span 6 !important; }
}

@media (max-width: 640px) {
  .hero-nav     { left: var(--s-5); right: var(--s-5); }
  .hero-content { padding: 0 var(--s-5); }
  .scroll-hint  { right: var(--s-5); }
  .port-content { padding: var(--s-6) var(--s-5); }
  .filter-bar   { margin-bottom: var(--s-6); }
  .port-grid    { grid-template-columns: 1fr; }
  .port-card    { grid-column: span 1 !important; aspect-ratio: 4/3 !important; }
  .pf-grid      { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  .hero-nav { flex-direction: column; gap: var(--s-2); }
}
```

- [ ] **Step 2: Build and verify**

Run: `ng build --configuration development 2>&1 | Select-Object -Last 5`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/portafolio/portafolio-shell.component.scss
git commit -m "feat: rewrite portafolio-shell SCSS — light shader hero, masonry grid, filter tabs, personal footer"
```

---

### Task 7: Update portafolio-detail TypeScript

**Files:**
- Modify: `src/app/pages/portafolio/portafolio-detail.component.ts`

- [ ] **Step 1: Full rewrite**

Replace the entire content of `src/app/pages/portafolio/portafolio-detail.component.ts`:

```typescript
import { Component, HostListener, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import {
  PortfolioService,
  PortfolioProject,
  ProjectLink,
  PORTFOLIO_CATEGORIES,
} from '../../core/services/portfolio.service';

type Theme = 'cuac' | 'natalia' | 'nathali';

const THEME_AUTHOR: Record<Theme, string> = {
  cuac:    'cuac',
  natalia: 'natalia',
  nathali: 'nathali',
};

const LINK_ICONS: Record<ProjectLink['type'], string> = {
  web:       '🌐',
  video:     '▶',
  behance:   'Bē',
  instagram: '◻',
  other:     '↗',
};

@Component({
  selector: 'app-portafolio-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portafolio-detail.component.html',
  styleUrl: './portafolio-detail.component.scss',
  host: { '[attr.data-theme]': 'theme' },
})
export class PortafolioDetailComponent implements OnInit, OnDestroy {
  private portfolioSvc = inject(PortfolioService);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);

  readonly categorias  = PORTFOLIO_CATEGORIES;
  theme: Theme         = 'cuac';

  readonly project     = signal<PortfolioProject | null>(null);
  readonly cargando    = signal(false);
  readonly notFound    = signal(false);
  readonly lightboxIdx = signal<number | null>(null);
  readonly nextProject = signal<PortfolioProject | null>(null);
  readonly prevProject = signal<PortfolioProject | null>(null);

  private lastFocusedItem: HTMLElement | null = null;

  // ── Navigation ───────────────────────────────────────────────────────────────
  get backUrl(): string {
    const p = this.project();
    if (!p) return '/portafolio';
    if (p.authors.length === 1 && p.authors[0] === 'natalia') return '/portafolio/natalia';
    if (p.authors.length === 1 && p.authors[0] === 'nathali') return '/portafolio/nathali';
    return '/portafolio';
  }

  get backLabel(): string {
    const p = this.project();
    if (!p) return '← Portafolio';
    if (p.authors.length === 1 && p.authors[0] === 'natalia') return '← Natalia';
    if (p.authors.length === 1 && p.authors[0] === 'nathali') return '← Nathali';
    return '← Portafolio';
  }

  // ── Labels ────────────────────────────────────────────────────────────────────
  authorLabel(a: string): string {
    if (a === 'natalia') return 'Natalia Castañeda Caicedo';
    if (a === 'nathali') return 'Nathali Ramírez Ortiz';
    return 'Cuac Design';
  }

  catLabel(id: string): string {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }

  linkIcon(type: ProjectLink['type']): string {
    return LINK_ICONS[type] ?? '↗';
  }

  linkDomain(url: string): string {
    try { return new URL(url).hostname.replace('www.', ''); }
    catch { return url; }
  }

  // ── Lightbox ──────────────────────────────────────────────────────────────────
  openLightbox(i: number, event?: MouseEvent) {
    this.lastFocusedItem = (event?.currentTarget as HTMLElement) ?? null;
    this.lightboxIdx.set(i);
    document.body.style.overflow = 'hidden';
    setTimeout(() => (document.querySelector('.lb-close') as HTMLElement)?.focus(), 50);
  }

  closeLightbox() {
    this.lightboxIdx.set(null);
    document.body.style.overflow = '';
    setTimeout(() => this.lastFocusedItem?.focus(), 50);
  }

  prevImage() {
    const images = this.project()?.images ?? [];
    const cur    = this.lightboxIdx();
    if (cur === null || images.length === 0) return;
    this.lightboxIdx.set((cur - 1 + images.length) % images.length);
  }

  nextImage() {
    const images = this.project()?.images ?? [];
    const cur    = this.lightboxIdx();
    if (cur === null || images.length === 0) return;
    this.lightboxIdx.set((cur + 1) % images.length);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (this.lightboxIdx() === null) return;
    if (e.key === 'Escape')     this.closeLightbox();
    if (e.key === 'ArrowLeft')  this.prevImage();
    if (e.key === 'ArrowRight') this.nextImage();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) { this.router.navigate(['/portafolio']); return; }

    this.cargando.set(true);
    const p = await this.portfolioSvc.getBySlug(slug);
    this.cargando.set(false);

    if (!p) { this.notFound.set(true); return; }
    this.project.set(p);
    this.theme = this.deriveTheme(p.authors);

    const siblings = await this.portfolioSvc.getPublished(THEME_AUTHOR[this.theme]);
    const idx      = siblings.findIndex(s => s.id === p.id);
    this.prevProject.set(siblings[idx - 1] ?? null);
    this.nextProject.set(siblings[idx + 1] ?? null);
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  private deriveTheme(authors: string[]): Theme {
    if (authors.length === 1) {
      if (authors[0] === 'natalia') return 'natalia';
      if (authors[0] === 'nathali') return 'nathali';
    }
    return 'cuac';
  }
}
```

- [ ] **Step 2: Build to verify types**

Run: `ng build --configuration development 2>&1 | Select-Object -Last 10`
Expected: 0 errors. `ProjectLink` imports from service, all signals typed correctly.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/portafolio/portafolio-detail.component.ts
git commit -m "feat: add nextProject, prevProject signals and linkIcon/linkDomain methods to portafolio-detail"
```

---

### Task 8: Update portafolio-detail HTML

**Files:**
- Modify: `src/app/pages/portafolio/portafolio-detail.component.html`

- [ ] **Step 1: Full rewrite**

Replace the entire content of `src/app/pages/portafolio/portafolio-detail.component.html`:

```html
@if (cargando()) {
  <div class="state-screen">
    <p class="state-label" role="status">Cargando proyecto…</p>
  </div>
}

@if (notFound()) {
  <div class="state-screen">
    <p class="state-title">Proyecto no encontrado.</p>
    <a class="back-link-lg" routerLink="/portafolio">← Volver al portafolio</a>
  </div>
}

@if (project(); as p) {

  <!-- ── Hero ─────────────────────────────────────────────────────────────── -->
  <div class="detail-hero"
       [class.has-cover]="!!p.cover_url"
       [style.backgroundImage]="p.cover_url ? 'url(' + p.cover_url + ')' : null">
    <div class="detail-hero-inner">
      <div class="back-nav">
        <a class="back-link" routerLink="/">← Inicio</a>
        <a class="back-link" [routerLink]="backUrl">{{ backLabel }}</a>
      </div>
      <div class="detail-eyebrow">
        <span class="pulse" aria-hidden="true"></span>
        {{ catLabel(p.category) }}
      </div>
      <h1>{{ p.title }}</h1>
      @if (p.headline) {
        <p class="hero-headline">{{ p.headline }}</p>
      }
    </div>
  </div>

  <!-- ── Body ──────────────────────────────────────────────────────────────── -->
  <div class="detail-body">

    <!-- Main column -->
    <div class="detail-main">

      @if (p.description) {
        <section class="detail-section">
          <h2 class="section-label">Sobre el proyecto</h2>
          <p class="detail-description">{{ p.description }}</p>
        </section>
      }

      @if (p.images.length > 0) {
        <section class="detail-section">
          <h2 class="section-label">Galería</h2>
          <div class="detail-gallery">
            @for (img of p.images; track img; let i = $index) {
              <button
                class="gallery-item"
                [class.span-full]="p.images.length % 2 !== 0 && i === p.images.length - 1"
                [style.backgroundImage]="'url(' + img + ')'"
                (click)="openLightbox(i, $event)"
                [attr.aria-label]="'Ver imagen ' + (i + 1) + ' en pantalla completa'">
                <span class="gallery-zoom" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" width="18" height="18"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/></svg>
                </span>
              </button>
            }
          </div>
        </section>
      }

      <!-- ── Links section ────────────────────────────────────────────────── -->
      @if (p.links && p.links.length > 0) {
        <section class="detail-section">
          <h2 class="section-label">Ver en acción</h2>
          <div class="links-grid">
            @for (link of p.links; track link.url) {
              <a class="link-item"
                 [href]="link.url"
                 target="_blank"
                 rel="noopener noreferrer"
                 [attr.aria-label]="link.label + ' — ' + linkDomain(link.url) + ' (abre en nueva pestaña)'">
                <div class="link-icon" [attr.data-type]="link.type" aria-hidden="true">
                  {{ linkIcon(link.type) }}
                </div>
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

      <!-- ── Next project ──────────────────────────────────────────────────── -->
      @if (nextProject()) {
        <section class="next-project-nav" aria-label="Siguiente proyecto">
          <p class="next-project-eyebrow">Siguiente proyecto</p>
          <a class="next-project-card" [routerLink]="['/portafolio', nextProject()!.slug]">
            @if (nextProject()!.cover_url) {
              <div class="next-project-cover"
                   [style.backgroundImage]="'url(' + nextProject()!.cover_url + ')'">
              </div>
            }
            <div class="next-project-info">
              <span class="next-cat">{{ catLabel(nextProject()!.category) }}</span>
              <span class="next-title">{{ nextProject()!.title }}</span>
            </div>
            <span class="next-arrow" aria-hidden="true">→</span>
          </a>
        </section>
      }

    </div><!-- /detail-main -->

    <!-- Sidebar -->
    <aside class="detail-sidebar">

      <div class="meta-card">
        <dl class="meta-list">
          <div class="meta-row">
            <dt>Categoría</dt>
            <dd>{{ catLabel(p.category) }}</dd>
          </div>
          @if (p.client_name) {
            <div class="meta-row">
              <dt>Cliente</dt>
              <dd>{{ p.client_name }}</dd>
            </div>
          }
          <div class="meta-row">
            <dt>Equipo</dt>
            <dd>
              @for (a of p.authors; track a) {
                <span class="author-name">{{ authorLabel(a) }}</span>
              }
            </dd>
          </div>
          @if (p.tags.length > 0) {
            <div class="meta-row">
              <dt>Disciplinas</dt>
              <dd class="tags-dd">
                @for (t of p.tags; track t) {
                  <span class="tag">{{ t }}</span>
                }
              </dd>
            </div>
          }
        </dl>
      </div>

      @if (p.client_comment) {
        <blockquote class="client-quote">
          <p>{{ p.client_comment }}</p>
          @if (p.client_name) {
            <cite>{{ p.client_name }}</cite>
          }
        </blockquote>
      }

    </aside>

  </div><!-- /detail-body -->

  <!-- Footer nav -->
  <div class="detail-footer">
    <div class="detail-footer-inner">
      <a class="back-link-lg" [routerLink]="backUrl">{{ backLabel }}</a>
    </div>
  </div>

  <!-- ── Lightbox ──────────────────────────────────────────────────────────── -->
  @if (lightboxIdx() !== null) {
    <div class="lightbox" (click)="closeLightbox()" role="dialog" aria-modal="true" aria-label="Galería de imágenes">
      <button class="lb-close" (click)="closeLightbox()" aria-label="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
      @if (p.images.length > 1) {
        <button class="lb-arrow lb-prev" (click)="$event.stopPropagation(); prevImage()" aria-label="Imagen anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="22" height="22"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      }
      <img class="lb-img"
           [src]="p.images[lightboxIdx()!]"
           [alt]="'Imagen ' + (lightboxIdx()! + 1) + ' de ' + p.images.length"
           (click)="$event.stopPropagation()" />
      @if (p.images.length > 1) {
        <button class="lb-arrow lb-next" (click)="$event.stopPropagation(); nextImage()" aria-label="Imagen siguiente">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="22" height="22"><path d="m9 18 6-6-6-6"/></svg>
        </button>
        <div class="lb-counter" aria-live="polite">{{ lightboxIdx()! + 1 }} / {{ p.images.length }}</div>
      }
    </div>
  }

}
```

- [ ] **Step 2: Build to verify**

Run: `ng build --configuration development 2>&1 | Select-Object -Last 10`
Expected: 0 template errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/portafolio/portafolio-detail.component.html
git commit -m "feat: add links section and next-project nav to portafolio-detail HTML"
```

---

### Task 9: Update portafolio-detail SCSS

**Files:**
- Modify: `src/app/pages/portafolio/portafolio-detail.component.scss`

- [ ] **Step 1: Insert links and next-project styles**

In `src/app/pages/portafolio/portafolio-detail.component.scss`, find the line `// ── Touch: zoom siempre visible` and insert the following block immediately before it:

```scss
// ── Links section ─────────────────────────────────────────────────────────────
.links-grid {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}

.link-item {
  display: flex;
  align-items: center;
  gap: var(--s-4);
  padding: var(--s-4) var(--s-5);
  border-radius: var(--r-md);
  border: 1px solid rgba(21, 31, 40, 0.08);
  text-decoration: none;
  color: var(--ink, #151F28);
  transition: transform 0.2s ease, border-color 0.2s;

  &:hover {
    transform: translateX(3px);
    border-color: rgba(21, 31, 40, 0.16);

    .link-arrow { color: var(--theme-accent, var(--ember)); }
  }
}

.link-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;

  &[data-type="web"]       { background: rgba(236, 56, 19, 0.10); }
  &[data-type="video"]     { background: rgba(30, 80, 200, 0.10); }
  &[data-type="behance"]   { background: rgba(20, 100, 220, 0.10); }
  &[data-type="instagram"] { background: rgba(180, 40, 120, 0.10); }
  &[data-type="other"]     { background: rgba(21, 31, 40, 0.08); }
}

.link-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.link-label {
  font-family: var(--sans);
  font-weight: 600;
  font-size: 14px;
  color: var(--ink, #151F28);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-url {
  font-family: var(--mono);
  font-size: 11px;
  color: rgba(21, 31, 40, 0.40);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-arrow {
  font-size: 16px;
  color: rgba(21, 31, 40, 0.22);
  transition: color 0.2s;
  flex-shrink: 0;
}

// ── Next project nav ──────────────────────────────────────────────────────────
.next-project-nav {
  border-top: 1px solid rgba(21, 31, 40, 0.08);
  padding-top: var(--s-6);
  margin-top: var(--s-8);
}

.next-project-eyebrow {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(21, 31, 40, 0.32);
  margin: 0 0 var(--s-4);
}

.next-project-card {
  display: flex;
  align-items: center;
  gap: var(--s-5);
  text-decoration: none;
  color: var(--ink, #151F28);
  padding: var(--s-4);
  margin: 0 calc(-1 * var(--s-4));
  border-radius: var(--r-lg);
  transition: background 0.2s;

  &:hover {
    background: rgba(21, 31, 40, 0.04);
    .next-arrow { transform: translateX(4px); }
  }
}

.next-project-cover {
  width: 88px;
  height: 60px;
  border-radius: var(--r-md);
  background-size: cover;
  background-position: center;
  background-color: var(--theme-surface, var(--mist));
  flex-shrink: 0;
}

.next-project-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.next-cat {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--theme-accent, var(--ember));
}

.next-title {
  font-family: var(--sans);
  font-weight: 700;
  font-size: 16px;
  color: var(--ink, #151F28);
  line-height: 1.2;
}

.next-arrow {
  font-size: 20px;
  color: rgba(21, 31, 40, 0.22);
  transition: transform 0.2s ease, color 0.2s;
  flex-shrink: 0;
}

```

- [ ] **Step 2: Add reduced-motion rules for new elements**

In the `@media (prefers-reduced-motion: reduce)` block (already present in the file), add:

```scss
  .link-item        { transition: none; }
  .link-arrow       { transition: none; }
  .next-project-card { transition: none; }
  .next-arrow       { transition: none; }
```

- [ ] **Step 3: Build to verify**

Run: `ng build --configuration development 2>&1 | Select-Object -Last 5`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/portafolio/portafolio-detail.component.scss
git commit -m "feat: add links section and next-project nav styles to portafolio-detail"
```

---

### Task 10: Admin form — links field

**Files:**
- Modify: `src/app/pages/admin/portafolio/admin-portafolio-form.component.ts`
- Modify: `src/app/pages/admin/portafolio/admin-portafolio-form.component.html`
- Modify: `src/app/pages/admin/portafolio/admin-portafolio-form.component.scss`

- [ ] **Step 1: Add links to admin-portafolio-form.component.ts**

Make three targeted changes to the file:

**1a.** Update the import to include `ProjectLink`:

```typescript
import {
  PortfolioService,
  PORTFOLIO_CATEGORIES,
  ProjectLink,
} from '../../../core/services/portfolio.service';
```

**1b.** Add `links` signal after the `tags` signal declaration (after `readonly tags = signal<string[]>([]); `):

```typescript
readonly links = signal<ProjectLink[]>([]);
```

**1c.** Add link management methods after `removeTag()`:

```typescript
addLink() {
  if (this.links().length >= 5) return;
  this.links.update(list => [...list, { label: '', url: '', type: 'web' }]);
}

removeLink(i: number) {
  this.links.update(list => list.filter((_, idx) => idx !== i));
}

updateLink(i: number, field: keyof ProjectLink, value: string) {
  this.links.update(list =>
    list.map((link, idx) => idx === i ? { ...link, [field]: value } : link)
  );
}
```

**1d.** In `ngOnInit`, after `this.tags.set(p.tags);`, add:

```typescript
this.links.set((p.links as ProjectLink[]) ?? []);
```

**1e.** In the `payload` object inside `guardar()`, add `links: this.links()` after `tags: this.tags()`:

```typescript
const payload = {
  title:          v.title!,
  slug,
  category:       v.category!,
  authors:        this.selectedAuthors(),
  headline:       v.headline || null,
  client_name:    v.client_name || null,
  description:    v.description || null,
  client_comment: v.client_comment || null,
  cover_url:      coverUrl,
  images,
  tags:           this.tags(),
  links:          this.links(),
  featured:       v.featured ?? false,
  published:      v.published ?? false,
};
```

- [ ] **Step 2: Add links field to admin-portafolio-form.component.html**

In the HTML file, find the closing `</div>` of the tags field block (after line 102, the `@if (tags().length > 0)` block). Insert the following immediately after it, before `<div class="grid-2">`:

```html
        <div class="field">
          <div class="links-field-header">
            <label class="links-field-label">Links del proyecto <span class="opt">opcional</span></label>
            <button type="button" class="btn-sm ghost" (click)="addLink()" [disabled]="links().length >= 5">
              + Agregar link
            </button>
          </div>

          @for (link of links(); track $index; let i = $index) {
            <div class="link-row">
              <select class="input select link-type-select"
                      [value]="link.type"
                      (change)="updateLink(i, 'type', $any($event.target).value)">
                <option value="web">Sitio web</option>
                <option value="video">Video</option>
                <option value="behance">Behance</option>
                <option value="instagram">Instagram</option>
                <option value="other">Otro</option>
              </select>
              <input type="text"
                     class="input"
                     placeholder="Etiqueta (ej: Sitio publicado)"
                     [value]="link.label"
                     (input)="updateLink(i, 'label', $any($event.target).value)" />
              <input type="url"
                     class="input"
                     placeholder="https://..."
                     [value]="link.url"
                     (input)="updateLink(i, 'url', $any($event.target).value)" />
              <button type="button" class="btn-remove-link" (click)="removeLink(i)" aria-label="Eliminar link">×</button>
            </div>
          }

          @if (links().length === 0) {
            <p class="help">Sin links. Máximo 5.</p>
          }
        </div>
```

- [ ] **Step 3: Add link row styles to admin-portafolio-form.component.scss**

Append to the end of `src/app/pages/admin/portafolio/admin-portafolio-form.component.scss`:

```scss
.links-field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--s-3);
}

.links-field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink, #151F28);
}

.link-row {
  display: grid;
  grid-template-columns: 130px 1fr 1fr 36px;
  gap: var(--s-3);
  margin-bottom: var(--s-3);
  align-items: center;
}

.link-type-select { font-size: 13px; }

.btn-remove-link {
  width: 36px;
  height: 36px;
  border-radius: var(--r-sm);
  border: 1px solid rgba(236, 56, 19, 0.25);
  background: transparent;
  color: var(--ember, #EC3813);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;

  &:hover { background: rgba(236, 56, 19, 0.08); }
}

@media (max-width: 640px) {
  .link-row {
    grid-template-columns: 1fr 36px;
    grid-template-rows: auto auto auto;

    .link-type-select  { grid-column: 1; grid-row: 1; }
    :nth-child(2)      { grid-column: 1; grid-row: 2; }
    :nth-child(3)      { grid-column: 1; grid-row: 3; }
    .btn-remove-link   { grid-column: 2; grid-row: 1 / 4; align-self: center; }
  }
}
```

- [ ] **Step 4: Build and verify**

Run: `ng build --configuration development 2>&1 | Select-Object -Last 10`
Expected: 0 errors. `ProjectLink['type']` resolves, `links` signal types match.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/portafolio/
git commit -m "feat: add dynamic links field to admin portafolio form (max 5, label + url + type)"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| All light backgrounds (AAA contrast) | Task 1 (tokens) + Task 6 (shell SCSS) |
| Three.js GLSL shader, mouse-reactive | Task 3 (shader component) |
| Uniforms per theme (cuac/natalia/nathali) | Task 3 (`THEME_COLORS` constant) |
| `prefers-reduced-motion` freezes shader | Task 3 (`noMotion` flag) |
| `pixelRatio = min(DPR, 2)` | Task 3 |
| Shader `ResizeObserver` with 100ms debounce | Task 3 |
| Shader cleanup on `ngOnDestroy` | Task 3 (`destroyRef.onDestroy`) |
| Filter bar tabs with ember underline | Task 5 + 6 |
| `aria-pressed` on filter buttons | Task 5 |
| Only show categories with > 0 projects | Task 5 |
| 12-col masonry with `assignSpans` | Task 4 + 5 + 6 |
| Featured → col-8, col-5+col-7 patterns | Task 4 (`assignSpans` function) |
| Card overlay hover + touch always-visible | Task 6 |
| Personal footer Natalia/Nathali cards | Task 5 + 6 |
| Radial gradient hover on personal footer | Task 6 (`.pf-card::before`) |
| Hero cover double overlay (existing) | Already in `portafolio-detail.component.scss` |
| Links section "Ver en acción" | Task 7 (TS) + 8 (HTML) + 9 (SCSS) |
| Max 5 links per project | Task 7 (service), Task 10 (admin) |
| Link icons by type | Task 7 (`LINK_ICONS` constant) |
| `linkDomain()` helper | Task 7 |
| Links open `target="_blank" rel="noopener"` | Task 8 |
| Hover `translateX(3px)` on link items | Task 9 |
| Next/prev project signals | Task 7 |
| Next-project nav at end of `.detail-main` | Task 8 + 9 |
| Supabase migration SQL | Task 2 |
| Admin form links field (max 5) | Task 10 |
| `aria-live` on lightbox counter | Task 8 |

**Type consistency:** `SpanProject` (Task 4) used in `filteredProjects` signal type — ✅. `ProjectLink` (Task 2) imported in Tasks 7 and 10 — ✅. `THEME_AUTHOR` defined identically in shell (Task 4) and detail (Task 7) — ✅. `linkIcon(type: ProjectLink['type'])` defined (Task 7) and called (Task 8) with `link.type` — ✅.

**Placeholder scan:** No TBD, TODO, or incomplete sections present.
