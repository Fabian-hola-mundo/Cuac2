# Legal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create Términos, Privacidad and Cookies pages plus a global cookie-consent banner, linked from both the Cuac and Cuaquiverso footers.

**Architecture:** Three standalone Angular components under `src/app/pages/legal/`, a `CookieBannerComponent` in `src/app/shared/cookie-banner/`, and a `CookieConsentService` in `src/app/core/services/`. The banner mounts globally in `app.ts`. Shared legal page styles live in `src/styles/_legal.scss`.

**Tech Stack:** Angular 18 standalone components, CSS custom properties from `src/styles/_tokens.scss`, `localStorage` for consent persistence, `RouterLink` for footer wiring.

---

## File Map

| Action   | Path                                                           | Responsibility                            |
|----------|----------------------------------------------------------------|-------------------------------------------|
| Create   | `src/app/core/services/cookie-consent.service.ts`             | Read/write consent to localStorage        |
| Create   | `src/app/shared/cookie-banner/cookie-banner.component.ts`     | Banner UI + 30s auto-dismiss logic        |
| Create   | `src/app/shared/cookie-banner/cookie-banner.component.html`   | Banner template                           |
| Create   | `src/app/shared/cookie-banner/cookie-banner.component.scss`   | Banner styles                             |
| Create   | `src/styles/_legal.scss`                                       | Shared styles for the three legal pages   |
| Create   | `src/app/pages/legal/terminos.component.ts`                   | Términos y condiciones page               |
| Create   | `src/app/pages/legal/privacidad.component.ts`                 | Política de privacidad page               |
| Create   | `src/app/pages/legal/cookies.component.ts`                    | Política de cookies page                  |
| Modify   | `src/app/app.routes.ts`                                        | Register the three new routes             |
| Modify   | `src/app/app.ts`                                               | Mount `CookieBannerComponent` globally    |
| Modify   | `src/styles/styles.scss` (or global entry)                     | Import `_legal.scss`                      |
| Modify   | `src/app/layout/footer/footer.component.html`                 | Add legal links to `footer-bottom`        |
| Modify   | `src/app/layout/footer/footer.component.scss`                 | Style `.footer-legal` link group          |
| Modify   | `src/app/layout/footer/footer.component.ts`                   | Import `RouterLink`  (already imported ✓) |
| Modify   | `src/app/pages/cuaquiverso/cuaquiverso.component.html`        | Wire Cuaquiverso footer legal links       |
| Modify   | `src/app/pages/cuaquiverso/cuaquiverso.component.ts`          | Import `RouterLink` if not present        |

---

## Task 1: CookieConsentService

**Files:**
- Create: `src/app/core/services/cookie-consent.service.ts`

- [ ] **Step 1.1 — Create the service**

```typescript
// src/app/core/services/cookie-consent.service.ts
import { Injectable } from '@angular/core';

export type ConsentValue = 'accepted' | 'rejected';
const KEY = 'cookie_consent';

@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  getConsent(): ConsentValue | null {
    return (localStorage.getItem(KEY) as ConsentValue) ?? null;
  }

  setConsent(value: ConsentValue): void {
    localStorage.setItem(KEY, value);
  }

  hasConsent(): boolean {
    return localStorage.getItem(KEY) !== null;
  }
}
```

- [ ] **Step 1.2 — Commit**

```bash
git add src/app/core/services/cookie-consent.service.ts
git commit -m "feat(legal): CookieConsentService para gestionar preferencia en localStorage"
```

---

## Task 2: CookieBannerComponent

**Files:**
- Create: `src/app/shared/cookie-banner/cookie-banner.component.ts`
- Create: `src/app/shared/cookie-banner/cookie-banner.component.html`
- Create: `src/app/shared/cookie-banner/cookie-banner.component.scss`

- [ ] **Step 2.1 — Crear el componente TypeScript**

```typescript
// src/app/shared/cookie-banner/cookie-banner.component.ts
import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CookieConsentService } from '../../core/services/cookie-consent.service';

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookie-banner.component.html',
  styleUrl: './cookie-banner.component.scss',
})
export class CookieBannerComponent implements OnInit, OnDestroy {
  private consent = inject(CookieConsentService);

  visible = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (!this.consent.hasConsent()) {
      this.visible.set(true);
      this.timer = setTimeout(() => this.dismiss(), 30_000);
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  accept(): void {
    this.consent.setConsent('accepted');
    this.dismiss();
  }

  reject(): void {
    this.consent.setConsent('rejected');
    this.dismiss();
  }

  private dismiss(): void {
    this.visible.set(false);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
```

- [ ] **Step 2.2 — Crear la plantilla HTML**

```html
<!-- src/app/shared/cookie-banner/cookie-banner.component.html -->
@if (visible()) {
  <div class="cookie-banner" role="dialog" aria-live="polite" aria-label="Consentimiento de cookies">
    <div class="cookie-banner__inner">
      <p class="cookie-banner__text">
        Usamos cookies para mejorar tu experiencia.
        <a routerLink="/cookies" class="cookie-banner__link">Más información</a>
      </p>
      <div class="cookie-banner__actions">
        <button class="cookie-banner__btn cookie-banner__btn--reject" (click)="reject()">
          Rechazar
        </button>
        <button class="cookie-banner__btn cookie-banner__btn--accept" (click)="accept()">
          Aceptar
        </button>
      </div>
    </div>
  </div>
}
```

- [ ] **Step 2.3 — Crear los estilos**

```scss
// src/app/shared/cookie-banner/cookie-banner.component.scss
.cookie-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9000;
  background: var(--carbon);
  border-top: 1px solid rgba(240, 241, 246, 0.12);
  padding: var(--s-4) var(--s-7);
  animation: slide-up 0.25s ease-out;

  @media (max-width: 640px) {
    padding: var(--s-4) var(--s-5);
  }
}

@keyframes slide-up {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

.cookie-banner__inner {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-5);
  flex-wrap: wrap;
}

.cookie-banner__text {
  font-size: 13px;
  color: rgba(240, 241, 246, 0.75);
  margin: 0;
  line-height: 1.5;
}

.cookie-banner__link {
  color: var(--coral);
  text-decoration: underline;
  text-underline-offset: 3px;
  margin-left: 4px;
  &:hover { color: var(--paper); }
}

.cookie-banner__actions {
  display: flex;
  gap: var(--s-3);
  flex-shrink: 0;
}

.cookie-banner__btn {
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 500;
  padding: 7px 18px;
  border-radius: var(--r-pill);
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &--accept {
    background: var(--ember);
    color: var(--paper);
    &:hover { background: #d43010; }
  }

  &--reject {
    background: transparent;
    color: rgba(240, 241, 246, 0.55);
    border: 1px solid rgba(240, 241, 246, 0.2);
    &:hover { color: var(--paper); border-color: rgba(240, 241, 246, 0.5); }
  }
}
```

- [ ] **Step 2.4 — Montar el banner en app.ts**

Reemplazar el contenido de `src/app/app.ts`:

```typescript
// src/app/app.ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CookieBannerComponent } from './shared/cookie-banner/cookie-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CookieBannerComponent],
  template: `
    <router-outlet />
    <app-cookie-banner />
  `,
  styles: [':host { display: block; }'],
})
export class App {}
```

- [ ] **Step 2.5 — Commit**

```bash
git add src/app/shared/cookie-banner/ src/app/app.ts
git commit -m "feat(legal): CookieBannerComponent global con auto-dismiss a los 30s"
```

---

## Task 3: Estilos compartidos de páginas legales

**Files:**
- Create: `src/styles/_legal.scss`
- Modify: `src/styles/styles.scss` (añadir import)

- [ ] **Step 3.1 — Verificar el archivo de estilos globales**

Buscar el archivo `styles.scss` en `src/`:

```bash
# PowerShell
ls src/styles.scss
```

Si existe en `src/styles.scss`, ábrelo. Si no, busca en `src/styles/styles.scss`.

- [ ] **Step 3.2 — Crear `_legal.scss`**

```scss
// src/styles/_legal.scss

.legal-page {
  background: var(--paper);
  min-height: 100dvh;
}

.legal-hero {
  background: var(--mist);
  padding: var(--s-9) var(--s-7) var(--s-8);
  border-bottom: 1px solid rgba(21, 31, 40, 0.08);

  .eyebrow {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ember);
    display: block;
    margin-bottom: var(--s-4);
  }

  h1 {
    font-family: var(--display);
    font-size: clamp(2rem, 5vw, 3.25rem);
    color: var(--ink);
    font-weight: 400;
    line-height: 1.1;
    margin: 0 0 var(--s-4);
  }

  .updated {
    font-size: 13px;
    color: rgba(21, 31, 40, 0.45);
    margin: 0;
  }

  @media (max-width: 640px) {
    padding: var(--s-8) var(--s-5) var(--s-7);
  }
}

.legal-body {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--s-8) var(--s-7);

  h2 {
    font-family: var(--sans);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--ink);
    margin: var(--s-8) 0 var(--s-4);
    display: flex;
    gap: var(--s-3);
    align-items: baseline;

    .sec-num {
      font-family: var(--mono);
      font-size: 10px;
      color: var(--ember);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      flex-shrink: 0;
    }
  }

  h2:first-child {
    margin-top: 0;
  }

  p {
    font-size: 15px;
    line-height: 1.75;
    color: rgba(21, 31, 40, 0.78);
    margin: 0 0 var(--s-4);
  }

  ul, ol {
    padding-left: var(--s-6);
    margin: 0 0 var(--s-4);
    li {
      font-size: 15px;
      line-height: 1.75;
      color: rgba(21, 31, 40, 0.78);
      margin-bottom: var(--s-2);
    }
  }

  a {
    color: var(--ember);
    text-decoration: underline;
    text-underline-offset: 3px;
    &:hover { color: var(--ink); }
  }

  strong { color: var(--ink); }

  @media (max-width: 640px) {
    padding: var(--s-7) var(--s-5);
  }
}
```

- [ ] **Step 3.3 — Añadir import en `src/styles.scss`**

En `src/styles.scss`, añadir después de la línea `@use 'styles/admin';`:

```scss
@use 'styles/legal';
```

El bloque de imports debe quedar así:
```scss
@use 'styles/tokens';
@use 'styles/reset';
@use 'styles/typography';
@use 'styles/breadcrumb';
@use 'styles/admin';
@use 'styles/legal';
```

- [ ] **Step 3.4 — Commit**

```bash
git add src/styles/_legal.scss src/styles.scss
git commit -m "feat(legal): estilos compartidos para páginas legales"
```

---

## Task 4: Página Términos y condiciones

**Files:**
- Create: `src/app/pages/legal/terminos.component.ts`

- [ ] **Step 4.1 — Crear el componente**

```typescript
// src/app/pages/legal/terminos.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopbarComponent } from '../../layout/topbar/topbar.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-terminos',
  standalone: true,
  imports: [RouterLink, TopbarComponent, FooterComponent],
  template: `
    <app-topbar />
    <main class="legal-page">
      <div class="legal-hero">
        <span class="eyebrow">Legal</span>
        <h1>Términos y condiciones</h1>
        <p class="updated">Última actualización: junio de 2026</p>
      </div>
      <div class="legal-body">

        <h2><span class="sec-num">01</span> Identificación del responsable</h2>
        <p>
          El presente sitio web, <strong>cuac.design</strong>, es operado por <strong>Cuac Design</strong>,
          estudio creativo con domicilio en Bogotá D.C., Colombia. Para consultas puede escribirnos a
          <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a>.
        </p>

        <h2><span class="sec-num">02</span> Objeto y alcance</h2>
        <p>
          Estos términos regulan el uso del sitio web cuac.design y de la tienda en línea Cuaquiverso
          (cuac.design/cuaquiverso). Al navegar o realizar una compra, el usuario acepta estos términos
          en su totalidad.
        </p>

        <h2><span class="sec-num">03</span> Condiciones de uso del sitio</h2>
        <p>
          El usuario se compromete a utilizar el sitio de forma lícita y a no realizar acciones que
          puedan dañar, inutilizar o deteriorar el sitio o los servicios, ni interferir con su normal
          funcionamiento. Queda prohibida la reproducción total o parcial de los contenidos sin
          autorización expresa de Cuac Design.
        </p>

        <h2><span class="sec-num">04</span> Propiedad intelectual</h2>
        <p>
          Todos los contenidos del sitio —incluyendo textos, ilustraciones, logotipos, fotografías,
          diseños y código fuente— son propiedad de Cuac Design o están licenciados a su favor.
          Su reproducción, distribución o modificación sin autorización escrita constituye una
          infracción a los derechos de autor reconocidos en Colombia y en los tratados internacionales
          aplicables.
        </p>

        <h2><span class="sec-num">05</span> Condiciones de compra (Cuaquiverso)</h2>
        <p>
          Los productos de la tienda Cuaquiverso se producen en tirajes cortos. Los precios están
          expresados en pesos colombianos (COP) e incluyen IVA cuando aplique. Cuac Design se reserva
          el derecho de modificar precios, disponibilidad y características de los productos sin previo
          aviso. Un pedido queda confirmado únicamente cuando el pago ha sido procesado exitosamente.
        </p>
        <p>
          Para políticas de envío, cambios y devoluciones, el usuario puede escribir a
          <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a>.
        </p>

        <h2><span class="sec-num">06</span> Limitación de responsabilidad</h2>
        <p>
          Cuac Design no garantiza la disponibilidad ininterrumpida del sitio y no será responsable
          por daños directos o indirectos derivados del uso o la imposibilidad de uso del mismo.
          Los contenidos se ofrecen "tal como están", sin garantías de ningún tipo.
        </p>

        <h2><span class="sec-num">07</span> Modificaciones</h2>
        <p>
          Cuac Design puede modificar estos términos en cualquier momento. Los cambios entran en
          vigor desde su publicación. El uso continuado del sitio tras una modificación implica la
          aceptación de los nuevos términos.
        </p>

        <h2><span class="sec-num">08</span> Ley aplicable</h2>
        <p>
          Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia
          será resuelta por los jueces competentes de Bogotá D.C.
        </p>

      </div>
    </main>
    <app-footer />
  `,
})
export class TerminosComponent implements OnInit {
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.set({
      title: 'Términos y condiciones — Cuac Design',
      description: 'Lee los términos y condiciones de uso del sitio web de Cuac Design y la tienda Cuaquiverso.',
      canonical: 'https://cuacdesign.com/terminos',
    });
  }
}
```

- [ ] **Step 4.2 — Registrar la ruta en app.routes.ts**

En `src/app/app.routes.ts`, añadir antes del cierre del array `routes`:

```typescript
  {
    path: 'terminos',
    loadComponent: () =>
      import('./pages/legal/terminos.component').then(m => m.TerminosComponent),
  },
```

- [ ] **Step 4.3 — Commit**

```bash
git add src/app/pages/legal/terminos.component.ts src/app/app.routes.ts
git commit -m "feat(legal): página Términos y condiciones"
```

---

## Task 5: Página Política de privacidad

**Files:**
- Create: `src/app/pages/legal/privacidad.component.ts`

- [ ] **Step 5.1 — Crear el componente**

```typescript
// src/app/pages/legal/privacidad.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopbarComponent } from '../../layout/topbar/topbar.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-privacidad',
  standalone: true,
  imports: [RouterLink, TopbarComponent, FooterComponent],
  template: `
    <app-topbar />
    <main class="legal-page">
      <div class="legal-hero">
        <span class="eyebrow">Legal</span>
        <h1>Política de privacidad</h1>
        <p class="updated">Última actualización: junio de 2026</p>
      </div>
      <div class="legal-body">

        <h2><span class="sec-num">01</span> Responsable del tratamiento</h2>
        <p>
          <strong>Cuac Design</strong>, con domicilio en Bogotá D.C., Colombia, es responsable del
          tratamiento de los datos personales recolectados a través de cuac.design y la tienda
          Cuaquiverso, de conformidad con la <strong>Ley 1581 de 2012</strong> y el
          Decreto 1377 de 2013.
        </p>
        <p>
          Contacto del responsable: <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a>
        </p>

        <h2><span class="sec-num">02</span> Datos que recolectamos</h2>
        <p>Dependiendo de la interacción, podemos recolectar:</p>
        <ul>
          <li><strong>Formulario de cotización:</strong> nombre, correo electrónico, teléfono y descripción del proyecto.</li>
          <li><strong>Checkout Cuaquiverso:</strong> nombre, correo electrónico, dirección de envío y datos necesarios para procesar el pago.</li>
          <li><strong>Navegación:</strong> datos de uso anónimos (páginas visitadas, tiempo de sesión) a través de herramientas de análisis.</li>
        </ul>

        <h2><span class="sec-num">03</span> Finalidad del tratamiento</h2>
        <ul>
          <li>Responder solicitudes de cotización y comunicarnos sobre proyectos.</li>
          <li>Procesar y gestionar pedidos de la tienda Cuaquiverso.</li>
          <li>Mejorar la experiencia del sitio web mediante análisis de uso.</li>
          <li>Cumplir con obligaciones legales y fiscales aplicables en Colombia.</li>
        </ul>

        <h2><span class="sec-num">04</span> Base legal del tratamiento</h2>
        <p>
          El tratamiento se realiza con base en el consentimiento del titular (al enviar un formulario
          o realizar una compra), en la ejecución de una relación contractual o en el cumplimiento
          de obligaciones legales.
        </p>

        <h2><span class="sec-num">05</span> Derechos del titular</h2>
        <p>
          De acuerdo con la Ley 1581 de 2012, el titular de los datos tiene derecho a:
        </p>
        <ul>
          <li>Conocer, actualizar y rectificar sus datos personales.</li>
          <li>Solicitar prueba de la autorización otorgada.</li>
          <li>Ser informado sobre el uso de sus datos.</li>
          <li>Revocar la autorización y solicitar la supresión de sus datos cuando no exista obligación legal de conservarlos.</li>
          <li>Acceder gratuitamente a sus datos personales.</li>
        </ul>
        <p>
          Para ejercer estos derechos, escríbenos a
          <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a> con el asunto
          "Derechos HABEAS DATA".
        </p>

        <h2><span class="sec-num">06</span> Transferencia a terceros</h2>
        <p>
          Cuac Design no vende ni cede datos personales a terceros con fines comerciales. Podremos
          compartir datos estrictamente necesarios con proveedores de servicios de pago y logística
          que intervienen en el procesamiento de pedidos, quienes están obligados a tratarlos bajo
          estándares de confidencialidad equivalentes.
        </p>

        <h2><span class="sec-num">07</span> Tiempo de conservación</h2>
        <p>
          Los datos de pedidos se conservan durante 5 años en cumplimiento de obligaciones tributarias
          colombianas. Los datos de cotizaciones se conservan por 2 años desde el último contacto.
          Los datos de navegación anónimos no tienen límite de tiempo.
        </p>

        <h2><span class="sec-num">08</span> Seguridad</h2>
        <p>
          Implementamos medidas técnicas y organizativas razonables para proteger tus datos contra
          acceso no autorizado, pérdida o alteración. Las transacciones de pago se procesan a través
          de pasarelas seguras certificadas.
        </p>

        <h2><span class="sec-num">09</span> Cambios a esta política</h2>
        <p>
          Esta política puede actualizarse. La versión vigente siempre estará disponible en
          <a routerLink="/privacidad">cuac.design/privacidad</a>. Cambios relevantes serán comunicados
          por correo a quienes hayan realizado compras.
        </p>

      </div>
    </main>
    <app-footer />
  `,
})
export class PrivacidadComponent implements OnInit {
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.set({
      title: 'Política de privacidad — Cuac Design',
      description: 'Cómo Cuac Design recolecta, usa y protege tus datos personales, de acuerdo con la Ley 1581 de 2012.',
      canonical: 'https://cuacdesign.com/privacidad',
    });
  }
}
```

- [ ] **Step 5.2 — Registrar la ruta en app.routes.ts**

En `src/app/app.routes.ts`, añadir después de la ruta de `terminos`:

```typescript
  {
    path: 'privacidad',
    loadComponent: () =>
      import('./pages/legal/privacidad.component').then(m => m.PrivacidadComponent),
  },
```

- [ ] **Step 5.3 — Commit**

```bash
git add src/app/pages/legal/privacidad.component.ts src/app/app.routes.ts
git commit -m "feat(legal): página Política de privacidad"
```

---

## Task 6: Página Política de cookies

**Files:**
- Create: `src/app/pages/legal/cookies.component.ts`

- [ ] **Step 6.1 — Crear el componente**

```typescript
// src/app/pages/legal/cookies.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopbarComponent } from '../../layout/topbar/topbar.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-cookies',
  standalone: true,
  imports: [RouterLink, TopbarComponent, FooterComponent],
  template: `
    <app-topbar />
    <main class="legal-page">
      <div class="legal-hero">
        <span class="eyebrow">Legal</span>
        <h1>Política de cookies</h1>
        <p class="updated">Última actualización: junio de 2026</p>
      </div>
      <div class="legal-body">

        <h2><span class="sec-num">01</span> ¿Qué son las cookies?</h2>
        <p>
          Las cookies son pequeños archivos de texto que un sitio web almacena en tu navegador o
          dispositivo cuando lo visitas. Permiten que el sitio recuerde tus acciones y preferencias
          durante un período de tiempo para que no tengas que volver a introducirlas cada vez que
          regresas al sitio o navegas entre páginas.
        </p>

        <h2><span class="sec-num">02</span> Cookies que usamos</h2>

        <p><strong>Funcionales</strong></p>
        <ul>
          <li>
            <strong>Carrito de compras (Cuaquiverso):</strong> guardamos los productos añadidos al
            carrito en <code>localStorage</code> para que no se pierdan al navegar entre páginas.
            Esta información permanece en tu dispositivo y no se envía a nuestros servidores.
          </li>
        </ul>

        <p><strong>De preferencia</strong></p>
        <ul>
          <li>
            <strong>cookie_consent:</strong> almacenamos tu decisión sobre el uso de cookies
            (aceptado / rechazado) en <code>localStorage</code> para no mostrarte el aviso
            nuevamente.
          </li>
        </ul>

        <p><strong>Analíticas</strong></p>
        <ul>
          <li>
            Si usamos herramientas de análisis de tráfico web (como Google Analytics), estas pueden
            establecer cookies para medir el comportamiento de navegación de forma anónima y
            agregada. Nunca se recolectan datos que permitan identificarte directamente.
          </li>
        </ul>

        <h2><span class="sec-num">03</span> Cookies de terceros</h2>
        <p>
          Las pasarelas de pago que usamos en Cuaquiverso pueden establecer sus propias cookies
          durante el proceso de checkout. Estas cookies están sujetas a las políticas de privacidad
          de los respectivos proveedores.
        </p>

        <h2><span class="sec-num">04</span> Cómo gestionar las cookies</h2>
        <p>
          Puedes configurar tu navegador para bloquear o eliminar cookies. Aquí tienes instrucciones
          para los navegadores más comunes:
        </p>
        <ul>
          <li><strong>Chrome:</strong> Ajustes → Privacidad y seguridad → Cookies y otros datos de sitios.</li>
          <li><strong>Firefox:</strong> Ajustes → Privacidad y seguridad → Cookies y datos del sitio.</li>
          <li><strong>Safari:</strong> Preferencias → Privacidad → Gestionar datos del sitio web.</li>
          <li><strong>Edge:</strong> Configuración → Cookies y permisos del sitio → Cookies y datos guardados.</li>
        </ul>
        <p>
          Ten en cuenta que bloquear ciertas cookies puede afectar el funcionamiento de la tienda
          Cuaquiverso (por ejemplo, el carrito de compras).
        </p>

        <h2><span class="sec-num">05</span> Más información</h2>
        <p>
          Para más detalles sobre cómo tratamos tus datos personales, consulta nuestra
          <a routerLink="/privacidad">Política de privacidad</a>. Si tienes preguntas, escríbenos a
          <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a>.
        </p>

      </div>
    </main>
    <app-footer />
  `,
})
export class CookiesComponent implements OnInit {
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.set({
      title: 'Política de cookies — Cuac Design',
      description: 'Qué cookies usa Cuac Design y cómo puedes gestionarlas en tu navegador.',
      canonical: 'https://cuacdesign.com/cookies',
    });
  }
}
```

- [ ] **Step 6.2 — Registrar la ruta en app.routes.ts**

En `src/app/app.routes.ts`, añadir después de la ruta de `privacidad`:

```typescript
  {
    path: 'cookies',
    loadComponent: () =>
      import('./pages/legal/cookies.component').then(m => m.CookiesComponent),
  },
```

- [ ] **Step 6.3 — Commit**

```bash
git add src/app/pages/legal/cookies.component.ts src/app/app.routes.ts
git commit -m "feat(legal): página Política de cookies"
```

---

## Task 7: Footer Cuac — añadir links legales

**Files:**
- Modify: `src/app/layout/footer/footer.component.html`
- Modify: `src/app/layout/footer/footer.component.scss`

- [ ] **Step 7.1 — Actualizar el HTML del footer**

Reemplazar el bloque `footer-bottom` existente:

```html
<!-- ANTES -->
<div class="footer-bottom">
  <span>&#169; {{ year }} Cuac Design &mdash; Bogotá, Colombia</span>
  <span>Hecho a mano, pensado en sistema</span>
</div>
```

```html
<!-- DESPUÉS -->
<div class="footer-bottom">
  <span>&#169; {{ year }} Cuac Design &mdash; Bogotá, Colombia</span>
  <div class="footer-legal">
    <a routerLink="/terminos">Términos</a>
    <a routerLink="/privacidad">Privacidad</a>
    <a routerLink="/cookies">Cookies</a>
  </div>
  <span>Hecho a mano, pensado en sistema</span>
</div>
```

- [ ] **Step 7.2 — Añadir estilos para `.footer-legal`**

En `src/app/layout/footer/footer.component.scss`, añadir al final del archivo:

```scss
.footer-legal {
  display: flex;
  gap: var(--s-4);

  a {
    font-family: var(--mono);
    font-size: 11px;
    color: rgba(240, 241, 246, 0.4);
    transition: color 0.15s;
    &:hover { color: rgba(240, 241, 246, 0.75); }
  }
}

@media (max-width: 640px) {
  .footer-bottom {
    flex-direction: column;
    gap: var(--s-3);
    text-align: center;
  }

  .footer-legal {
    order: -1;
  }
}
```

- [ ] **Step 7.3 — Commit**

```bash
git add src/app/layout/footer/footer.component.html src/app/layout/footer/footer.component.scss
git commit -m "feat(legal): links legales en footer Cuac"
```

---

## Task 8: Footer Cuaquiverso — conectar links existentes

El footer de Cuaquiverso vive en su propio componente separado, **no** en `cuaquiverso.component`.

**Files:**
- Modify: `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.html`
- Modify: `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.ts`

- [ ] **Step 8.1 — Añadir RouterLink al componente**

Reemplazar el contenido de `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.ts`:

```typescript
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cuaquiverso-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cuaquiverso-footer.component.html',
  styleUrl: './cuaquiverso-footer.component.scss',
})
export class CuaquiversoFooterComponent {
  readonly year = new Date().getFullYear();
}
```

- [ ] **Step 8.2 — Actualizar los links en el HTML del footer**

En `src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.html`, reemplazar el bloque `.legals`:

```html
<!-- ANTES -->
<div class="legals">
  <a href="#">Términos</a>
  <a href="#">Privacidad</a>
  <a href="#">Cookies</a>
</div>
```

```html
<!-- DESPUÉS -->
<div class="legals">
  <a routerLink="/terminos">Términos</a>
  <a routerLink="/privacidad">Privacidad</a>
  <a routerLink="/cookies">Cookies</a>
</div>
```

- [ ] **Step 8.3 — Commit**

```bash
git add src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.html src/app/pages/cuaquiverso/footer/cuaquiverso-footer.component.ts
git commit -m "feat(legal): links legales en footer Cuaquiverso"
```

---

## Task 9: Verificación final en navegador

- [ ] **Step 9.1 — Arrancar el servidor de desarrollo**

```bash
ng serve
```

Abrir `http://localhost:4200`.

- [ ] **Step 9.2 — Verificar rutas legales**

Navegar a:
- `http://localhost:4200/terminos` → debe mostrar topbar Cuac + contenido términos + footer Cuac
- `http://localhost:4200/privacidad` → debe mostrar topbar Cuac + contenido privacidad + footer Cuac
- `http://localhost:4200/cookies` → debe mostrar topbar Cuac + contenido cookies + footer Cuac

- [ ] **Step 9.3 — Verificar cookie banner**

1. Abrir DevTools → Application → Local Storage → borrar `cookie_consent`
2. Recargar `http://localhost:4200`
3. El banner debe aparecer en la parte inferior
4. Esperar 30 segundos → el banner debe desaparecer solo
5. Recargar → el banner SÍ debe aparecer de nuevo (el auto-dismiss no guarda preferencia)
6. Hacer clic en "Aceptar" → banner desaparece, `cookie_consent = 'accepted'` en localStorage
7. Recargar → banner no aparece

- [ ] **Step 9.4 — Verificar links en footers**

1. En `http://localhost:4200` → scroll al footer → los tres links deben aparecer y navegar correctamente
2. En `http://localhost:4200/cuaquiverso` → scroll al footer → links Términos / Privacidad / Cookies deben navegar correctamente

- [ ] **Step 9.5 — Verificar mobile (DevTools)**

Activar vista mobile (375px). Comprobar que:
- Las páginas legales son legibles y el texto no se corta
- El footer de Cuac reorganiza los links legales en columna
- El cookie banner no ocupa toda la pantalla y los botones son tocables

- [ ] **Step 9.6 — Commit final**

```bash
git add .
git commit -m "feat(legal): verificación completa — páginas legales + cookie banner funcional"
```
