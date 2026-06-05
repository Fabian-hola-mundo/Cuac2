# Cuaquiverso Help Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three centered info modals (Envíos, Devoluciones, Guía de tallas) triggered from the Cuaquiverso footer Ayuda links.

**Architecture:** A `HelpModalService` holds the active modal type as an Angular signal. A single `HelpModalComponent` renders the correct content via `@switch`. The component mounts in `cuaquiverso.component.html` alongside the existing cart modal. Footer buttons inject the service directly.

**Tech Stack:** Angular 18 standalone components, signals, CSS custom properties from `_tokens.scss`.

---

## File Map

| Action   | Path                                                                                   | Responsibility                        |
|----------|----------------------------------------------------------------------------------------|---------------------------------------|
| Create   | `src/app/pages/cuaquiverso/help-modal/help-modal.service.ts`                          | `activeModal` signal, open/close      |
| Create   | `src/app/pages/cuaquiverso/help-modal/help-modal.component.ts`                        | Modal shell + content switch          |
| Create   | `src/app/pages/cuaquiverso/help-modal/help-modal.component.html`                      | Template                              |
| Create   | `src/app/pages/cuaquiverso/help-modal/help-modal.component.scss`                      | Overlay + card + table styles         |
| Modify   | `src/app/pages/cuaquiverso/cuaquiverso.component.ts`                                  | Import HelpModalComponent             |
| Modify   | `src/app/pages/cuaquiverso/cuaquiverso.component.html`                                | Mount `<app-help-modal>`              |
| Modify   | `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.ts`                    | Inject HelpModalService               |
| Modify   | `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.html`                  | Replace 3 `<a href="#">` with buttons |
| Modify   | `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.scss`                  | `.btn-link` reset style               |

---

## Task 1: HelpModalService

**Files:**
- Create: `src/app/pages/cuaquiverso/help-modal/help-modal.service.ts`

- [ ] **Step 1.1 — Create the service**

```typescript
// src/app/pages/cuaquiverso/help-modal/help-modal.service.ts
import { Injectable, signal } from '@angular/core';

export type HelpModalType = 'envios' | 'devoluciones' | 'tallas';

@Injectable({ providedIn: 'root' })
export class HelpModalService {
  readonly activeModal = signal<HelpModalType | null>(null);

  open(type: HelpModalType): void {
    this.activeModal.set(type);
  }

  close(): void {
    this.activeModal.set(null);
  }
}
```

- [ ] **Step 1.2 — Commit**

```bash
git add src/app/pages/cuaquiverso/help-modal/help-modal.service.ts
git commit -m "feat(cuaquiverso): HelpModalService con signal activeModal"
```

---

## Task 2: HelpModalComponent — TypeScript

**Files:**
- Create: `src/app/pages/cuaquiverso/help-modal/help-modal.component.ts`

- [ ] **Step 2.1 — Create the component class**

```typescript
// src/app/pages/cuaquiverso/help-modal/help-modal.component.ts
import { Component, inject, HostListener } from '@angular/core';
import { HelpModalService } from './help-modal.service';

@Component({
  selector: 'app-help-modal',
  standalone: true,
  imports: [],
  templateUrl: './help-modal.component.html',
  styleUrl: './help-modal.component.scss',
})
export class HelpModalComponent {
  readonly service = inject(HelpModalService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.service.close();
  }
}
```

- [ ] **Step 2.2 — Commit**

```bash
git add src/app/pages/cuaquiverso/help-modal/help-modal.component.ts
git commit -m "feat(cuaquiverso): HelpModalComponent skeleton"
```

---

## Task 3: HelpModalComponent — Template

**Files:**
- Create: `src/app/pages/cuaquiverso/help-modal/help-modal.component.html`

- [ ] **Step 3.1 — Create the template**

```html
<!-- src/app/pages/cuaquiverso/help-modal/help-modal.component.html -->
@if (service.activeModal() !== null) {
  <div class="hm-overlay" (click)="service.close()" role="dialog" aria-modal="true"
       [attr.aria-label]="service.activeModal()">
    <div class="hm-card" (click)="$event.stopPropagation()">

      <!-- Header -->
      <div class="hm-head">
        <div class="hm-head-text">
          @switch (service.activeModal()) {
            @case ('envios') {
              <span class="hm-eyebrow">Ayuda</span>
              <h2>Envíos</h2>
            }
            @case ('devoluciones') {
              <span class="hm-eyebrow">Ayuda</span>
              <h2>Cambios y devoluciones</h2>
            }
            @case ('tallas') {
              <span class="hm-eyebrow">Camisetas</span>
              <h2>Guía de tallas</h2>
            }
          }
        </div>
        <button class="hm-close" (click)="service.close()" aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="hm-body">
        @switch (service.activeModal()) {

          @case ('envios') {
            <div class="hm-section">
              <p class="hm-label">Cobertura</p>
              <p>Todo Colombia vía Coordinadora y Servientrega.</p>
            </div>
            <div class="hm-section">
              <p class="hm-label">Tiempos estimados</p>
              <ul>
                <li>Bogotá: <strong>1–2 días hábiles</strong></li>
                <li>Resto del país: <strong>3–5 días hábiles</strong></li>
              </ul>
            </div>
            <div class="hm-section">
              <p class="hm-label">Costo</p>
              <p>Desde <strong>$8.000 COP</strong>, calculado al hacer checkout según el destino.</p>
            </div>
            <div class="hm-section">
              <p class="hm-label">Despacho</p>
              <p>Tirajes cortos — despachamos dentro de los <strong>5 días hábiles</strong>
                 siguientes a la confirmación del pago.</p>
            </div>
          }

          @case ('devoluciones') {
            <div class="hm-section">
              <p class="hm-label">Plazo</p>
              <p><strong>10 días calendario</strong> desde que recibes el pedido.</p>
            </div>
            <div class="hm-section">
              <p class="hm-label">Condiciones</p>
              <ul>
                <li>Producto sin uso y con empaque original.</li>
                <li>No aplica para productos personalizados ni ediciones especiales.</li>
              </ul>
            </div>
            <div class="hm-section">
              <p class="hm-label">Proceso</p>
              <p>Escríbenos a <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a>
                 con foto del producto y número de pedido.</p>
            </div>
            <div class="hm-section">
              <p class="hm-label">Cambio de talla</p>
              <p>Sujeto a disponibilidad de stock en el momento del cambio.</p>
            </div>
          }

          @case ('tallas') {
            <p class="hm-note">Medidas del producto plano en centímetros.</p>
            <table class="hm-table">
              <thead>
                <tr>
                  <th>Talla</th>
                  <th>Pecho</th>
                  <th>Largo</th>
                  <th>Hombro</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>S</td><td>48 cm</td><td>68 cm</td><td>42 cm</td></tr>
                <tr><td>M</td><td>51 cm</td><td>70 cm</td><td>44 cm</td></tr>
                <tr><td>L</td><td>54 cm</td><td>72 cm</td><td>46 cm</td></tr>
                <tr><td>XL</td><td>57 cm</td><td>74 cm</td><td>48 cm</td></tr>
              </tbody>
            </table>
            <p class="hm-note hm-note--tip">
              ¿Dudas entre dos tallas? Te recomendamos ir una talla arriba para un fit más holgado.
            </p>
          }

        }
      </div>

      <!-- Footer (no aplica en guía de tallas) -->
      @if (service.activeModal() !== 'tallas') {
        <div class="hm-footer">
          <a href="mailto:hola@cuacdesign.com">¿Más preguntas? hola&#64;cuacdesign.com</a>
        </div>
      }

    </div>
  </div>
}
```

- [ ] **Step 3.2 — Commit**

```bash
git add src/app/pages/cuaquiverso/help-modal/help-modal.component.html
git commit -m "feat(cuaquiverso): HelpModal template con contenido de envíos, devoluciones y tallas"
```

---

## Task 4: HelpModalComponent — Styles

**Files:**
- Create: `src/app/pages/cuaquiverso/help-modal/help-modal.component.scss`

- [ ] **Step 4.1 — Create the styles**

```scss
// src/app/pages/cuaquiverso/help-modal/help-modal.component.scss

@keyframes hm-overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes hm-card-in {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

// ─── Overlay ────────────────────────────────────────────────────────────────
.hm-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(21, 31, 40, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--s-5);
  animation: hm-overlay-in 0.22s ease-out both;
}

// ─── Card ────────────────────────────────────────────────────────────────────
.hm-card {
  background: #151F28;
  border-radius: var(--r-lg);
  border: 1px solid rgba(236, 239, 243, 0.08);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: hm-card-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

// ─── Header ─────────────────────────────────────────────────────────────────
.hm-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s-4);
  padding: 20px 24px;
  border-bottom: 1px solid rgba(236, 239, 243, 0.08);
  flex-shrink: 0;
}

.hm-head-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hm-eyebrow {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #E8623D;
}

.hm-head h2 {
  font-size: 17px;
  font-weight: 600;
  color: #ECEFF3;
  letter-spacing: -0.01em;
  margin: 0;
}

.hm-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  background: rgba(236, 239, 243, 0.08);
  border: none;
  border-radius: 50%;
  color: #ECEFF3;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: rgba(236, 239, 243, 0.14); }
}

// ─── Body ────────────────────────────────────────────────────────────────────
.hm-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: rgba(236, 239, 243, 0.15);
    border-radius: 2px;
  }
}

.hm-section {
  margin-bottom: var(--s-5);

  &:last-child { margin-bottom: 0; }
}

.hm-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(236, 239, 243, 0.4);
  margin: 0 0 6px;
}

.hm-body p {
  font-size: 14px;
  line-height: 1.65;
  color: rgba(236, 239, 243, 0.75);
  margin: 0;
}

.hm-body ul {
  margin: 0;
  padding-left: var(--s-5);
  display: flex;
  flex-direction: column;
  gap: 6px;

  li {
    font-size: 14px;
    line-height: 1.6;
    color: rgba(236, 239, 243, 0.75);
  }
}

.hm-body strong { color: #ECEFF3; }

.hm-body a {
  color: #E8623D;
  text-decoration: underline;
  text-underline-offset: 3px;
  &:hover { color: #ECEFF3; }
}

// ─── Tabla de tallas ─────────────────────────────────────────────────────────
.hm-note {
  font-size: 12px;
  color: rgba(236, 239, 243, 0.4);
  margin: 0 0 var(--s-4);
  line-height: 1.5;

  &--tip {
    margin: var(--s-4) 0 0;
    color: rgba(236, 239, 243, 0.5);
  }
}

.hm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(236, 239, 243, 0.4);
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(236, 239, 243, 0.08);
  }

  td {
    padding: 10px 12px;
    color: rgba(236, 239, 243, 0.78);
    border-bottom: 1px solid rgba(236, 239, 243, 0.05);
  }

  tbody tr:nth-child(odd) {
    background: rgba(255, 255, 255, 0.03);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  td:first-child {
    font-weight: 700;
    color: #ECEFF3;
  }
}

// ─── Footer ──────────────────────────────────────────────────────────────────
.hm-footer {
  padding: 14px 24px;
  border-top: 1px solid rgba(236, 239, 243, 0.08);
  flex-shrink: 0;

  a {
    font-size: 12px;
    color: rgba(236, 239, 243, 0.4);
    text-decoration: none;
    transition: color 0.15s;
    &:hover { color: rgba(236, 239, 243, 0.75); }
  }
}
```

- [ ] **Step 4.2 — Commit**

```bash
git add src/app/pages/cuaquiverso/help-modal/help-modal.component.scss
git commit -m "feat(cuaquiverso): HelpModal estilos — overlay centrado, card dark, tabla de tallas"
```

---

## Task 5: Mount in cuaquiverso

**Files:**
- Modify: `src/app/pages/cuaquiverso/cuaquiverso.component.ts`
- Modify: `src/app/pages/cuaquiverso/cuaquiverso.component.html`

- [ ] **Step 5.1 — Añadir import en cuaquiverso.component.ts**

En `src/app/pages/cuaquiverso/cuaquiverso.component.ts`, añadir el import en la línea de imports de ES y en el array del decorador:

```typescript
// Añadir este import junto a los demás imports existentes:
import { HelpModalComponent } from './help-modal/help-modal.component';

// En el decorador @Component, el array imports queda:
imports: [CartModalComponent, RouterLink, CuaquiversoFooterComponent, HelpModalComponent],
```

- [ ] **Step 5.2 — Montar `<app-help-modal>` en el template**

En `src/app/pages/cuaquiverso/cuaquiverso.component.html`, añadir `<app-help-modal>` justo después de `<app-cart-modal>`:

```html
<!-- Al final del archivo, las dos últimas líneas deben quedar: -->
<app-cart-modal></app-cart-modal>
<app-help-modal></app-help-modal>
```

- [ ] **Step 5.3 — Commit**

```bash
git add src/app/pages/cuaquiverso/cuaquiverso.component.ts src/app/pages/cuaquiverso/cuaquiverso.component.html
git commit -m "feat(cuaquiverso): montar HelpModalComponent en cuaquiverso shell"
```

---

## Task 6: Wire footer

**Files:**
- Modify: `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.ts`
- Modify: `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.html`
- Modify: `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.scss`

- [ ] **Step 6.1 — Inyectar servicio en footer.component.ts**

Reemplazar el contenido de `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.ts`:

```typescript
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HelpModalService } from '../help-modal/help-modal.service';

@Component({
  selector: 'app-cuaquiverso-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cuaquiverso-footer.component.html',
  styleUrl: './cuaquiverso-footer.component.scss',
})
export class CuaquiversoFooterComponent {
  readonly year      = new Date().getFullYear();
  readonly helpModal = inject(HelpModalService);
}
```

**IMPORTANTE:** añadir `inject` al import de `@angular/core`:

```typescript
import { Component, inject } from '@angular/core';
```

- [ ] **Step 6.2 — Reemplazar los 3 links de Ayuda en el HTML**

En `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.html`, reemplazar el bloque `footer-help-col ul`:

```html
<!-- ANTES -->
<ul>
  <li><a href="#">Envíos</a></li>
  <li><a href="#">Devoluciones</a></li>
  <li><a href="#">Guía de tallas</a></li>
  <li><a href="mailto:hola@cuacdesign.com">Contacto</a></li>
</ul>
```

```html
<!-- DESPUÉS -->
<ul>
  <li><button class="btn-link" (click)="helpModal.open('envios')">Envíos</button></li>
  <li><button class="btn-link" (click)="helpModal.open('devoluciones')">Devoluciones</button></li>
  <li><button class="btn-link" (click)="helpModal.open('tallas')">Guía de tallas</button></li>
  <li><a href="mailto:hola@cuacdesign.com">Contacto</a></li>
</ul>
```

- [ ] **Step 6.3 — Actualizar `.footer-help-col` en footer.component.scss**

En `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.scss`, reemplazar el bloque `.footer-help-col` completo:

```scss
// ANTES:
.footer-help-col {
  h5 {
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(236, 239, 243, 0.35);
    margin-bottom: var(--s-4);
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  a {
    font-size: 14px;
    color: rgba(236, 239, 243, 0.62);
    transition: color .15s;
    &:hover { color: var(--cream); }
  }
}
```

```scss
// DESPUÉS:
.footer-help-col {
  h5 {
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(236, 239, 243, 0.35);
    margin-bottom: var(--s-4);
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  a, .btn-link {
    font-size: 14px;
    color: rgba(236, 239, 243, 0.62);
    transition: color .15s;
    &:hover { color: var(--cream); }
  }
  .btn-link {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }
}
```

- [ ] **Step 6.4 — Commit**

```bash
git add src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.ts src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.html src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.scss
git commit -m "feat(cuaquiverso): footer Ayuda — botones que abren HelpModal"
```

---

## Task 7: Verificación

- [ ] **Step 7.1 — Arrancar el servidor**

```bash
ng serve
```

Abrir `http://localhost:4200/cuaquiverso`.

- [ ] **Step 7.2 — Verificar los tres modales**

Scroll al footer → columna Ayuda:

1. Click **Envíos** → modal centrado con overlay oscuro, contenido de cobertura / tiempos / costo / despacho, link a email en footer del modal
2. Click en el overlay → modal cierra
3. Click **Devoluciones** → modal con contenido de plazo / condiciones / proceso / cambio de talla
4. Click ✕ → modal cierra
5. Click **Guía de tallas** → modal con tabla S/M/L/XL y notas de medidas
6. Pulsar **Escape** → modal cierra
7. Click **Contacto** → abre cliente de correo con `hola@cuacdesign.com`

- [ ] **Step 7.3 — Verificar que el cart modal sigue funcionando**

Click en el icono del carrito (topbar) → cart modal se abre normalmente.

- [ ] **Step 7.4 — Verificar mobile (DevTools 375px)**

Los tres modales deben ser legibles y la card no debe desbordar la pantalla (padding lateral de `var(--s-5)` en el overlay lo garantiza).

- [ ] **Step 7.5 — Commit final**

```bash
git add .
git commit -m "feat(cuaquiverso): modales de ayuda verificados y funcionales"
```
