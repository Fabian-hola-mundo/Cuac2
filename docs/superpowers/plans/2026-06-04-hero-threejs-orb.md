# Hero Three.js Ambient Orb — Personaje & Universo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ambient Three.js blob-orb animation (no mouse interaction) to the hero sections of `personaje-page` and `universo` components.

**Architecture:** A `<div id="*-hero-canvas">` is placed inside each hero with `position:absolute;inset:0;pointer-events:none`. Three.js renders a `WebGLRenderer` (alpha:true) into that container. Orb sprites use the character color(s). The scene is bootstrapped via `setTimeout(0)` after data loads in `ngOnInit`, and torn down via `destroyRef.onDestroy`. No GSAP, no raycasting.

**Tech Stack:** Angular 17+ signals, Three.js (dynamic import `import('three')`), TypeScript

---

## File Map

| File | Change |
|------|--------|
| `src/app/pages/cuaquiverso/personaje/personaje-page.component.ts` | Add `DestroyRef`, `PLATFORM_ID`, `isPlatformBrowser`, `initHeroScene(p)` |
| `src/app/pages/cuaquiverso/personaje/personaje-page.component.html` | Add `#pj-hero-canvas` div inside `.pj-hero` |
| `src/app/pages/cuaquiverso/personaje/personaje-page.component.scss` | Style `#pj-hero-canvas` |
| `src/app/pages/cuaquiverso/universo/universo.component.ts` | Add `PLATFORM_ID`, `isPlatformBrowser`, `initHeroScene()` |
| `src/app/pages/cuaquiverso/universo/universo.component.html` | Add `#uni-hero-canvas` div inside `.uni-hero` |
| `src/app/pages/cuaquiverso/universo/universo.component.scss` | Style `#uni-hero-canvas` |

---

## Task 1: personaje-page HTML + SCSS

**Files:**
- Modify: `src/app/pages/cuaquiverso/personaje/personaje-page.component.html`
- Modify: `src/app/pages/cuaquiverso/personaje/personaje-page.component.scss`

- [ ] **Step 1: Add canvas container to hero HTML**

In `personaje-page.component.html`, inside `<section class="pj-hero" ...>`, add the canvas div as the **first child** (before `pj-hero-inner`):

```html
<!-- Hero -->
<section class="pj-hero" [style.--pj-color]="p.color ?? '#2A6FDB'">
  <div id="pj-hero-canvas"></div>
  <div class="pj-hero-inner">
```

- [ ] **Step 2: Add canvas container styles**

In `personaje-page.component.scss`, after the `.pj-hero` block add:

```scss
#pj-hero-canvas {
  position: absolute; inset: 0;
  pointer-events: none; z-index: 0;
  canvas { display: block; width: 100% !important; height: 100% !important; }
}
```

And ensure `.pj-hero-inner` has `z-index: 1` (it already has `position: relative` — just add the z-index):

```scss
.pj-hero-inner { max-width: 1320px; margin: 0 auto; position: relative; z-index: 1; }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/cuaquiverso/personaje/personaje-page.component.html
git add src/app/pages/cuaquiverso/personaje/personaje-page.component.scss
git commit -m "feat(personaje): add pj-hero-canvas container for Three.js"
```

---

## Task 2: personaje-page TypeScript — Three.js scene

**Files:**
- Modify: `src/app/pages/cuaquiverso/personaje/personaje-page.component.ts`

- [ ] **Step 1: Update imports**

Replace the existing import block at the top of `personaje-page.component.ts`:

```typescript
import { Component, OnInit, signal, computed, inject, PLATFORM_ID, DestroyRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { PersonajesService, Personaje } from '../../../core/services/personajes.service';
import { InventarioService, ProductoEvento } from '../../../core/services/inventario.service';
import { CartService } from '../services/cart.service';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { CuaquiversoFooterComponent } from '../footer/cuaquiverso-footer.component';
import { SeoService } from '../../../core/services/seo.service';
```

- [ ] **Step 2: Inject DestroyRef and PLATFORM_ID**

Inside the class body, after the existing `inject` calls, add:

```typescript
private readonly destroyRef  = inject(DestroyRef);
private readonly platformId  = inject(PLATFORM_ID);
```

The full injections block should look like:

```typescript
private route   = inject(ActivatedRoute);
private router  = inject(Router);
private seo     = inject(SeoService);
readonly svcP   = inject(PersonajesService);
readonly svcI   = inject(InventarioService);
readonly cart   = inject(CartService);
private readonly destroyRef  = inject(DestroyRef);
private readonly platformId  = inject(PLATFORM_ID);
readonly String = String;
```

- [ ] **Step 3: Trigger initHeroScene from ngOnInit**

Inside `ngOnInit`, after `this.personaje.set(p)` and before the SEO call, add the trigger:

```typescript
this.personaje.set(p);
if (p.galeria_urls.length > 0) this.selectedImg.set(p.galeria_urls[0]);

if (isPlatformBrowser(this.platformId)) {
  setTimeout(() => this.initHeroScene(p), 0);
}
```

- [ ] **Step 4: Add initHeroScene method**

Add this private method at the end of the class (before the closing `}`):

```typescript
private async initHeroScene(p: Personaje): Promise<void> {
  const container = document.getElementById('pj-hero-canvas');
  if (!container) return;

  const THREE = await import('three');

  const mainColor = p.color       ?? '#2A6FDB';
  const satColor  = p.wire_color  ?? '#5C95EA';

  const orbDefs = [
    { color: mainColor, bx:  1.2, by:  0.5, bz:  0.0, scale: 3.0, opacity: 0.30, sx: 0.28, sy: 0.22, px: 0.0, py: 0.0 },
    { color: satColor,  bx: -0.6, by: -0.8, bz:  0.3, scale: 1.6, opacity: 0.18, sx: 0.35, sy: 0.30, px: 1.2, py: 0.8 },
    { color: satColor,  bx:  0.4, by:  1.1, bz: -0.3, scale: 1.2, opacity: 0.15, sx: 0.42, sy: 0.38, px: 2.4, py: 1.6 },
  ];

  function makeBlobTexture(hex: string) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    const rv = parseInt(hex.slice(1, 3), 16);
    const gv = parseInt(hex.slice(3, 5), 16);
    const bv = parseInt(hex.slice(5, 7), 16);
    ctx.filter = 'blur(16px)';
    const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    grad.addColorStop(0,   `rgba(${rv},${gv},${bv},0.50)`);
    grad.addColorStop(0.4, `rgba(${rv},${gv},${bv},0.18)`);
    grad.addColorStop(1,   `rgba(${rv},${gv},${bv},0.00)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const aspect = () =>
    container.clientHeight > 0 ? container.clientWidth / container.clientHeight : 1;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(38, aspect(), 0.1, 100);
  camera.position.set(0, 0, 5.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  const orbs = orbDefs.map(def => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeBlobTexture(def.color),
      transparent: true,
      opacity: def.opacity,
      blending: THREE.NormalBlending,
      depthWrite: false,
    }));
    sprite.position.set(def.bx, def.by, def.bz);
    sprite.scale.set(def.scale, def.scale, 1);
    sprite.userData = { bx: def.bx, by: def.by, sx: def.sx, sy: def.sy, px: def.px, py: def.py };
    group.add(sprite);
    return sprite;
  });

  const clock = new THREE.Clock();
  let animFrameId: number;

  const tick = () => {
    const t = clock.getElapsedTime();
    group.rotation.y = t * 0.004;
    orbs.forEach(b => {
      const s = b.userData;
      b.position.x = s.bx + Math.sin(t * s.sx + s.px) * 0.18;
      b.position.y = s.by + Math.sin(t * s.sy + s.py) * 0.18;
    });
    renderer.render(scene, camera);
    animFrameId = requestAnimationFrame(tick);
  };
  animFrameId = requestAnimationFrame(tick);

  const onResize = () => {
    if (!container.clientWidth || !container.clientHeight) return;
    camera.aspect = aspect();
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', onResize);

  this.destroyRef.onDestroy(() => {
    cancelAnimationFrame(animFrameId);
    orbs.forEach(b => { b.material.map?.dispose(); b.material.dispose(); });
    renderer.dispose();
    window.removeEventListener('resize', onResize);
  });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd C:/Users/Usuario/Desktop/Documentos/CUAC/rebrand/cuac-design
npx tsc --noEmit
```

Expected: no errors (warnings OK).

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/cuaquiverso/personaje/personaje-page.component.ts
git commit -m "feat(personaje): Three.js ambient orb animation in hero"
```

---

## Task 3: universo HTML + SCSS

**Files:**
- Modify: `src/app/pages/cuaquiverso/universo/universo.component.html`
- Modify: `src/app/pages/cuaquiverso/universo/universo.component.scss`

- [ ] **Step 1: Add canvas container to universo hero HTML**

In `universo.component.html`, find `<section class="uni-hero">` and add the canvas div as its **first child**:

```html
<section class="uni-hero">
  <div id="uni-hero-canvas"></div>
  <div class="uni-hero-inner">
```

- [ ] **Step 2: Add canvas container styles**

In `universo.component.scss`, after the `.uni-hero` block (around line 131), add:

```scss
#uni-hero-canvas {
  position: absolute; inset: 0;
  pointer-events: none; z-index: 0;
  canvas { display: block; width: 100% !important; height: 100% !important; }
}
```

`.uni-hero-inner` already has `position: relative; z-index: 1` — no change needed there.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/cuaquiverso/universo/universo.component.html
git add src/app/pages/cuaquiverso/universo/universo.component.scss
git commit -m "feat(universo): add uni-hero-canvas container for Three.js"
```

---

## Task 4: universo TypeScript — Three.js scene

**Files:**
- Modify: `src/app/pages/cuaquiverso/universo/universo.component.ts`

- [ ] **Step 1: Update imports**

Replace the existing import block at the top of `universo.component.ts`:

```typescript
import { Component, OnInit, afterNextRender, inject, DestroyRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../../core/services/seo.service';
import { CartService } from '../services/cart.service';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { CuaquiversoFooterComponent } from '../footer/cuaquiverso-footer.component';
import { PersonajesService } from '../../../core/services/personajes.service';
```

- [ ] **Step 2: Inject PLATFORM_ID**

Inside the class body, add after the existing `inject` calls:

```typescript
private readonly platformId = inject(PLATFORM_ID);
```

The full injections block:

```typescript
readonly cart = inject(CartService);
private destroyRef = inject(DestroyRef);
private seo        = inject(SeoService);
private readonly platformId = inject(PLATFORM_ID);
readonly personajesSvc = inject(PersonajesService);
readonly String = String;
```

- [ ] **Step 3: Trigger initHeroScene from ngOnInit**

In `ngOnInit`, after `await this.personajesSvc.load()` and before `this.seo.set(...)`, add:

```typescript
async ngOnInit(): Promise<void> {
  await this.personajesSvc.load();

  if (isPlatformBrowser(this.platformId)) {
    setTimeout(() => this.initHeroScene(), 0);
  }

  this.seo.set({
    title:       'El universo — Cuaquiverso',
    description: 'Conoce los personajes del Cuaquiverso: Cuac, Kiki, Roar, Yeison y más.',
    canonical:   'https://cuacdesign.com/cuaquiverso/universo',
  });
  setTimeout(() => this.observeNewReveals(), 0);
}
```

- [ ] **Step 4: Add initHeroScene method**

Add this private method at the end of the class (before the closing `}`):

```typescript
private async initHeroScene(): Promise<void> {
  const container = document.getElementById('uni-hero-canvas');
  if (!container) return;

  const THREE = await import('three');
  const chars = this.personajesSvc.activos().slice(0, 4);
  if (chars.length === 0) return;

  function makeBlobTexture(hex: string) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    const rv = parseInt(hex.slice(1, 3), 16);
    const gv = parseInt(hex.slice(3, 5), 16);
    const bv = parseInt(hex.slice(5, 7), 16);
    ctx.filter = 'blur(16px)';
    const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    grad.addColorStop(0,   `rgba(${rv},${gv},${bv},0.50)`);
    grad.addColorStop(0.4, `rgba(${rv},${gv},${bv},0.18)`);
    grad.addColorStop(1,   `rgba(${rv},${gv},${bv},0.00)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const layout: [number, number, number, number][] = [
    [ 1.8,  0.6,  0.0, 2.4],
    [-1.4,  1.0, -0.2, 2.0],
    [ 0.8, -1.0,  0.4, 2.2],
    [-0.6, -0.5,  0.0, 1.8],
  ];

  const speeds = [
    { sx: 0.28, sy: 0.22, px: 0.0, py: 0.0 },
    { sx: 0.35, sy: 0.30, px: 1.2, py: 0.8 },
    { sx: 0.42, sy: 0.38, px: 2.4, py: 1.6 },
    { sx: 0.31, sy: 0.25, px: 3.6, py: 2.4 },
  ];

  const aspect = () =>
    container.clientHeight > 0 ? container.clientWidth / container.clientHeight : 1;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(38, aspect(), 0.1, 100);
  camera.position.set(0, 0, 5.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  const orbs = chars.map((ch, i) => {
    const [bx, by, bz, sc] = layout[i];
    const sp = speeds[i];
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeBlobTexture(ch.color ?? '#2A6FDB'),
      transparent: true,
      opacity: 0.22,
      blending: THREE.NormalBlending,
      depthWrite: false,
    }));
    sprite.position.set(bx, by, bz);
    sprite.scale.set(sc, sc, 1);
    sprite.userData = { bx, by, sx: sp.sx, sy: sp.sy, px: sp.px, py: sp.py };
    group.add(sprite);
    return sprite;
  });

  const clock = new THREE.Clock();
  let animFrameId: number;

  const tick = () => {
    const t = clock.getElapsedTime();
    group.rotation.y = t * 0.004;
    orbs.forEach(b => {
      const s = b.userData;
      b.position.x = s.bx + Math.sin(t * s.sx + s.px) * 0.18;
      b.position.y = s.by + Math.sin(t * s.sy + s.py) * 0.18;
    });
    renderer.render(scene, camera);
    animFrameId = requestAnimationFrame(tick);
  };
  animFrameId = requestAnimationFrame(tick);

  const onResize = () => {
    if (!container.clientWidth || !container.clientHeight) return;
    camera.aspect = aspect();
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', onResize);

  this.destroyRef.onDestroy(() => {
    cancelAnimationFrame(animFrameId);
    orbs.forEach(b => { b.material.map?.dispose(); b.material.dispose(); });
    renderer.dispose();
    window.removeEventListener('resize', onResize);
  });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/cuaquiverso/universo/universo.component.ts
git commit -m "feat(universo): Three.js ambient orb animation in hero"
```

---

## Task 5: Visual verification

- [ ] **Step 1: Start dev server**

```bash
ng serve --open
```

- [ ] **Step 2: Check personaje page**

Navigate to `/cuaquiverso/personaje/<any-slug>`.

Expected:
- Hero shows a large soft blob at the top-right in the character's color
- Two smaller satellite blobs floating nearby
- Orbs breathe/float gently (no click, no hover change)
- Text (name, slogan, breadcrumbs) is fully readable above the animation
- No layout shift, no z-index conflict with the number element

- [ ] **Step 3: Check universo page**

Navigate to `/cuaquiverso/universo`.

Expected:
- Hero shows 4 soft blobs scattered in the background in different character colors
- Existing radial-gradient `::before` pseudo-element still visible underneath
- Text and character index fully readable above the animation

- [ ] **Step 4: Check cleanup**

Navigate away from each page and back. No memory leaks or duplicate canvases.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(cuaquiverso): Three.js ambient hero orbs — personaje + universo"
```
