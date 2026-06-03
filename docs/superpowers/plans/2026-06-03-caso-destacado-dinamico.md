# Caso Destacado Dinámico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar la sección "Caso destacado" del home al último proyecto de Cuac marcado como `featured: true` en Supabase, mostrando un collage real de imágenes y un enlace a la página completa del proyecto.

**Architecture:** Se agrega `getFeatured(author)` a `PortfolioService` (consulta directa, 1 row). `CaseStudyComponent` se convierte en un componente con estado que carga el proyecto en `ngOnInit` via señales. El panel visual decorativo se reemplaza por un `<div class="case-collage">` con clases dinámicas (`n1`–`n5`) que controlan el layout CSS Grid según la cantidad de imágenes disponibles.

**Tech Stack:** Angular 17+ (standalone, signals, `@if`/`@for`), Supabase JS client, SCSS con CSS Grid.

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/app/core/services/portfolio.service.ts` | Agregar método `getFeatured` |
| `src/app/pages/home/sections/case-study/case-study.component.ts` | Refactorizar a componente con estado |
| `src/app/pages/home/sections/case-study/case-study.component.html` | Template dinámico con collage |
| `src/app/pages/home/sections/case-study/case-study.component.scss` | Añadir `.case-collage`, remover decorativos |

---

## Task 1: Agregar `getFeatured` a `PortfolioService`

**Files:**
- Modify: `src/app/core/services/portfolio.service.ts`

- [ ] **Step 1: Agregar el método después de `getBySlug`**

En `src/app/core/services/portfolio.service.ts`, insertar después del método `getBySlug`:

```typescript
async getFeatured(author: PortfolioOwner): Promise<PortfolioProject | null> {
  const { data, error } = await this.sb.db
    .from('portfolio_projects')
    .select('*')
    .eq('featured', true)
    .eq('published', true)
    .contains('authors', [author])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) console.error('[portfolio] getFeatured:', error.message);
  return data as PortfolioProject | null;
}
```

- [ ] **Step 2: Verificar que el build compila**

```bash
npx ng build --configuration development 2>&1 | tail -5
```

Esperado: `Application bundle generation complete.` sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/portfolio.service.ts
git commit -m "feat(portfolio): add getFeatured(author) method"
```

---

## Task 2: Refactorizar `CaseStudyComponent` TypeScript

**Files:**
- Modify: `src/app/pages/home/sections/case-study/case-study.component.ts`

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```typescript
import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  PortfolioService,
  PortfolioProject,
  PORTFOLIO_CATEGORIES,
} from '../../../../core/services/portfolio.service';

@Component({
  selector: 'app-case-study',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './case-study.component.html',
  styleUrl: './case-study.component.scss',
})
export class CaseStudyComponent implements OnInit {
  private portfolioSvc = inject(PortfolioService);

  readonly project  = signal<PortfolioProject | null>(null);
  readonly cargando = signal(true);

  readonly collageImages = computed<string[]>(() => {
    const p = this.project();
    if (!p) return [];
    return [p.cover_url, ...p.images]
      .filter((u): u is string => !!u)
      .slice(0, 5);
  });

  readonly categoryLabel = computed<string>(() => {
    const p = this.project();
    if (!p) return '';
    return PORTFOLIO_CATEGORIES.find(c => c.id === p.category)?.label ?? p.category;
  });

  async ngOnInit() {
    const p = await this.portfolioSvc.getFeatured('cuac');
    this.project.set(p);
    this.cargando.set(false);
  }
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx ng build --configuration development 2>&1 | tail -5
```

Esperado: `Application bundle generation complete.` sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/home/sections/case-study/case-study.component.ts
git commit -m "feat(case-study): inject PortfolioService, add signals and computed helpers"
```

---

## Task 3: Actualizar el template

**Files:**
- Modify: `src/app/pages/home/sections/case-study/case-study.component.html`

- [ ] **Step 1: Reemplazar el contenido completo del template**

```html
@if (project(); as p) {
  <div class="case-wrap" id="casos">
    <div class="case" [class.case--full]="!collageImages().length">

      <!-- ── Columna de texto ──────────────────────────────────────────────── -->
      <div>
        <div class="eyebrow case-eyebrow">
          <span class="dot case-dot"></span>
          04 &mdash; Caso destacado
        </div>

        <h2>{{ p.title }}</h2>

        <p>{{ p.headline ?? p.description }}</p>

        <div class="case-stats">
          @if (categoryLabel()) {
            <div class="case-stat">
              <div class="k">Categoría</div>
              <div class="v">{{ categoryLabel() }}</div>
            </div>
          }
          @if (p.client_name) {
            <div class="case-stat">
              <div class="k">Cliente</div>
              <div class="v">{{ p.client_name }}</div>
            </div>
          }
          @if (p.tags.length) {
            <div class="case-stat">
              <div class="k">Disciplinas</div>
              <div class="v">{{ p.tags.slice(0, 3).join(' · ') }}</div>
            </div>
          }
        </div>

        <a class="case-link" [routerLink]="['/portafolio', p.slug]">
          Ver el caso completo <span aria-hidden="true">→</span>
        </a>
      </div>

      <!-- ── Collage de imágenes ───────────────────────────────────────────── -->
      @if (collageImages().length) {
        <div class="case-collage" [class]="'n' + collageImages().length" aria-hidden="true">
          @for (img of collageImages(); track img) {
            <img [src]="img" [alt]="p.title" loading="lazy" />
          }
        </div>
      }

    </div>
  </div>
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx ng build --configuration development 2>&1 | tail -5
```

Esperado: `Application bundle generation complete.` sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/home/sections/case-study/case-study.component.html
git commit -m "feat(case-study): dynamic template — title, stats, collage, routerLink"
```

---

## Task 4: Actualizar estilos — collage + limpiar decorativos

**Files:**
- Modify: `src/app/pages/home/sections/case-study/case-study.component.scss`

- [ ] **Step 1: Reemplazar el contenido completo del archivo SCSS**

```scss
.case-wrap {
  background: var(--deep);
  color: var(--paper);
}

.case-eyebrow { color: var(--coral); }
.case-dot     { background: var(--coral); }

.case {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--s-9) var(--s-7);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-8);
  align-items: center;

  &.case--full {
    grid-template-columns: 1fr;
    max-width: 780px;
  }

  h2 {
    font-family: var(--display);
    font-size: clamp(40px, 4.6vw, 60px);
    line-height: 1.02;
    letter-spacing: -0.015em;
    color: var(--paper);
    margin-bottom: var(--s-5);
  }

  p {
    color: rgba(240, 241, 246, 0.72);
    font-size: 17px;
    line-height: 1.65;
    max-width: 50ch;
    margin-bottom: var(--s-6);
  }
}

.case-stats {
  display: flex;
  gap: var(--s-7);
  margin-bottom: var(--s-6);
}

.case-stat {
  .k {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.16em;
    color: rgba(240, 241, 246, 0.45);
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .v {
    font-family: var(--display);
    font-size: clamp(20px, 2.4vw, 32px);
    color: var(--coral);
    line-height: 1.1;
  }
}

.case-link {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--paper);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--coral);
  text-decoration: none;
  transition: color 0.2s, gap 0.2s;

  &:hover {
    color: var(--sky);
    gap: 14px;
  }
}

// ── Collage ──────────────────────────────────────────────────────────────────
.case-collage {
  border-radius: var(--r-lg);
  overflow: hidden;
  border: 1px solid rgba(240, 241, 246, 0.08);
  display: grid;
  gap: 3px;
  background: rgba(240, 241, 246, 0.08);
  height: 100%;
  min-height: 360px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    min-height: 100px;
  }

  // 1 imagen: ocupa todo el panel
  &.n1 {
    grid-template-columns: 1fr;
  }

  // 2 imágenes: dos columnas iguales
  &.n2 {
    grid-template-columns: 1fr 1fr;
  }

  // 3 imágenes: primera ocupa columna izquierda entera, 2 y 3 apiladas a la derecha
  &.n3 {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;

    img:first-child { grid-row: 1 / 3; }
  }

  // 4 imágenes: primera ocupa 2 filas a la izquierda (columna más ancha), resto en grid
  &.n4 {
    grid-template-columns: 2fr 1fr;
    grid-template-rows: 1fr 1fr;

    img:first-child { grid-row: 1 / 3; }
  }

  // 5 imágenes: primera ocupa 2 filas izquierda, última ocupa fila entera abajo
  &.n5 {
    grid-template-columns: 2fr 1fr;
    grid-template-rows: 1fr 1fr 1fr;

    img:first-child { grid-row: 1 / 3; }
    img:last-child  { grid-column: 1 / 3; }
  }
}

// ── Responsive ────────────────────────────────────────────────────────────────
@media (max-width: 1024px) {
  .case { grid-template-columns: 1fr; }
  .case-collage { min-height: 280px; }
}

@media (max-width: 480px) {
  .case-stats {
    flex-wrap: wrap;
    gap: var(--s-5);
  }
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx ng build --configuration development 2>&1 | tail -5
```

Esperado: `Application bundle generation complete.` sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/home/sections/case-study/case-study.component.scss
git commit -m "feat(case-study): collage grid styles, remove static decorative blocks"
```

---

## Task 5: Verificación visual

- [ ] **Step 1: Levantar el servidor de desarrollo**

```bash
npx ng serve
```

Abrir `http://localhost:4200` y navegar a la sección "Caso destacado".

- [ ] **Step 2: Verificar con proyecto destacado activo**

En `/admin/portafolio`, asegurarse de que al menos un proyecto de Cuac tenga `featured: true` y `published: true`. Confirmar que la sección muestra:
- Título del proyecto
- Headline o descripción
- Stats (Categoría, Cliente, Disciplinas) — solo los que tienen datos
- Collage con 1–5 imágenes (o panel oculto si no hay imágenes)
- Botón "Ver el caso completo" que navega a `/portafolio/:slug`

- [ ] **Step 3: Verificar sin proyecto destacado**

Desmarcar `featured` del proyecto en admin → recargar el home → la sección no debe aparecer.

- [ ] **Step 4: Verificar navegación**

Click en "Ver el caso completo" → debe navegar a la página del portafolio del proyecto.

- [ ] **Step 5: Commit final si hay ajustes**

```bash
git add -p
git commit -m "fix(case-study): visual adjustments after review"
```
