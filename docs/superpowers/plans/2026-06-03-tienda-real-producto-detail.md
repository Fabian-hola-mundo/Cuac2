# Tienda real + Vista de producto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar la sección "La tienda" del home con productos reales del admin y crear la vista individual de producto en `/cuaquiverso/tienda/:id`.

**Architecture:** Un campo `destacado` nuevo en `productos_evento` controla qué aparece en el home. `CuaquiversoComponent` consume `InventarioService` (ya existente) para mostrar los 5 productos destacados activos (fallback: 5 más recientes). `ProductoDetailComponent` nuevo carga el producto por ID y muestra galería + info en 2 columnas.

**Tech Stack:** Angular 21, signals, Supabase JS v2, InventarioService (existente), CartService (existente), RouterLink.

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `supabase/migrations/006_destacado.sql` | Crear |
| `src/app/core/services/inventario.service.ts` | Modificar — agregar `destacado` a `ProductoEvento` |
| `src/app/pages/admin/productos/producto-form.component.ts` | Modificar — form control + payload |
| `src/app/pages/admin/productos/producto-form.component.html` | Modificar — toggle UI |
| `src/app/pages/cuaquiverso/cuaquiverso.component.ts` | Modificar — InventarioService, computed showcase |
| `src/app/pages/cuaquiverso/cuaquiverso.component.html` | Modificar — showcase dinámico |
| `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.ts` | Crear |
| `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.html` | Crear |
| `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.scss` | Crear |
| `src/app/app.routes.ts` | Modificar — ruta `/cuaquiverso/tienda/:id` |

---

## Task 1: Migración — columna destacado

**Files:**
- Crear: `supabase/migrations/006_destacado.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/006_destacado.sql
ALTER TABLE productos_evento
  ADD COLUMN IF NOT EXISTS destacado boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Aplicar la migración via MCP Supabase**

Usar la herramienta MCP `apply_migration` con project_id `ytqcwrjxlnlsjgnjxiiw`, name `add_destacado`, y el SQL anterior.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_destacado.sql
git commit -m "feat(db): columna destacado en productos_evento"
```

---

## Task 2: ProductoEvento interface + admin form toggle

**Files:**
- Modificar: `src/app/core/services/inventario.service.ts`
- Modificar: `src/app/pages/admin/productos/producto-form.component.ts`
- Modificar: `src/app/pages/admin/productos/producto-form.component.html`

- [ ] **Step 1: Agregar `destacado` a la interface en `inventario.service.ts`**

Buscar la interfaz `ProductoEvento` y agregar el campo después de `flag`:

```typescript
  flag:          string | null;
  destacado:     boolean;
  descripcion:   string | null;
```

- [ ] **Step 2: Agregar control y payload en `producto-form.component.ts`**

**2a.** En el `form = this.fb.group({...})`, agregar después de `descripcion`:
```typescript
    destacado: [false],
```

**2b.** En `ngOnInit`, en el bloque `this.form.patchValue({...})`, agregar:
```typescript
          destacado:     p.destacado ?? false,
```

**2c.** En `guardar()`, en el bloque `editPayload`, agregar:
```typescript
          destacado:   v.destacado ?? false,
```

**2d.** En `guardar()`, en el bloque `createPayload`, agregar:
```typescript
          destacado:   v.destacado ?? false,
```

- [ ] **Step 3: Agregar toggle en `producto-form.component.html`**

Buscar la sección del campo `activo` (toggle de activar/desactivar producto) e inmediatamente después agregar:

```html
<label class="field-toggle">
  <input type="checkbox" formControlName="destacado" />
  <span class="toggle-track"></span>
  <span class="toggle-label">Mostrar en home del Cuaquiverso</span>
</label>
```

Si el formulario usa clases CSS diferentes para toggles, seguir el patrón exacto del toggle de `activo` ya existente. No crear estilos nuevos.

- [ ] **Step 4: Verificar build**

```bash
npx ng build --configuration=development 2>&1 | tail -5
```

Resultado esperado: `Application bundle generation complete.`

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/inventario.service.ts \
        src/app/pages/admin/productos/producto-form.component.ts \
        src/app/pages/admin/productos/producto-form.component.html
git commit -m "feat(admin): toggle destacado en formulario de producto"
```

---

## Task 3: CuaquiversoComponent — showcase dinámico

**Files:**
- Modificar: `src/app/pages/cuaquiverso/cuaquiverso.component.ts`
- Modificar: `src/app/pages/cuaquiverso/cuaquiverso.component.html`

- [ ] **Step 1: Actualizar `cuaquiverso.component.ts`**

Reemplazar el contenido del archivo con:

```typescript
import { Component, OnInit, afterNextRender, inject, DestroyRef, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { CartService } from './services/cart.service';
import { CartModalComponent } from './cart-modal/cart-modal.component';
import { InventarioService, ProductoEvento } from '../../core/services/inventario.service';

const CAT_SHORT: Record<string, string> = {
  tee:'Camiseta', tote:'Tote bag', libreta:'Libreta', sticker:'Sticker',
  pin:'Pin', gorra:'Gorra', peluche:'Peluche', print:'Print',
  llavero:'Llavero', pañoleta:'Pañoleta', amigurumi:'Amigurumi', charm:'Charm',
};

interface Character {
  key: string;
  name: string;
  color: string;
  wire: string;
}

@Component({
  selector: 'app-cuaquiverso',
  standalone: true,
  imports: [CartModalComponent, RouterLink],
  templateUrl: './cuaquiverso.component.html',
  styleUrl: './cuaquiverso.component.scss',
})
export class CuaquiversoComponent implements OnInit {
  newsletterSubmitted = false;

  readonly cart       = inject(CartService);
  readonly inv        = inject(InventarioService);
  private  destroyRef = inject(DestroyRef);
  private  seo        = inject(SeoService);

  readonly showcaseProducts = computed(() => {
    const activos   = this.inv.productos().filter(p => p.activo);
    const destacados = activos.filter(p => p.destacado);
    return (destacados.length > 0 ? destacados : activos).slice(0, 5);
  });

  ngOnInit(): void {
    this.seo.set({
      title:       'Cuaquiverso — División de producto de Cuac',
      description: 'Personajes colombianos traducidos a objetos: camisetas, libretas, stickers y más.',
      canonical:   'https://cuacdesign.com/cuaquiverso',
    });
    this.inv.cargarTodos();
  }

  constructor() {
    afterNextRender(() => {
      this.initHeroScene();
    });
  }

  catLabel(cat: string): string {
    return CAT_SHORT[cat] ?? cat;
  }

  addToCart(event: Event, p: ProductoEvento): void {
    event.preventDefault();
    event.stopPropagation();
    this.cart.add({
      id:    p.id,
      name:  p.nombre,
      sub:   this.catLabel(p.categoria),
      price: p.precio,
      color: p.color ?? '#3D4856',
    });
  }

  onNewsletterSubmit(event: Event): void {
    event.preventDefault();
    this.newsletterSubmitted = true;
  }

  onStoreSearch(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    console.log('Search:', input.value);
  }

  private async initHeroScene(): Promise<void> {
    // [conservar el método completo initHeroScene() existente sin cambios]
    // Este bloque no se modifica — copiar tal cual desde el archivo actual
  }
}
```

**IMPORTANTE:** El método `initHeroScene()` es largo (~270 líneas con Three.js). Al hacer este cambio, copiar el método completo del archivo original sin modificarlo. Solo cambiar las importaciones y los miembros de la clase listados arriba.

- [ ] **Step 2: Actualizar la sección showcase en `cuaquiverso.component.html`**

Reemplazar el bloque completo desde `<div class="showcase">` hasta `</div>` (que cierra showcase) y la `<div class="tienda-foot">` con:

```html
  <div class="showcase">
    @if (inv.cargando() && showcaseProducts().length === 0) {
      @for (_ of [1,2,3,4,5]; track $index) {
        <div class="pcard" style="background:rgba(21,31,40,.05);border-radius:12px;animation:blink 1.4s ease-in-out infinite"></div>
      }
    }
    @for (p of showcaseProducts(); track p.id; let first = $first) {
      <a class="pcard" [class.feature]="first"
         [routerLink]="['/cuaquiverso/tienda', p.id]">
        <div class="pcard-img" [style.background]="p.color ? p.color + '22' : 'var(--cream-2)'">
          @if (p.flag === 'new')  { <span class="flag new">Nuevo</span> }
          @if (p.flag === 'last') { <span class="flag">Últimas unidades</span> }
          <div class="label">{{ catLabel(p.categoria) }}<br>{{ p.personaje ?? '' }}</div>
          <span class="quick">Ver producto →</span>
        </div>
        <div class="pcard-info">
          <div class="meta">{{ catLabel(p.categoria) }}</div>
          <h4>{{ p.nombre }}</h4>
          <div class="row">
            <span class="price">{{ cart.fmtPrice(p.precio) }}</span>
            <span class="add" (click)="addToCart($event, p)">+</span>
          </div>
        </div>
      </a>
    }
  </div>

  <div class="tienda-foot">
    <span class="seen">
      @if (showcaseProducts().length > 0) {
        Mostrando {{ showcaseProducts().length }} destacados
      } @else {
        Cargando productos...
      }
    </span>
    <a class="btn btn-primary" routerLink="/cuaquiverso/tienda">Ver toda la tienda →</a>
  </div>
```

- [ ] **Step 3: Verificar build**

```bash
npx ng build --configuration=development 2>&1 | tail -5
```

Resultado esperado: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/cuaquiverso/cuaquiverso.component.ts \
        src/app/pages/cuaquiverso/cuaquiverso.component.html
git commit -m "feat(cuaquiverso): showcase dinámico desde InventarioService"
```

---

## Task 4: ProductoDetailComponent — SCSS

**Files:**
- Crear: `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.scss`

- [ ] **Step 1: Crear el archivo de estilos**

```scss
// src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.scss
:host {
  --cream:     #ECEFF3;
  --carbon-08: rgba(21,31,40,0.08);
  --carbon-06: rgba(21,31,40,0.06);
  --carbon-50: rgba(21,31,40,0.50);
  --carbon-40: rgba(21,31,40,0.40);

  display: block;
  background: var(--cream);
  color: var(--carbon);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

// ─── Topbar ──────────────────────────────────────────────────────────────────
.topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 70;
  backdrop-filter: blur(14px) saturate(1.2);
  background: rgba(236,239,243,0.82);
  border-bottom: 1px solid var(--carbon-08);
}
.topbar-inner {
  max-width: 1320px; margin: 0 auto; height: 64px;
  padding: 0 var(--s-7) 0 220px;
  display: flex; align-items: center; justify-content: space-between; gap: var(--s-6);
}
.brand {
  font-family: var(--display); font-size: 18px; font-weight: 400;
  text-decoration: none; color: var(--carbon);
  em { color: var(--ember); font-style: normal; }
}
.top-nav { display: flex; gap: var(--s-5); }
.top-nav a { font-size: 14px; font-weight: 500; color: var(--carbon); text-decoration: none; opacity:.7; &:hover { opacity:1; } }
.top-actions { display: flex; align-items: center; }
.icon-btn {
  position: relative; display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; background: none; border: none; cursor: pointer;
  color: var(--carbon);
  svg { width: 20px; height: 20px; }
}
.badge {
  position: absolute; top: 4px; right: 4px;
  min-width: 16px; height: 16px; border-radius: 999px;
  background: var(--ember); color: #fff;
  font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  padding: 0 4px;
}

// ─── Layout ──────────────────────────────────────────────────────────────────
.detail-wrap {
  max-width: 1080px; margin: 0 auto;
  padding: 96px var(--s-7) var(--s-9);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 56px;
  align-items: start;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    padding: 84px var(--s-5) var(--s-7);
    gap: 28px;
  }
}

// ─── Gallery ─────────────────────────────────────────────────────────────────
.gallery-col { position: sticky; top: 84px; }

.main-img-wrap {
  border-radius: 14px;
  overflow: hidden;
  aspect-ratio: 1 / 1;
  background: rgba(21,31,40,.06);

  img { width: 100%; height: 100%; object-fit: cover; display: block; }
}

.img-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 48px; opacity: .3;
}

.thumbs {
  display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap;
}
.thumb {
  width: 68px; height: 68px; border-radius: 8px;
  overflow: hidden; border: 2px solid transparent;
  cursor: pointer; padding: 0; background: none;
  transition: border-color .15s;
  flex-shrink: 0;

  &.is-active { border-color: var(--carbon); }

  img { width: 100%; height: 100%; object-fit: cover; display: block; }
}

// ─── Info ─────────────────────────────────────────────────────────────────────
.crumbs {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--carbon-50);
  margin-bottom: 20px;
  a { color: var(--carbon-50); text-decoration: none; &:hover { color: var(--carbon); } }
  span { opacity: .5; }
}

.product-tags {
  display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;
}
.tag {
  padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
  background: rgba(21,31,40,.07); color: var(--carbon);
}

.product-name {
  font-family: var(--display); font-size: 30px; font-weight: 400;
  letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 10px;
}

.product-price {
  font-size: 26px; font-weight: 700; letter-spacing: -0.03em;
  margin-bottom: 16px;
}

.flag-badge {
  display: inline-flex; align-items: center;
  padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 700; margin-bottom: 16px;
  &.new  { background: #D7EBDD; color: #1F5C39; }
  &.last { background: #FBE0D5; color: #7A2A10; }
}

.product-desc {
  font-size: 15px; color: var(--carbon-50); line-height: 1.65;
  margin-bottom: 20px; max-width: 52ch;
}

.material-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .08em; color: var(--carbon-40); margin-bottom: 8px;
}
.material-chips {
  display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px;
}
.chip {
  padding: 5px 12px; border-radius: 8px;
  background: rgba(21,31,40,.06); font-size: 13px;
}

.stock-warning {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: #7A2A10;
  background: #FBE0D5; border: 1px solid #F5B08E;
  border-radius: 8px; padding: 10px 14px; margin-bottom: 20px;
}

.btn-add {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; padding: 15px 24px; margin-bottom: 14px;
  background: var(--ember); color: #fff;
  border: none; border-radius: 10px;
  font-family: var(--sans); font-size: 16px; font-weight: 700;
  letter-spacing: -0.01em; cursor: pointer;
  transition: background .15s, transform .12s;

  &:hover { background: #d43010; transform: translateY(-1px); }
}

.back-link {
  display: block; text-align: center;
  font-size: 13px; color: var(--carbon-50);
  text-decoration: none;
  &:hover { color: var(--carbon); }
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
.skeleton-wrap {
  max-width: 1080px; margin: 0 auto;
  padding: 96px var(--s-7) var(--s-9);
  display: grid; grid-template-columns: 1fr 1fr; gap: 56px;
  @media (max-width: 860px) { grid-template-columns: 1fr; padding: 84px var(--s-5) var(--s-7); }
}
.sk { background: rgba(21,31,40,.08); border-radius: 12px; animation: sk-pulse 1.4s ease-in-out infinite; }
.sk-sq { aspect-ratio: 1/1; }
.sk-line { height: 16px; margin-bottom: 12px; &.sm { width: 40%; } &.lg { height: 32px; } }
@keyframes sk-pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }

// ─── Not found ────────────────────────────────────────────────────────────────
.not-found {
  max-width: 480px; margin: 120px auto; text-align: center; padding: 0 var(--s-5);
  h2 { font-family: var(--display); font-size: 24px; margin-bottom: 8px; }
  p  { color: var(--carbon-50); margin-bottom: 24px; }
}
.btn-back-tienda {
  display: inline-block; padding: 12px 24px;
  background: var(--carbon); color: var(--cream);
  border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 14px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.scss
git commit -m "feat(producto-detail): estilos del componente de detalle"
```

---

## Task 5: ProductoDetailComponent — HTML

**Files:**
- Crear: `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.html`

- [ ] **Step 1: Crear el template**

```html
<!-- src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.html -->

@if (loading()) {
  <div class="skeleton-wrap">
    <div class="sk sk-sq"></div>
    <div>
      <div class="sk sk-line sm"></div>
      <div class="sk sk-line lg"></div>
      <div class="sk sk-line sm" style="width:30%;margin-bottom:24px"></div>
      <div class="sk sk-line"></div>
      <div class="sk sk-line" style="width:80%"></div>
      <div class="sk sk-line" style="width:60%"></div>
    </div>
  </div>
}

@if (!loading() && notFound()) {
  <div class="not-found">
    <h2>Producto no encontrado</h2>
    <p>Este producto no existe o ya no está disponible.</p>
    <a class="btn-back-tienda" routerLink="/cuaquiverso/tienda">Ver la tienda</a>
  </div>
}

@if (!loading() && producto()) {
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" routerLink="/cuaquiverso">Cuaqui<em>verso</em></a>
      <nav class="top-nav">
        <a routerLink="/cuaquiverso/tienda">Tienda</a>
        <a routerLink="/cuaquiverso/universo">Universo</a>
      </nav>
      <div class="top-actions">
        <button class="icon-btn" aria-label="Carrito" (click)="cart.open()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 4h2l2.5 12.5h11L21 7H7"/>
            <circle cx="9" cy="20" r="1.5"/>
            <circle cx="18" cy="20" r="1.5"/>
          </svg>
          @if (cart.count() > 0) { <span class="badge">{{ cart.count() }}</span> }
        </button>
      </div>
    </div>
  </header>

  <div class="detail-wrap">

    <!-- Galería -->
    <div class="gallery-col">
      <div class="main-img-wrap">
        @if (mainImg()) {
          <img [src]="mainImg()!" [alt]="producto()!.nombre" />
        } @else {
          <div class="img-placeholder"
               [style.background]="producto()!.color ? producto()!.color + '33' : 'rgba(21,31,40,.06)'">
          </div>
        }
      </div>
      @if (allImgs().length > 1) {
        <div class="thumbs">
          @for (img of allImgs(); track img; let i = $index) {
            <button class="thumb"
                    [class.is-active]="(selectedImg() ?? allImgs()[0]) === img"
                    (click)="selectedImg.set(img)"
                    [attr.aria-label]="'Imagen ' + (i + 1)">
              <img [src]="img" alt="" />
            </button>
          }
        </div>
      }
    </div>

    <!-- Info -->
    <div class="info-col">
      <div class="crumbs">
        <a routerLink="/cuaquiverso">Inicio</a>
        <span>/</span>
        <a routerLink="/cuaquiverso/tienda">Tienda</a>
        <span>/</span>
        <span>{{ producto()!.nombre }}</span>
      </div>

      <div class="product-tags">
        <span class="tag">{{ catLabel(producto()!.categoria) }}</span>
        @if (producto()!.personaje) {
          <span class="tag">{{ charLabel(producto()!.personaje!) }}</span>
        }
      </div>

      <h1 class="product-name">{{ producto()!.nombre }}</h1>
      <div class="product-price">{{ fmtPrice(producto()!.precio) }} COP</div>

      @if (producto()!.flag === 'new') {
        <div class="flag-badge new">Recién llegado</div>
      }
      @if (producto()!.flag === 'last') {
        <div class="flag-badge last">Últimas unidades</div>
      }

      @if (producto()!.descripcion) {
        <p class="product-desc">{{ producto()!.descripcion }}</p>
      }

      @if (producto()!.material.length > 0) {
        <div class="material-title">Material</div>
        <div class="material-chips">
          @for (m of producto()!.material; track m) {
            <span class="chip">{{ m }}</span>
          }
        </div>
      }

      @if (producto()!.stock_actual > 0 && producto()!.stock_actual <= 5) {
        <div class="stock-warning">
          ⚠ Quedan solo {{ producto()!.stock_actual }} unidades
        </div>
      }

      <button class="btn-add" (click)="addToCart()">
        Agregar al carrito
      </button>

      <a class="back-link" routerLink="/cuaquiverso/tienda">
        ← Volver a la tienda
      </a>
    </div>

  </div>
}

<app-cart-modal></app-cart-modal>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.html
git commit -m "feat(producto-detail): template HTML del detalle de producto"
```

---

## Task 6: ProductoDetailComponent — TypeScript

**Files:**
- Crear: `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.ts`

- [ ] **Step 1: Crear el componente**

```typescript
// src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.ts
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InventarioService, ProductoEvento } from '../../../../core/services/inventario.service';
import { CartService } from '../../services/cart.service';
import { CartModalComponent } from '../../cart-modal/cart-modal.component';
import { SeoService } from '../../../../core/services/seo.service';

const CAT_SHORT: Record<string, string> = {
  tee:'Camiseta', tote:'Tote bag', libreta:'Libreta', sticker:'Sticker',
  pin:'Pin', gorra:'Gorra', peluche:'Peluche', print:'Print',
  llavero:'Llavero', pañoleta:'Pañoleta', amigurumi:'Amigurumi', charm:'Charm',
};

const CHAR_LABEL: Record<string, string> = {
  cuac:'Cuac', kiki:'Kiki', roar:'Roar', yeison:'Yeison',
  abejandro:'Abejandro', atolita:'Atolita', colibriana:'Colibriana', tiburcio:'Tiburcio',
};

@Component({
  selector: 'app-producto-detail',
  standalone: true,
  imports: [RouterLink, CartModalComponent],
  templateUrl: './producto-detail.component.html',
  styleUrl: './producto-detail.component.scss',
})
export class ProductoDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private inv   = inject(InventarioService);
  readonly cart = inject(CartService);
  private seo   = inject(SeoService);

  readonly loading     = signal(true);
  readonly notFound    = signal(false);
  readonly producto    = signal<ProductoEvento | null>(null);
  readonly selectedImg = signal<string | null>(null);

  readonly allImgs = computed(() => {
    const p = this.producto();
    if (!p) return [];
    const imgs: string[] = [];
    if (p.cover_url) imgs.push(p.cover_url);
    p.fotos.forEach(f => { if (f && f !== p.cover_url) imgs.push(f); });
    return imgs;
  });

  readonly mainImg = computed(() => {
    const imgs = this.allImgs();
    return this.selectedImg() ?? imgs[0] ?? null;
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/cuaquiverso/tienda']); return; }

    const data = await this.inv.getProducto(id);
    if (!data) {
      this.notFound.set(true);
    } else {
      this.producto.set(data);
      this.seo.set({
        title:       `${data.nombre} — Cuaquiverso`,
        description: data.descripcion ?? `${CAT_SHORT[data.categoria] ?? data.categoria} del Cuaquiverso. Hecho en Colombia.`,
        canonical:   `https://cuacdesign.com/cuaquiverso/tienda/${id}`,
      });
    }
    this.loading.set(false);
  }

  catLabel(cat: string): string  { return CAT_SHORT[cat] ?? cat; }
  charLabel(ch: string): string  { return CHAR_LABEL[ch] ?? ch; }
  fmtPrice(n: number): string    { return '$' + n.toLocaleString('es-CO'); }

  addToCart(): void {
    const p = this.producto();
    if (!p) return;
    this.cart.add({
      id:    p.id,
      name:  p.nombre,
      sub:   this.catLabel(p.categoria),
      price: p.precio,
      color: p.color ?? '#3D4856',
    });
    this.cart.open();
  }
}
```

- [ ] **Step 2: Verificar build**

```bash
npx ng build --configuration=development 2>&1 | tail -5
```

Resultado esperado: `Application bundle generation complete.`

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.ts
git commit -m "feat(producto-detail): ProductoDetailComponent — galería + info + carrito"
```

---

## Task 7: Routing + tienda pcard links

**Files:**
- Modificar: `src/app/app.routes.ts`
- Modificar: `src/app/pages/cuaquiverso/tienda/tienda.component.html` (línea del pcard `href`)
- Modificar: `src/app/pages/cuaquiverso/tienda/tienda.component.ts` (import RouterLink)

- [ ] **Step 1: Agregar ruta en `app.routes.ts`**

Después de la ruta `cuaquiverso/tienda` existente, agregar:

```typescript
  {
    path: 'cuaquiverso/tienda/:id',
    loadComponent: () =>
      import('./pages/cuaquiverso/tienda/producto/producto-detail.component')
        .then(m => m.ProductoDetailComponent),
  },
```

**IMPORTANTE:** Esta ruta debe ir ANTES de `cuaquiverso/checkout` para que el router la evalúe correctamente.

- [ ] **Step 2: Agregar RouterLink a TiendaComponent**

En `src/app/pages/cuaquiverso/tienda/tienda.component.ts`, en el array `imports`:

Cambiar:
```typescript
  imports: [FormsModule, CartModalComponent],
```
por:
```typescript
  imports: [FormsModule, CartModalComponent, RouterLink],
```

Y agregar el import al inicio del archivo:
```typescript
import { RouterLink } from '@angular/router';
```

- [ ] **Step 3: Actualizar pcard href en tienda.component.html**

Buscar la línea del pcard en el `@for` loop (alrededor de la línea 182):
```html
        <a class="pcard" [attr.data-color]="p.color" href="#">
```
Reemplazar con:
```html
        <a class="pcard" [attr.data-color]="p.color"
           [routerLink]="['/cuaquiverso/tienda', p.id]">
```

- [ ] **Step 4: Verificar build final**

```bash
npx ng build --configuration=development 2>&1 | tail -5
```

Resultado esperado: `Application bundle generation complete.`

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts \
        src/app/pages/cuaquiverso/tienda/tienda.component.ts \
        src/app/pages/cuaquiverso/tienda/tienda.component.html
git commit -m "feat(routing): ruta /cuaquiverso/tienda/:id y links en pcard"
```
