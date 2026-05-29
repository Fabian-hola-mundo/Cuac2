# Admin Ajustes Sub-páginas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la vista estática "Ajustes" del admin en 7 sub-rutas Angular reales (`/admin/ajustes/*`), cada una con un componente propio, formularios funcionales con signals y guardado mock.

**Architecture:** Un `AjustesShellComponent` con nav lateral de 7 ítems (`routerLink` + `routerLinkActive`) y un `<router-outlet>` propio. Cada sub-página es un componente standalone independiente. El router anida los hijos bajo `path: 'ajustes'` dentro del bloque `admin` de `app.routes.ts`. El `@case('ajustes')` en `admin-home` se elimina; el sidebar de admin navega a `/admin/ajustes`.

**Tech Stack:** Angular 17+ (standalone components, signals, `@switch`/`@for`/`@if`, `FormsModule`, `RouterLink`, `RouterOutlet`, `RouterLinkActive`, `CommonModule`)

---

## Mapa de archivos

### Archivos nuevos
| Archivo | Responsabilidad |
|---------|----------------|
| `src/app/pages/admin/ajustes/ajustes-shell.component.ts` | Nav lateral + router-outlet de hijos |
| `src/app/pages/admin/ajustes/ajustes-shell.component.html` | Template del shell |
| `src/app/pages/admin/ajustes/ajustes-shell.component.scss` | Estilos del nav lateral |
| `src/app/pages/admin/ajustes/negocio/ajustes-negocio.component.ts` | Datos del negocio |
| `src/app/pages/admin/ajustes/negocio/ajustes-negocio.component.html` | — |
| `src/app/pages/admin/ajustes/negocio/ajustes-negocio.component.scss` | — |
| `src/app/pages/admin/ajustes/impuestos/ajustes-impuestos.component.ts` | IVA, tasas, facturación electrónica |
| `src/app/pages/admin/ajustes/impuestos/ajustes-impuestos.component.html` | — |
| `src/app/pages/admin/ajustes/impuestos/ajustes-impuestos.component.scss` | — |
| `src/app/pages/admin/ajustes/envios/ajustes-envios.component.ts` | Zonas, transportadoras, envío gratis |
| `src/app/pages/admin/ajustes/envios/ajustes-envios.component.html` | — |
| `src/app/pages/admin/ajustes/envios/ajustes-envios.component.scss` | — |
| `src/app/pages/admin/ajustes/correos/ajustes-correos.component.ts` | Plantillas de correo |
| `src/app/pages/admin/ajustes/correos/ajustes-correos.component.html` | — |
| `src/app/pages/admin/ajustes/correos/ajustes-correos.component.scss` | — |
| `src/app/pages/admin/ajustes/equipo/ajustes-equipo.component.ts` | Miembros, roles, invitación, log |
| `src/app/pages/admin/ajustes/equipo/ajustes-equipo.component.html` | — |
| `src/app/pages/admin/ajustes/equipo/ajustes-equipo.component.scss` | — |
| `src/app/pages/admin/ajustes/integraciones/ajustes-integraciones.component.ts` | Pasarelas, analytics, email marketing |
| `src/app/pages/admin/ajustes/integraciones/ajustes-integraciones.component.html` | — |
| `src/app/pages/admin/ajustes/integraciones/ajustes-integraciones.component.scss` | — |
| `src/app/pages/admin/ajustes/dominios/ajustes-dominios.component.ts` | Dominios, SSL, redirects |
| `src/app/pages/admin/ajustes/dominios/ajustes-dominios.component.html` | — |
| `src/app/pages/admin/ajustes/dominios/ajustes-dominios.component.scss` | — |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `src/app/app.routes.ts` | Agregar children `ajustes/*` bajo `admin` |
| `src/app/pages/admin/admin-shell.component.ts` | `isAjustesRoute`, `goAjustes()`, breadcrumbs |
| `src/app/pages/admin/admin-shell.component.html` | Nav item "Ajustes" → `goAjustes()`, `isAjustesRoute()` |
| `src/app/pages/admin/admin-home.component.html` | Eliminar `@case('ajustes')` |

---

## Task 1: Shell de Ajustes + rutas

**Files:**
- Create: `src/app/pages/admin/ajustes/ajustes-shell.component.ts`
- Create: `src/app/pages/admin/ajustes/ajustes-shell.component.html`
- Create: `src/app/pages/admin/ajustes/ajustes-shell.component.scss`
- Modify: `src/app/app.routes.ts`

- [ ] **Crear `ajustes-shell.component.ts`**

```typescript
import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem { label: string; path: string; icon: string; }

@Component({
  selector: 'app-ajustes-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './ajustes-shell.component.html',
  styleUrl: './ajustes-shell.component.scss',
})
export class AjustesShellComponent {
  readonly NAV: NavItem[] = [
    { label: 'Negocio',              path: 'negocio',       icon: 'building'    },
    { label: 'Impuestos',            path: 'impuestos',     icon: 'receipt'     },
    { label: 'Envíos y tarifas',     path: 'envios',        icon: 'truck'       },
    { label: 'Plantillas de correo', path: 'correos',       icon: 'mail'        },
    { label: 'Equipo y permisos',    path: 'equipo',        icon: 'users'       },
    { label: 'Integraciones',        path: 'integraciones', icon: 'plug'        },
    { label: 'Dominios',             path: 'dominios',      icon: 'globe'       },
  ];
}
```

- [ ] **Crear `ajustes-shell.component.html`**

```html
<div class="ajustes-layout">
  <nav class="ajustes-nav panel">
    <div class="panel-b" style="padding:8px;display:flex;flex-direction:column;gap:2px">
      @for (item of NAV; track item.path) {
      <a class="aj-link"
         [routerLink]="item.path"
         routerLinkActive="is-active">
        @if (item.icon === 'building') {
          <svg class="aj-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        }
        @if (item.icon === 'receipt') {
          <svg class="aj-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M8 10h8M8 14h4"/></svg>
        }
        @if (item.icon === 'truck') {
          <svg class="aj-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 4v4h-7V8Z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        }
        @if (item.icon === 'mail') {
          <svg class="aj-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>
        }
        @if (item.icon === 'users') {
          <svg class="aj-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M21 20c0-2.5-1.9-4.6-4.4-4.95"/></svg>
        }
        @if (item.icon === 'plug') {
          <svg class="aj-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5M9 7V2M15 7V2M8 7h8l-1 10H9L8 7Z"/></svg>
        }
        @if (item.icon === 'globe') {
          <svg class="aj-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
        }
        <span>{{ item.label }}</span>
      </a>
      }
    </div>
  </nav>
  <div class="ajustes-content">
    <router-outlet />
  </div>
</div>
```

- [ ] **Crear `ajustes-shell.component.scss`**

```scss
:host { display: block; }

.ajustes-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: var(--s-5);
  align-items: flex-start;
}

.ajustes-nav {
  position: sticky;
  top: 0;
}

.ajustes-content {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
}

.aj-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--carbon-70);
  text-decoration: none;
  cursor: pointer;
  background: transparent;
  transition: background 120ms, color 120ms;

  &:hover { background: var(--cream-2); color: var(--carbon); }

  &.is-active {
    background: var(--cream-2);
    color: var(--carbon);
    font-weight: 600;
  }
}

.aj-ic {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: inherit;
}
```

- [ ] **Agregar rutas de ajustes en `app.routes.ts`**

Insertar dentro del array `children` del bloque `admin`, después de la ruta `eventos/:id`:

```typescript
// Ajustes
{
  path: 'ajustes',
  loadComponent: () =>
    import('./pages/admin/ajustes/ajustes-shell.component').then(m => m.AjustesShellComponent),
  children: [
    { path: '', redirectTo: 'negocio', pathMatch: 'full' },
    {
      path: 'negocio',
      loadComponent: () =>
        import('./pages/admin/ajustes/negocio/ajustes-negocio.component').then(m => m.AjustesNegocioComponent),
    },
    {
      path: 'impuestos',
      loadComponent: () =>
        import('./pages/admin/ajustes/impuestos/ajustes-impuestos.component').then(m => m.AjustesImpuestosComponent),
    },
    {
      path: 'envios',
      loadComponent: () =>
        import('./pages/admin/ajustes/envios/ajustes-envios.component').then(m => m.AjustesEnviosComponent),
    },
    {
      path: 'correos',
      loadComponent: () =>
        import('./pages/admin/ajustes/correos/ajustes-correos.component').then(m => m.AjustesCorreosComponent),
    },
    {
      path: 'equipo',
      loadComponent: () =>
        import('./pages/admin/ajustes/equipo/ajustes-equipo.component').then(m => m.AjustesEquipoComponent),
    },
    {
      path: 'integraciones',
      loadComponent: () =>
        import('./pages/admin/ajustes/integraciones/ajustes-integraciones.component').then(m => m.AjustesIntegracionesComponent),
    },
    {
      path: 'dominios',
      loadComponent: () =>
        import('./pages/admin/ajustes/dominios/ajustes-dominios.component').then(m => m.AjustesDominiosComponent),
    },
  ],
},
```

- [ ] **Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | tail -20
```
Esperado: `Build at:` sin errores (los componentes hijos aún no existen — Angular lazy-load los valida en runtime, no en build-time, así que debería compilar si el shell existe).

- [ ] **Commit**

```bash
git add src/app/pages/admin/ajustes/ajustes-shell.component.ts src/app/pages/admin/ajustes/ajustes-shell.component.html src/app/pages/admin/ajustes/ajustes-shell.component.scss src/app/app.routes.ts
git commit -m "feat(admin): ajustes shell component + child routes scaffold"
```

---

## Task 2: Wiring en admin-shell + eliminar case legacy

**Files:**
- Modify: `src/app/pages/admin/admin-shell.component.ts`
- Modify: `src/app/pages/admin/admin-shell.component.html`
- Modify: `src/app/pages/admin/admin-home.component.html`

- [ ] **Agregar `isAjustesRoute` y `goAjustes()` en `admin-shell.component.ts`**

Después de la línea `isEventosRoute = computed(...)`, agregar:

```typescript
isAjustesRoute = computed(() => this.routerUrl().includes('/admin/ajustes'));
```

Agregar el método al final de los métodos de navegación:

```typescript
goAjustes() { this.router.navigate(['/admin/ajustes']); }
```

Actualizar el computed `crumbs` — agregar estos casos antes del `const map`:

```typescript
if (url.includes('/ajustes/negocio'))       return ['Sistema', 'Ajustes', 'Negocio'];
if (url.includes('/ajustes/impuestos'))     return ['Sistema', 'Ajustes', 'Impuestos'];
if (url.includes('/ajustes/envios'))        return ['Sistema', 'Ajustes', 'Envíos y tarifas'];
if (url.includes('/ajustes/correos'))       return ['Sistema', 'Ajustes', 'Plantillas de correo'];
if (url.includes('/ajustes/equipo'))        return ['Sistema', 'Ajustes', 'Equipo y permisos'];
if (url.includes('/ajustes/integraciones')) return ['Sistema', 'Ajustes', 'Integraciones'];
if (url.includes('/ajustes/dominios'))      return ['Sistema', 'Ajustes', 'Dominios'];
if (url.includes('/ajustes'))              return ['Sistema', 'Ajustes'];
```

Actualizar el `goHome` para que `'ajustes'` navegue a la ruta en lugar de solo cambiar el signal:

```typescript
goHome(id: ViewId) {
  if (id === 'productos') {
    this.router.navigate(['/admin/productos']);
    return;
  }
  if (id === 'ajustes') {
    this.router.navigate(['/admin/ajustes']);
    return;
  }
  this.state.view.set(id);
  if (this.isPortafolioRoute() || this.isCotizacionesRoute() || this.isProductosRoute() || this.isEventosRoute() || this.isAjustesRoute()) {
    this.router.navigate(['/admin']);
  }
}
```

- [ ] **Actualizar estado activo del nav en `admin-shell.component.html`**

En el `@for (id of NAV_UNIVERSO; track id)` el `[class.is-active]` actual es:

```html
[class.is-active]="state.view() === id && !isPortafolioRoute() && !isCotizacionesRoute() && !isProductosRoute() && !isEventosRoute()"
```

Reemplazar con:

```html
[class.is-active]="(state.view() === id && !isPortafolioRoute() && !isCotizacionesRoute() && !isProductosRoute() && !isEventosRoute() && !isAjustesRoute()) || (id === 'ajustes' && isAjustesRoute())"
```

- [ ] **Eliminar `@case('ajustes')` de `admin-home.component.html`**

Eliminar el bloque completo desde `<!-- ══ SETTINGS ═══════════════════════════════════════════════════ -->` hasta (e incluyendo) el `}` de cierre de ese case (líneas 431–485 aproximadamente).

- [ ] **Verificar en navegador** que `/admin` carga sin errores y el link "Ajustes" del sidebar navega a `/admin/ajustes/negocio` (mostrará el shell vacío ya que los hijos aún no existen, pero no debe dar error de ruta).

- [ ] **Commit**

```bash
git add src/app/pages/admin/admin-shell.component.ts src/app/pages/admin/admin-shell.component.html src/app/pages/admin/admin-home.component.html
git commit -m "feat(admin): wire ajustes route in shell, remove legacy @case"
```

---

## Task 3: Negocio

**Files:**
- Create: `src/app/pages/admin/ajustes/negocio/ajustes-negocio.component.ts`
- Create: `src/app/pages/admin/ajustes/negocio/ajustes-negocio.component.html`
- Create: `src/app/pages/admin/ajustes/negocio/ajustes-negocio.component.scss`

- [ ] **Crear `ajustes-negocio.component.ts`**

```typescript
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ajustes-negocio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-negocio.component.html',
  styleUrl: './ajustes-negocio.component.scss',
})
export class AjustesNegocioComponent {
  razonSocial   = signal('Cuaquiverso S.A.S.');
  nit           = signal('901.234.567-8');
  email         = signal('hola@cuaquiverso.co');
  telefono      = signal('+57 311 444 0001');
  direccion     = signal('Cra 11 # 71-30, Bogotá, Colombia');
  regimen       = signal('simple');
  moneda        = signal('COP');
  zona          = signal('America/Bogota');
  idioma        = signal('es');
  nombreTienda  = signal('Cuaquiverso');
  colorPrimario = signal('#2A6FDB');

  saving = signal(false);
  saved  = signal(false);

  async guardar() {
    this.saving.set(true);
    await new Promise(r => setTimeout(r, 800));
    this.saving.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
```

- [ ] **Crear `ajustes-negocio.component.html`**

```html
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Sistema</div>
    <h1>Datos del <em>negocio</em></h1>
    <p class="sub">Lo que aparece en facturas y en la tienda pública.</p>
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Datos fiscales</h3><span class="sub">Lo que aparece en facturas</span></div>
  <div class="panel-b">
    <div class="grid-2">
      <div class="field"><label>Razón social</label><input class="input" [value]="razonSocial()" (input)="razonSocial.set($any($event.target).value)" /></div>
      <div class="field"><label>NIT</label><input class="input" [value]="nit()" (input)="nit.set($any($event.target).value)" /></div>
      <div class="field"><label>Email de contacto</label><input class="input" type="email" [value]="email()" (input)="email.set($any($event.target).value)" /></div>
      <div class="field"><label>Teléfono</label><input class="input" [value]="telefono()" (input)="telefono.set($any($event.target).value)" /></div>
      <div class="field" style="grid-column:span 2"><label>Dirección fiscal</label><input class="input" [value]="direccion()" (input)="direccion.set($any($event.target).value)" /></div>
      <div class="field"><label>Régimen tributario</label>
        <select class="select" [value]="regimen()" (change)="regimen.set($any($event.target).value)">
          <option value="simple">Régimen Simple</option>
          <option value="iva">Responsable de IVA</option>
          <option value="no">No responsable</option>
        </select>
      </div>
      <div class="field"><label>Moneda</label>
        <select class="select" [value]="moneda()" (change)="moneda.set($any($event.target).value)">
          <option value="COP">COP — Peso colombiano</option>
          <option value="USD">USD — Dólar</option>
        </select>
      </div>
    </div>
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Identidad visual</h3><span class="sub">Nombre y marca en la tienda pública</span></div>
  <div class="panel-b">
    <div class="grid-2">
      <div class="field"><label>Nombre de la tienda</label><input class="input" [value]="nombreTienda()" (input)="nombreTienda.set($any($event.target).value)" /></div>
      <div class="field"><label>Color primario</label>
        <div style="display:flex;gap:10px;align-items:center">
          <input type="color" [value]="colorPrimario()" (input)="colorPrimario.set($any($event.target).value)" style="width:40px;height:36px;padding:2px;border-radius:6px;border:1px solid var(--carbon-12);cursor:pointer" />
          <input class="input" [value]="colorPrimario()" (input)="colorPrimario.set($any($event.target).value)" style="flex:1" placeholder="#2A6FDB" />
        </div>
      </div>
    </div>
    <div class="field" style="margin-top:var(--s-4)">
      <label>Logo de la tienda</label>
      <div style="display:flex;align-items:center;gap:16px;padding:16px;border:1px dashed var(--carbon-20);border-radius:10px;margin-top:6px">
        <div style="width:64px;height:64px;border-radius:12px;background:var(--cream-2);display:grid;place-items:center;font-family:var(--display);font-size:28px;color:var(--carbon-50)">Cv</div>
        <div>
          <button class="btn-sm ghost">Subir logo</button>
          <div class="help" style="margin-top:6px">PNG o SVG · mínimo 200×200px</div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Configuración regional</h3></div>
  <div class="panel-b">
    <div class="grid-2">
      <div class="field"><label>Zona horaria</label>
        <select class="select" [value]="zona()" (change)="zona.set($any($event.target).value)">
          <option value="America/Bogota">América/Bogotá (UTC-5)</option>
          <option value="America/New_York">América/New_York (UTC-5/-4)</option>
          <option value="UTC">UTC</option>
        </select>
      </div>
      <div class="field"><label>Idioma del panel</label>
        <select class="select" [value]="idioma()" (change)="idioma.set($any($event.target).value)">
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  </div>
</div>

<div style="display:flex;justify-content:flex-end;gap:10px">
  <button class="btn-sm ghost">Cancelar</button>
  <button class="btn-sm solid" [disabled]="saving()" (click)="guardar()">
    @if (saving()) {
      <svg style="width:13px;height:13px;animation:spin 1s linear infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
      Guardando…
    } @else if (saved()) {
      <svg style="width:13px;height:13px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>
      Guardado
    } @else {
      Guardar cambios
    }
  </button>
</div>
```

- [ ] **Crear `ajustes-negocio.component.scss`** (vacío, usa clases globales)

```scss
:host { display: contents; }

@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Verificar** navegando a `/admin/ajustes/negocio` en el browser. Debe mostrar los formularios con valores prellenados y el botón Guardar con animación.

- [ ] **Commit**

```bash
git add src/app/pages/admin/ajustes/negocio/
git commit -m "feat(admin/ajustes): negocio — datos fiscales, identidad visual, regional"
```

---

## Task 4: Impuestos

**Files:**
- Create: `src/app/pages/admin/ajustes/impuestos/ajustes-impuestos.component.ts`
- Create: `src/app/pages/admin/ajustes/impuestos/ajustes-impuestos.component.html`
- Create: `src/app/pages/admin/ajustes/impuestos/ajustes-impuestos.component.scss`

- [ ] **Crear `ajustes-impuestos.component.ts`**

```typescript
import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Tasa { id: number; nombre: string; porcentaje: number; aplicaA: string; activa: boolean; }

@Component({
  selector: 'app-ajustes-impuestos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-impuestos.component.html',
  styleUrl: './ajustes-impuestos.component.scss',
})
export class AjustesImpuestosComponent {
  cobrarIva    = signal(true);
  ivaIncluido  = signal(true);
  tasas        = signal<Tasa[]>([
    { id: 1, nombre: 'IVA',          porcentaje: 19, aplicaA: 'todos',     activa: true  },
    { id: 2, nombre: 'IVA reducido', porcentaje: 5,  aplicaA: 'libros',    activa: false },
    { id: 3, nombre: 'Exento',       porcentaje: 0,  aplicaA: 'alimentos', activa: false },
  ]);
  nextId = 4;

  prefijoFactura     = signal('FE-');
  numeracionInicial  = signal(1001);
  resolucionDIAN     = signal('18764021912345');
  fechaResolucion    = signal('2027-12-31');

  saving = signal(false);
  saved  = signal(false);

  agregarTasa() {
    this.tasas.update(t => [...t, { id: this.nextId++, nombre: '', porcentaje: 0, aplicaA: 'todos', activa: true }]);
  }

  eliminarTasa(id: number) {
    this.tasas.update(t => t.filter(x => x.id !== id));
  }

  updateTasa(id: number, field: keyof Tasa, value: string | number | boolean) {
    this.tasas.update(t => t.map(x => x.id === id ? { ...x, [field]: value } : x));
  }

  async guardar() {
    this.saving.set(true);
    await new Promise(r => setTimeout(r, 800));
    this.saving.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
```

- [ ] **Crear `ajustes-impuestos.component.html`**

```html
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Sistema</div>
    <h1><em>Impuestos</em> y facturación</h1>
    <p class="sub">Configuración de IVA, tasas personalizadas y datos de facturación electrónica.</p>
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Configuración general</h3></div>
  <div class="panel-b" style="display:flex;flex-direction:column;gap:var(--s-4)">
    <label style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--carbon-08)">
      <div>
        <div style="font-weight:600;font-size:13.5px">Cobrar IVA en todos los productos</div>
        <div style="font-size:12px;color:var(--carbon-50);margin-top:2px">Aplica la tasa de IVA al precio de los productos</div>
      </div>
      <div class="tog-wrap" (click)="cobrarIva.set(!cobrarIva())">
        <div class="tog" [class.on]="cobrarIva()"></div>
      </div>
    </label>
    <label style="display:flex;justify-content:space-between;align-items:center;padding:12px 0">
      <div>
        <div style="font-weight:600;font-size:13.5px">Los precios ya incluyen IVA</div>
        <div style="font-size:12px;color:var(--carbon-50);margin-top:2px">Los precios en la tienda ya tienen el impuesto incluido</div>
      </div>
      <div class="tog-wrap" (click)="ivaIncluido.set(!ivaIncluido())">
        <div class="tog" [class.on]="ivaIncluido()"></div>
      </div>
    </label>
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Tasas personalizadas</h3><button class="btn-sm ghost" (click)="agregarTasa()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg> Agregar tasa</button></div>
  <div class="panel-b flush">
    <table class="tbl">
      <thead><tr><th>Nombre</th><th>Porcentaje</th><th>Aplica a</th><th>Activa</th><th></th></tr></thead>
      <tbody>
        @for (t of tasas(); track t.id) {
        <tr>
          <td><input class="input" style="padding:5px 9px;font-size:13px" [value]="t.nombre" (input)="updateTasa(t.id, 'nombre', $any($event.target).value)" placeholder="Ej: IVA" /></td>
          <td><div style="display:flex;align-items:center;gap:6px"><input class="input" type="number" style="padding:5px 9px;font-size:13px;width:70px" [value]="t.porcentaje" (input)="updateTasa(t.id, 'porcentaje', +$any($event.target).value)" /><span style="font-size:12px;color:var(--carbon-50)">%</span></div></td>
          <td>
            <select class="select" style="padding:5px 9px;font-size:13px" [value]="t.aplicaA" (change)="updateTasa(t.id, 'aplicaA', $any($event.target).value)">
              <option value="todos">Todos</option>
              <option value="camisetas">Camisetas</option>
              <option value="libros">Libretas</option>
              <option value="alimentos">Alimentos</option>
            </select>
          </td>
          <td>
            <div class="tog-wrap" (click)="updateTasa(t.id, 'activa', !t.activa)">
              <div class="tog" [class.on]="t.activa"></div>
            </div>
          </td>
          <td class="actions">
            <button class="icon-act" title="Eliminar" (click)="eliminarTasa(t.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>
            </button>
          </td>
        </tr>
        }
      </tbody>
    </table>
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Facturación electrónica</h3><span class="sub">Resolución DIAN</span></div>
  <div class="panel-b">
    <div class="grid-2">
      <div class="field"><label>Prefijo de factura</label><input class="input" [value]="prefijoFactura()" (input)="prefijoFactura.set($any($event.target).value)" placeholder="FE-" /></div>
      <div class="field"><label>Numeración inicial</label><input class="input" type="number" [value]="numeracionInicial()" (input)="numeracionInicial.set(+$any($event.target).value)" /></div>
      <div class="field"><label>Número de resolución DIAN</label><input class="input" [value]="resolucionDIAN()" (input)="resolucionDIAN.set($any($event.target).value)" /></div>
      <div class="field"><label>Fecha de vencimiento resolución</label><input class="input" type="date" [value]="fechaResolucion()" (input)="fechaResolucion.set($any($event.target).value)" /></div>
    </div>
  </div>
</div>

<div style="display:flex;justify-content:flex-end;gap:10px">
  <button class="btn-sm ghost">Cancelar</button>
  <button class="btn-sm solid" [disabled]="saving()" (click)="guardar()">
    @if (saving()) { <svg style="width:13px;height:13px;animation:spin 1s linear infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg> Guardando… }
    @else if (saved()) { <svg style="width:13px;height:13px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m5 12 5 5L20 7"/></svg> Guardado }
    @else { Guardar cambios }
  </button>
</div>
```

- [ ] **Crear `ajustes-impuestos.component.scss`**

```scss
:host { display: contents; }

.tog-wrap {
  cursor: pointer;
  .tog {
    width: 40px; height: 22px; border-radius: 11px;
    background: var(--carbon-20); position: relative; transition: background 150ms;
    &::after { content:''; position:absolute; top:3px; left:3px; width:16px; height:16px; border-radius:50%; background:#fff; transition: left 150ms; }
    &.on { background: var(--selva, #1F8A5B); &::after { left: 21px; } }
  }
}

@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/ajustes/impuestos/
git commit -m "feat(admin/ajustes): impuestos — IVA, tasas editables, facturación DIAN"
```

---

## Task 5: Envíos y tarifas

**Files:**
- Create: `src/app/pages/admin/ajustes/envios/ajustes-envios.component.ts`
- Create: `src/app/pages/admin/ajustes/envios/ajustes-envios.component.html`
- Create: `src/app/pages/admin/ajustes/envios/ajustes-envios.component.scss`

- [ ] **Crear `ajustes-envios.component.ts`**

```typescript
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Zona { id: number; nombre: string; municipios: string; tarifa: number; plazo: string; activa: boolean; }
interface Transportadora { id: string; nombre: string; desc: string; activa: boolean; apiKey: string; keyVisible: boolean; }

@Component({
  selector: 'app-ajustes-envios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-envios.component.html',
  styleUrl: './ajustes-envios.component.scss',
})
export class AjustesEnviosComponent {
  envioGratis      = signal(true);
  montoMinimo      = signal(150000);
  contraEntrega    = signal(true);
  recargoContra    = signal(5000);
  nextZonaId       = 4;

  zonas = signal<Zona[]>([
    { id: 1, nombre: 'Bogotá',       municipios: 'Bogotá D.C.',                     tarifa: 9000,  plazo: '1-2 días',   activa: true  },
    { id: 2, nombre: 'Eje cafetero', municipios: 'Manizales, Pereira, Armenia',      tarifa: 11000, plazo: '2-3 días',   activa: true  },
    { id: 3, nombre: 'Costa Caribe', municipios: 'Barranquilla, Cartagena, Santa Marta', tarifa: 14000, plazo: '3-4 días', activa: true },
  ]);

  transportadoras = signal<Transportadora[]>([
    { id: 'servientrega', nombre: 'Servientrega', desc: 'Cobertura nacional · entrega en 2-4 días',   activa: true,  apiKey: 'SVT-xxxx-yyyy', keyVisible: false },
    { id: 'coordinadora', nombre: 'Coordinadora', desc: 'Cobertura nacional · entrega en 2-3 días',   activa: false, apiKey: '',              keyVisible: false },
    { id: 'envia',        nombre: 'Enviá',         desc: 'Especialista en e-commerce colombiano',      activa: false, apiKey: '',              keyVisible: false },
    { id: 'tcc',          nombre: 'TCC',           desc: 'Transporte de carga y paquetería',           activa: false, apiKey: '',              keyVisible: false },
  ]);

  saving = signal(false);
  saved  = signal(false);

  agregarZona() {
    this.zonas.update(z => [...z, { id: this.nextZonaId++, nombre: '', municipios: '', tarifa: 0, plazo: '', activa: true }]);
  }

  eliminarZona(id: number) { this.zonas.update(z => z.filter(x => x.id !== id)); }

  updateZona(id: number, field: keyof Zona, value: string | number | boolean) {
    this.zonas.update(z => z.map(x => x.id === id ? { ...x, [field]: value } : x));
  }

  toggleTransp(id: string) {
    this.transportadoras.update(t => t.map(x => x.id === id ? { ...x, activa: !x.activa } : x));
  }

  toggleKey(id: string) {
    this.transportadoras.update(t => t.map(x => x.id === id ? { ...x, keyVisible: !x.keyVisible } : x));
  }

  updateKey(id: string, value: string) {
    this.transportadoras.update(t => t.map(x => x.id === id ? { ...x, apiKey: value } : x));
  }

  async guardar() {
    this.saving.set(true);
    await new Promise(r => setTimeout(r, 800));
    this.saving.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
```

- [ ] **Crear `ajustes-envios.component.html`**

```html
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Sistema</div>
    <h1><em>Envíos</em> y tarifas</h1>
    <p class="sub">Zonas de cobertura, transportadoras y política de envío gratis.</p>
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Envío gratis</h3></div>
  <div class="panel-b" style="display:flex;flex-direction:column;gap:var(--s-4)">
    <label style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-weight:600;font-size:13.5px">Activar envío gratis</div>
        <div style="font-size:12px;color:var(--carbon-50);margin-top:2px">A partir de un monto mínimo de compra</div>
      </div>
      <div class="tog-wrap" (click)="envioGratis.set(!envioGratis())"><div class="tog" [class.on]="envioGratis()"></div></div>
    </label>
    @if (envioGratis()) {
    <div class="field" style="max-width:220px">
      <label>Monto mínimo (COP)</label>
      <input class="input" type="number" [value]="montoMinimo()" (input)="montoMinimo.set(+$any($event.target).value)" />
    </div>
    }
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Zonas de envío</h3><button class="btn-sm ghost" (click)="agregarZona()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg> Nueva zona</button></div>
  <div class="panel-b flush">
    <table class="tbl">
      <thead><tr><th>Nombre</th><th>Municipios</th><th>Tarifa (COP)</th><th>Plazo</th><th>Activa</th><th></th></tr></thead>
      <tbody>
        @for (z of zonas(); track z.id) {
        <tr>
          <td><input class="input" style="padding:5px 9px;font-size:13px" [value]="z.nombre" (input)="updateZona(z.id,'nombre',$any($event.target).value)" /></td>
          <td><input class="input" style="padding:5px 9px;font-size:13px;min-width:180px" [value]="z.municipios" (input)="updateZona(z.id,'municipios',$any($event.target).value)" /></td>
          <td><input class="input" type="number" style="padding:5px 9px;font-size:13px;width:90px" [value]="z.tarifa" (input)="updateZona(z.id,'tarifa',+$any($event.target).value)" /></td>
          <td><input class="input" style="padding:5px 9px;font-size:13px;width:90px" [value]="z.plazo" (input)="updateZona(z.id,'plazo',$any($event.target).value)" /></td>
          <td><div class="tog-wrap" (click)="updateZona(z.id,'activa',!z.activa)"><div class="tog" [class.on]="z.activa"></div></div></td>
          <td class="actions"><button class="icon-act" (click)="eliminarZona(z.id)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg></button></td>
        </tr>
        }
      </tbody>
    </table>
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Transportadoras</h3></div>
  <div class="panel-b" style="display:flex;flex-direction:column;gap:var(--s-4)">
    @for (t of transportadoras(); track t.id) {
    <div style="padding:14px 16px;border:1px solid var(--carbon-08);border-radius:10px;display:flex;flex-direction:column;gap:var(--s-3)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:40px;height:40px;border-radius:8px;background:var(--cream-2);display:grid;place-items:center;font-family:var(--display);font-size:16px;color:var(--carbon-50)">{{ t.nombre.charAt(0) }}</div>
          <div><div style="font-weight:600;font-size:13.5px">{{ t.nombre }}</div><div style="font-size:12px;color:var(--carbon-50)">{{ t.desc }}</div></div>
        </div>
        <div class="tog-wrap" (click)="toggleTransp(t.id)"><div class="tog" [class.on]="t.activa"></div></div>
      </div>
      @if (t.activa) {
      <div class="field">
        <label>API Key</label>
        <div style="display:flex;gap:8px">
          <input class="input" [type]="t.keyVisible ? 'text' : 'password'" style="flex:1" [value]="t.apiKey" (input)="updateKey(t.id, $any($event.target).value)" placeholder="Ingresa tu clave API" />
          <button class="btn-sm ghost" style="padding:6px 10px" (click)="toggleKey(t.id)">{{ t.keyVisible ? 'Ocultar' : 'Ver' }}</button>
        </div>
      </div>
      }
    </div>
    }
    <div style="padding:14px 16px;border:1px solid var(--carbon-08);border-radius:10px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600;font-size:13.5px">Contra-entrega</div>
          <div style="font-size:12px;color:var(--carbon-50)">El cliente paga al recibir el paquete</div>
        </div>
        <div class="tog-wrap" (click)="contraEntrega.set(!contraEntrega())"><div class="tog" [class.on]="contraEntrega()"></div></div>
      </div>
      @if (contraEntrega()) {
      <div class="field" style="margin-top:var(--s-3);max-width:200px">
        <label>Recargo adicional (COP)</label>
        <input class="input" type="number" [value]="recargoContra()" (input)="recargoContra.set(+$any($event.target).value)" />
      </div>
      }
    </div>
  </div>
</div>

<div style="display:flex;justify-content:flex-end;gap:10px">
  <button class="btn-sm ghost">Cancelar</button>
  <button class="btn-sm solid" [disabled]="saving()" (click)="guardar()">
    @if (saving()) { <svg style="width:13px;height:13px;animation:spin 1s linear infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg> Guardando… }
    @else if (saved()) { <svg style="width:13px;height:13px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m5 12 5 5L20 7"/></svg> Guardado }
    @else { Guardar cambios }
  </button>
</div>
```

- [ ] **Crear `ajustes-envios.component.scss`**

```scss
:host { display: contents; }

.tog-wrap {
  cursor: pointer;
  .tog {
    width: 40px; height: 22px; border-radius: 11px;
    background: var(--carbon-20); position: relative; transition: background 150ms;
    &::after { content:''; position:absolute; top:3px; left:3px; width:16px; height:16px; border-radius:50%; background:#fff; transition: left 150ms; }
    &.on { background: var(--selva, #1F8A5B); &::after { left: 21px; } }
  }
}

@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/ajustes/envios/
git commit -m "feat(admin/ajustes): envios — zonas editables, transportadoras, contra-entrega"
```

---

## Task 6: Plantillas de correo

**Files:**
- Create: `src/app/pages/admin/ajustes/correos/ajustes-correos.component.ts`
- Create: `src/app/pages/admin/ajustes/correos/ajustes-correos.component.html`
- Create: `src/app/pages/admin/ajustes/correos/ajustes-correos.component.scss`

- [ ] **Crear `ajustes-correos.component.ts`**

```typescript
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Plantilla { id: string; nombre: string; asunto: string; cuerpo: string; activa: boolean; }

@Component({
  selector: 'app-ajustes-correos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-correos.component.html',
  styleUrl: './ajustes-correos.component.scss',
})
export class AjustesCorreosComponent {
  plantillas = signal<Plantilla[]>([
    { id: 'confirmacion', nombre: 'Confirmación de pedido',   activa: true,  asunto: '¡Tu pedido {{numero_orden}} está confirmado!', cuerpo: 'Hola {{nombre}},\n\nGracias por tu compra en Cuaquiverso. Tu pedido {{numero_orden}} por {{total}} ha sido confirmado.\n\nTe avisaremos cuando sea despachado.\n\nCon cariño,\nEl equipo Cuaquiverso' },
    { id: 'enviado',      nombre: 'Pedido enviado',            activa: true,  asunto: 'Tu pedido {{numero_orden}} está en camino', cuerpo: 'Hola {{nombre}},\n\nTu pedido {{numero_orden}} fue despachado. Puedes rastrear tu envío aquí: {{link_rastreo}}' },
    { id: 'entregado',    nombre: 'Pedido entregado',          activa: true,  asunto: '¡Tu pedido {{numero_orden}} llegó!', cuerpo: 'Hola {{nombre}},\n\n¡Tu pedido llegó! Esperamos que ames tus productos Cuaquiverso.\n\n{{productos}}' },
    { id: 'reembolso',    nombre: 'Reembolso aprobado',        activa: true,  asunto: 'Reembolso procesado — {{numero_orden}}', cuerpo: 'Hola {{nombre}},\n\nTu reembolso de {{total}} para el pedido {{numero_orden}} fue procesado. Verás el dinero en 3-5 días hábiles.' },
    { id: 'bienvenida',   nombre: 'Bienvenida al cliente',     activa: false, asunto: '¡Bienvenido al Cuaquiverso, {{nombre}}!', cuerpo: 'Hola {{nombre}},\n\nBienvenido al Cuaquiverso. Somos una marca de personajes colombianos con alma.\n\nExplora la tienda en cuaquiverso.co' },
    { id: 'carrito',      nombre: 'Recuperar carrito abandonado', activa: false, asunto: '{{nombre}}, olvidaste algo en el Cuaquiverso', cuerpo: 'Hola {{nombre}},\n\nDejaste {{productos}} en tu carrito. ¿Los recuperamos?\n\ncuaquiverso.co/carrito' },
  ]);

  plantillaActiva = signal<string | null>('confirmacion');

  readonly VARIABLES = ['{{nombre}}', '{{numero_orden}}', '{{total}}', '{{link_rastreo}}', '{{productos}}'];

  saving = signal(false);
  saved  = signal(false);

  activePlantilla() {
    return this.plantillas().find(p => p.id === this.plantillaActiva()) ?? null;
  }

  toggleActiva(id: string) {
    this.plantillas.update(ps => ps.map(p => p.id === id ? { ...p, activa: !p.activa } : p));
  }

  updateAsunto(id: string, val: string) {
    this.plantillas.update(ps => ps.map(p => p.id === id ? { ...p, asunto: val } : p));
  }

  updateCuerpo(id: string, val: string) {
    this.plantillas.update(ps => ps.map(p => p.id === id ? { ...p, cuerpo: val } : p));
  }

  insertarVariable(v: string) {
    const p = this.activePlantilla();
    if (!p) return;
    this.updateCuerpo(p.id, p.cuerpo + v);
  }

  async guardar() {
    this.saving.set(true);
    await new Promise(r => setTimeout(r, 800));
    this.saving.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
```

- [ ] **Crear `ajustes-correos.component.html`**

```html
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Sistema</div>
    <h1>Plantillas de <em>correo</em></h1>
    <p class="sub">Personaliza los mensajes automáticos que reciben tus clientes.</p>
  </div>
</div>

<div class="correos-grid">
  <!-- Lista izquierda -->
  <nav class="panel" style="align-self:flex-start">
    <div class="panel-b" style="padding:8px;display:flex;flex-direction:column;gap:2px">
      @for (p of plantillas(); track p.id) {
      <div class="pl-item" [class.is-active]="plantillaActiva() === p.id" (click)="plantillaActiva.set(p.id)">
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ p.nombre }}</div>
          <span class="badge" [class]="p.activa ? 'ok' : ''">
            <span class="pdot"></span>{{ p.activa ? 'Activa' : 'Inactiva' }}
          </span>
        </div>
        <div class="tog-wrap" style="flex-shrink:0" (click)="$event.stopPropagation(); toggleActiva(p.id)">
          <div class="tog" [class.on]="p.activa"></div>
        </div>
      </div>
      }
    </div>
  </nav>

  <!-- Editor derecha -->
  @if (activePlantilla(); as p) {
  <div style="display:flex;flex-direction:column;gap:var(--s-4)">
    <div class="panel">
      <div class="panel-h"><h3>{{ p.nombre }}</h3><span class="badge" [class]="p.activa ? 'ok' : ''"><span class="pdot"></span>{{ p.activa ? 'Activa' : 'Inactiva' }}</span></div>
      <div class="panel-b" style="display:flex;flex-direction:column;gap:var(--s-4)">
        <div class="field">
          <label>Asunto del correo</label>
          <input class="input" [value]="p.asunto" (input)="updateAsunto(p.id, $any($event.target).value)" />
        </div>
        <div class="field">
          <label>Variables disponibles</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
            @for (v of VARIABLES; track v) {
            <button class="chip" style="font-family:var(--mono);font-size:11px" (click)="insertarVariable(v)">{{ v }}</button>
            }
          </div>
          <div class="help" style="margin-top:6px">Click en una variable para insertarla al final del cuerpo.</div>
        </div>
        <div class="field">
          <label>Cuerpo del correo</label>
          <textarea class="textarea" rows="10" [value]="p.cuerpo" (input)="updateCuerpo(p.id, $any($event.target).value)"></textarea>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h"><h3>Vista previa</h3><span class="sub">Mock del email</span></div>
      <div class="panel-b">
        <div class="email-preview">
          <div class="ep-subject">{{ p.asunto }}</div>
          <div class="ep-body">{{ p.cuerpo }}</div>
        </div>
      </div>
    </div>

    <div style="display:flex;justify-content:flex-end;gap:10px">
      <button class="btn-sm ghost">Cancelar</button>
      <button class="btn-sm solid" [disabled]="saving()" (click)="guardar()">
        @if (saving()) { <svg style="width:13px;height:13px;animation:spin 1s linear infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg> Guardando… }
        @else if (saved()) { <svg style="width:13px;height:13px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m5 12 5 5L20 7"/></svg> Guardado }
        @else { Guardar plantilla }
      </button>
    </div>
  </div>
  }
</div>
```

- [ ] **Crear `ajustes-correos.component.scss`**

```scss
:host { display: contents; }

.correos-grid {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: var(--s-4);
  align-items: flex-start;
}

.pl-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 120ms;

  &:hover { background: var(--cream-2); }
  &.is-active { background: var(--cream-2); }
}

.tog-wrap {
  cursor: pointer;
  .tog {
    width: 36px; height: 20px; border-radius: 10px;
    background: var(--carbon-20); position: relative; transition: background 150ms;
    &::after { content:''; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition: left 150ms; }
    &.on { background: var(--selva, #1F8A5B); &::after { left: 18px; } }
  }
}

.email-preview {
  background: #fff;
  border: 1px solid var(--carbon-12);
  border-radius: 8px;
  padding: 20px 24px;
  font-family: Georgia, serif;
  max-width: 560px;

  .ep-subject {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--carbon-08);
    color: var(--carbon);
  }

  .ep-body {
    font-size: 14px;
    line-height: 1.7;
    color: #333;
    white-space: pre-wrap;
  }
}

@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/ajustes/correos/
git commit -m "feat(admin/ajustes): correos — plantillas editables con variables, vista previa"
```

---

## Task 7: Equipo y permisos

**Files:**
- Create: `src/app/pages/admin/ajustes/equipo/ajustes-equipo.component.ts`
- Create: `src/app/pages/admin/ajustes/equipo/ajustes-equipo.component.html`
- Create: `src/app/pages/admin/ajustes/equipo/ajustes-equipo.component.scss`

- [ ] **Crear `ajustes-equipo.component.ts`**

```typescript
import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type Rol = 'owner' | 'operaciones' | 'contenido' | 'lectura';

interface Miembro {
  id: string; nombre: string; email: string;
  rol: Rol; ultimoAcceso: string; activo: boolean;
}

interface AccesoLog { persona: string; accion: string; fecha: string; }

const ROL_META: Record<Rol, { label: string; tone: string; desc: string }> = {
  owner:      { label: 'Owner',         tone: 'ok',   desc: 'Acceso total. Puede eliminar la cuenta.' },
  operaciones:{ label: 'Operaciones',   tone: 'rio',  desc: 'Pedidos, clientes, pagos, inventario.' },
  contenido:  { label: 'Contenido',     tone: 'lila', desc: 'Portafolio, personajes, plantillas.' },
  lectura:    { label: 'Solo lectura',  tone: '',     desc: 'Solo puede ver, no puede editar nada.' },
};

@Component({
  selector: 'app-ajustes-equipo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-equipo.component.html',
  styleUrl: './ajustes-equipo.component.scss',
})
export class AjustesEquipoComponent {
  readonly ROL_META = ROL_META;
  readonly ROLES: Rol[] = ['owner', 'operaciones', 'contenido', 'lectura'];

  miembros = signal<Miembro[]>([
    { id: 'm1', nombre: 'Capitán Cuac',  email: 'admin@cuaquiverso.co',  rol: 'owner',       ultimoAcceso: 'Ahora',    activo: true },
    { id: 'm2', nombre: 'María José',    email: 'mj@cuaquiverso.co',     rol: 'operaciones', ultimoAcceso: 'Ayer 18:22', activo: true },
    { id: 'm3', nombre: 'Felipe Andrade',email: 'fa@cuaquiverso.co',     rol: 'contenido',   ultimoAcceso: 'Hace 3d',  activo: true },
  ]);

  editingMember = signal<string | null>(null);
  editingRol    = signal<Rol>('lectura');

  inviteEmail = signal('');
  inviteRol   = signal<Rol>('operaciones');
  inviteSent  = signal(false);

  readonly LOG: AccesoLog[] = [
    { persona: 'Capitán Cuac',   accion: 'Inicio de sesión',    fecha: 'Hoy 09:14'    },
    { persona: 'María José',     accion: 'Editó pedido #CQ-2814', fecha: 'Ayer 18:22' },
    { persona: 'Felipe Andrade', accion: 'Publicó proyecto',    fecha: 'Hace 3 días'  },
    { persona: 'María José',     accion: 'Inicio de sesión',    fecha: 'Hace 4 días'  },
    { persona: 'Capitán Cuac',   accion: 'Cambió ajuste de IVA', fecha: 'Hace 5 días' },
  ];

  saving = signal(false);
  saved  = signal(false);

  startEdit(m: Miembro) {
    this.editingMember.set(m.id);
    this.editingRol.set(m.rol);
  }

  saveEdit() {
    const id = this.editingMember();
    if (!id) return;
    this.miembros.update(ms => ms.map(m => m.id === id ? { ...m, rol: this.editingRol() } : m));
    this.editingMember.set(null);
  }

  revocar(id: string) {
    this.miembros.update(ms => ms.filter(m => m.id !== id));
  }

  async enviarInvitacion() {
    if (!this.inviteEmail().trim()) return;
    this.inviteSent.set(true);
    await new Promise(r => setTimeout(r, 600));
    this.inviteEmail.set('');
    setTimeout(() => this.inviteSent.set(false), 3000);
  }

  initials(nombre: string): string {
    return nombre.split(' ').map(s => s[0] ?? '').slice(0, 2).join('').toUpperCase();
  }
}
```

- [ ] **Crear `ajustes-equipo.component.html`**

```html
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Sistema</div>
    <h1>Equipo y <em>permisos</em></h1>
    <p class="sub">Gestiona quién tiene acceso al panel y qué puede hacer.</p>
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Miembros activos</h3><span class="sub">{{ miembros().length }} personas</span></div>
  <div class="panel-b flush">
    <table class="tbl">
      <thead><tr><th>Persona</th><th>Rol</th><th>Email</th><th>Último acceso</th><th></th></tr></thead>
      <tbody>
        @for (m of miembros(); track m.id) {
        <tr>
          <td><div class="pname"><div class="thumb" style="background:var(--cream-2);color:var(--carbon)">{{ initials(m.nombre) }}</div><div class="meta"><strong>{{ m.nombre }}</strong><span>{{ m.activo ? 'Activo' : 'Inactivo' }}</span></div></div></td>
          <td><span class="badge" [class]="ROL_META[m.rol].tone"><span class="pdot"></span>{{ ROL_META[m.rol].label }}</span></td>
          <td><span class="id">{{ m.email }}</span></td>
          <td><span class="id">{{ m.ultimoAcceso }}</span></td>
          <td class="actions">
            <button class="icon-act" title="Editar rol" (click)="startEdit(m)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4 4 14v6h6L20 10"/><path d="M14 4l3-3 4 4-3 3"/></svg>
            </button>
          </td>
        </tr>
        @if (editingMember() === m.id) {
        <tr class="edit-row">
          <td colspan="5">
            <div style="padding:16px;display:flex;flex-direction:column;gap:var(--s-3)">
              <div style="font-size:13px;font-weight:600;margin-bottom:4px">Cambiar rol de {{ m.nombre }}</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                @for (r of ROLES; track r) {
                <label style="display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border:1px solid var(--carbon-08);border-radius:8px;cursor:pointer;flex:1;min-width:140px" [style.background]="editingRol() === r ? 'var(--cream-2)' : 'transparent'">
                  <input type="radio" name="editRol" [value]="r" [(ngModel)]="$any(editingRol).set(r)" style="margin-top:2px" />
                  <div>
                    <div style="font-weight:600;font-size:13px">{{ ROL_META[r].label }}</div>
                    <div style="font-size:11.5px;color:var(--carbon-50)">{{ ROL_META[r].desc }}</div>
                  </div>
                </label>
                }
              </div>
              <div style="display:flex;gap:10px;align-items:center;margin-top:4px">
                <button class="btn-sm danger" (click)="revocar(m.id)">Revocar acceso</button>
                <div style="flex:1"></div>
                <button class="btn-sm ghost" (click)="editingMember.set(null)">Cancelar</button>
                <button class="btn-sm solid" (click)="saveEdit()">Guardar cambios</button>
              </div>
            </div>
          </td>
        </tr>
        }
        }
      </tbody>
    </table>
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Invitar a alguien</h3></div>
  <div class="panel-b">
    <div style="display:flex;gap:12px;align-items:flex-end">
      <div class="field" style="flex:1">
        <label>Correo electrónico</label>
        <input class="input" type="email" placeholder="correo@ejemplo.co" [value]="inviteEmail()" (input)="inviteEmail.set($any($event.target).value)" />
      </div>
      <div class="field" style="width:180px">
        <label>Rol</label>
        <select class="select" [value]="inviteRol()" (change)="inviteRol.set($any($event.target).value)">
          <option value="operaciones">Operaciones</option>
          <option value="contenido">Contenido</option>
          <option value="lectura">Solo lectura</option>
        </select>
      </div>
      <button class="btn-sm solid" style="margin-bottom:1px" [disabled]="!inviteEmail().trim()" (click)="enviarInvitacion()">
        @if (inviteSent()) { <svg style="width:13px;height:13px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m5 12 5 5L20 7"/></svg> Invitación enviada }
        @else { Enviar invitación }
      </button>
    </div>
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Log de accesos recientes</h3></div>
  <div class="panel-b flush">
    <table class="tbl">
      <thead><tr><th>Persona</th><th>Acción</th><th>Fecha</th></tr></thead>
      <tbody>
        @for (l of LOG; track $index) {
        <tr>
          <td><strong style="font-weight:600">{{ l.persona }}</strong></td>
          <td>{{ l.accion }}</td>
          <td><span class="id">{{ l.fecha }}</span></td>
        </tr>
        }
      </tbody>
    </table>
  </div>
</div>
```

- [ ] **Crear `ajustes-equipo.component.scss`**

```scss
:host { display: contents; }

.edit-row td {
  background: var(--cream-2);
  border-top: none;
}
```

- [ ] **Nota sobre el radio button de rol:** El `[(ngModel)]` con signals no funciona directamente. En el template del editor de rol, reemplazar los radio buttons con esta lógica simplificada:

```html
<!-- En lugar de [(ngModel)], usa [checked] + (change) -->
<input type="radio" name="editRol" [value]="r"
  [checked]="editingRol() === r"
  (change)="editingRol.set(r)" style="margin-top:2px" />
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/ajustes/equipo/
git commit -m "feat(admin/ajustes): equipo — roles, edición inline, invitación, log de accesos"
```

---

## Task 8: Integraciones

**Files:**
- Create: `src/app/pages/admin/ajustes/integraciones/ajustes-integraciones.component.ts`
- Create: `src/app/pages/admin/ajustes/integraciones/ajustes-integraciones.component.html`
- Create: `src/app/pages/admin/ajustes/integraciones/ajustes-integraciones.component.scss`

- [ ] **Crear `ajustes-integraciones.component.ts`**

```typescript
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Estado = 'conectado' | 'disponible' | 'proximo';

interface Integracion {
  id: string; nombre: string; desc: string; categoria: string;
  estado: Estado; color: string;
  config: { apiKey?: string; secretKey?: string; webhookUrl?: string; sandbox?: boolean;
            audienceId?: string; measurementId?: string; pixelId?: string; };
  keyVisible: boolean;
  expanded: boolean;
}

@Component({
  selector: 'app-ajustes-integraciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-integraciones.component.html',
  styleUrl: './ajustes-integraciones.component.scss',
})
export class AjustesIntegracionesComponent {
  integraciones = signal<Integracion[]>([
    { id: 'bold',       nombre: 'Bold',             desc: 'Pasarela de pagos colombiana',        categoria: 'Pagos',      estado: 'conectado',  color: '#2A6FDB', config: { apiKey: 'pk_live_xxxxx', secretKey: '', webhookUrl: '', sandbox: false }, keyVisible: false, expanded: false },
    { id: 'pse',        nombre: 'PSE',              desc: 'Débito directo a cuentas bancarias',  categoria: 'Pagos',      estado: 'conectado',  color: '#1F8A5B', config: { apiKey: 'pse_live_xxxxx', secretKey: '',                  sandbox: false }, keyVisible: false, expanded: false },
    { id: 'nequi',      nombre: 'Nequi',            desc: 'Pagos con billetera digital',         categoria: 'Pagos',      estado: 'conectado',  color: '#8B6FD8', config: { apiKey: 'nq_live_xxxxx',  secretKey: '',                  sandbox: false }, keyVisible: false, expanded: false },
    { id: 'mailchimp',  nombre: 'Mailchimp',        desc: 'Email marketing y newsletters',       categoria: 'Email',      estado: 'disponible', color: '#FFD43B', config: { apiKey: '', audienceId: '' },                                              keyVisible: false, expanded: false },
    { id: 'ga',         nombre: 'Google Analytics', desc: 'Analítica de tráfico y conversiones', categoria: 'Analytics',  estado: 'disponible', color: '#E8623D', config: { measurementId: '' },                                                      keyVisible: false, expanded: false },
    { id: 'meta',       nombre: 'Meta Pixel',       desc: 'Seguimiento de conversiones de Meta', categoria: 'Marketing',  estado: 'disponible', color: '#151F28', config: { pixelId: '' },                                                            keyVisible: false, expanded: false },
    { id: 'servi',      nombre: 'Servientrega',     desc: 'Cotización y guías automáticas',      categoria: 'Envíos',     estado: 'conectado',  color: '#E8623D', config: { apiKey: 'SVT-xxxx', sandbox: false },                                     keyVisible: false, expanded: false },
    { id: 'coordinad',  nombre: 'Coordinadora',     desc: 'Cobertura nacional, envío exprés',    categoria: 'Envíos',     estado: 'proximo',    color: '#2E8FB8', config: {},                                                                         keyVisible: false, expanded: false },
  ]);

  saving = signal(false);
  saved  = signal(false);

  toggle(id: string) {
    this.integraciones.update(list => list.map(i => i.id === id ? { ...i, expanded: !i.expanded } : { ...i, expanded: false }));
  }

  toggleKey(id: string) {
    this.integraciones.update(list => list.map(i => i.id === id ? { ...i, keyVisible: !i.keyVisible } : i));
  }

  updateConfig(id: string, field: string, value: string | boolean) {
    this.integraciones.update(list => list.map(i => i.id === id ? { ...i, config: { ...i.config, [field]: value } } : i));
  }

  async guardar(id: string) {
    this.saving.set(true);
    await new Promise(r => setTimeout(r, 800));
    this.saving.set(false);
    this.saved.set(true);
    this.integraciones.update(list => list.map(i => i.id === id ? { ...i, expanded: false } : i));
    setTimeout(() => this.saved.set(false), 2000);
  }

  estadoTone(e: Estado): string {
    return e === 'conectado' ? 'ok' : e === 'disponible' ? 'rio' : '';
  }
  estadoLabel(e: Estado): string {
    return e === 'conectado' ? 'Conectado' : e === 'disponible' ? 'Disponible' : 'Próximamente';
  }
}
```

- [ ] **Crear `ajustes-integraciones.component.html`**

```html
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Sistema</div>
    <h1><em>Integraciones</em></h1>
    <p class="sub">Conecta Cuaquiverso con tus herramientas de pagos, analítica y envíos.</p>
  </div>
</div>

<div class="int-grid">
  @for (i of integraciones(); track i.id) {
  <div class="int-card" [class.is-expanded]="i.expanded">
    <div class="int-card-head" (click)="i.estado !== 'proximo' && toggle(i.id)">
      <div class="int-logo" [style.background]="i.color + '22'" [style.color]="i.color">{{ i.nombre.charAt(0) }}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13.5px">{{ i.nombre }}</div>
        <div style="font-size:12px;color:var(--carbon-50)">{{ i.desc }}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
        <span style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--carbon-50)">{{ i.categoria }}</span>
        <span class="badge" [class]="estadoTone(i.estado)"><span class="pdot"></span>{{ estadoLabel(i.estado) }}</span>
        @if (i.estado !== 'proximo') {
        <svg style="width:14px;height:14px;color:var(--carbon-50);transition:transform 200ms" [style.transform]="i.expanded ? 'rotate(180deg)' : 'rotate(0)'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
        }
      </div>
    </div>

    @if (i.expanded) {
    <div class="int-config">
      @if (i.config['apiKey'] !== undefined) {
      <div class="field">
        <label>API Key</label>
        <div style="display:flex;gap:8px">
          <input class="input" [type]="i.keyVisible ? 'text' : 'password'" style="flex:1" [value]="i.config['apiKey']" (input)="updateConfig(i.id,'apiKey',$any($event.target).value)" placeholder="pk_live_…" />
          <button class="btn-sm ghost" style="padding:6px 10px" (click)="toggleKey(i.id)">{{ i.keyVisible ? 'Ocultar' : 'Ver' }}</button>
        </div>
      </div>
      }
      @if (i.config['secretKey'] !== undefined) {
      <div class="field">
        <label>Secret Key</label>
        <input class="input" type="password" [value]="i.config['secretKey']" (input)="updateConfig(i.id,'secretKey',$any($event.target).value)" placeholder="sk_live_…" />
      </div>
      }
      @if (i.config['webhookUrl'] !== undefined) {
      <div class="field">
        <label>Webhook URL</label>
        <input class="input" [value]="i.config['webhookUrl']" (input)="updateConfig(i.id,'webhookUrl',$any($event.target).value)" placeholder="https://cuaquiverso.co/webhook/bold" />
      </div>
      }
      @if (i.config['audienceId'] !== undefined) {
      <div class="field">
        <label>Audience ID</label>
        <input class="input" [value]="i.config['audienceId']" (input)="updateConfig(i.id,'audienceId',$any($event.target).value)" placeholder="abc123def456" />
      </div>
      }
      @if (i.config['measurementId'] !== undefined) {
      <div class="field">
        <label>Measurement ID</label>
        <input class="input" [value]="i.config['measurementId']" (input)="updateConfig(i.id,'measurementId',$any($event.target).value)" placeholder="G-XXXXXXXXXX" />
      </div>
      }
      @if (i.config['pixelId'] !== undefined) {
      <div class="field">
        <label>Pixel ID</label>
        <input class="input" [value]="i.config['pixelId']" (input)="updateConfig(i.id,'pixelId',$any($event.target).value)" placeholder="123456789012345" />
      </div>
      }
      @if (i.config['sandbox'] !== undefined) {
      <label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer">
        <input type="checkbox" [checked]="i.config['sandbox']" (change)="updateConfig(i.id,'sandbox',$any($event.target).checked)" />
        Modo sandbox (pruebas)
      </label>
      }
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:var(--s-3)">
        <button class="btn-sm ghost" (click)="toggle(i.id)">Cancelar</button>
        <button class="btn-sm solid" (click)="guardar(i.id)">
          @if (saving()) { Guardando… } @else { Guardar configuración }
        </button>
      </div>
    </div>
    }
  </div>
  }
</div>
```

- [ ] **Crear `ajustes-integraciones.component.scss`**

```scss
:host { display: contents; }

.int-grid {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}

.int-card {
  border: 1px solid var(--carbon-08);
  border-radius: 12px;
  overflow: hidden;
  background: var(--cream);

  &.is-expanded { border-color: var(--carbon-20); }
}

.int-card-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 120ms;

  &:hover { background: var(--cream-2); }
}

.int-logo {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-family: var(--display);
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}

.int-config {
  padding: 0 20px 20px;
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  border-top: 1px solid var(--carbon-08);
  padding-top: var(--s-4);
}
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/ajustes/integraciones/
git commit -m "feat(admin/ajustes): integraciones — tarjetas expandibles con config por tipo"
```

---

## Task 9: Dominios

**Files:**
- Create: `src/app/pages/admin/ajustes/dominios/ajustes-dominios.component.ts`
- Create: `src/app/pages/admin/ajustes/dominios/ajustes-dominios.component.html`
- Create: `src/app/pages/admin/ajustes/dominios/ajustes-dominios.component.scss`

- [ ] **Crear `ajustes-dominios.component.ts`**

```typescript
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type TipoDominio = 'principal' | 'alias' | 'redirect';
type VerifState  = 'idle' | 'checking' | 'records' | 'verified';

interface Dominio { id: number; dominio: string; tipo: TipoDominio; ssl: boolean; activo: boolean; }
interface Redirect { id: number; origen: string; destino: string; tipo: '301' | '302'; activo: boolean; }

@Component({
  selector: 'app-ajustes-dominios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-dominios.component.html',
  styleUrl: './ajustes-dominios.component.scss',
})
export class AjustesDominiosComponent {
  dominios = signal<Dominio[]>([
    { id: 1, dominio: 'cuaquiverso.co',     tipo: 'principal', ssl: true,  activo: true  },
    { id: 2, dominio: 'www.cuaquiverso.co', tipo: 'alias',     ssl: true,  activo: true  },
  ]);

  redirects = signal<Redirect[]>([
    { id: 1, origen: '/tienda-vieja', destino: '/tienda', tipo: '301', activo: true },
  ]);

  newDomain      = signal('');
  newDomainTipo  = signal<TipoDominio>('alias');
  verifState     = signal<VerifState>('idle');
  addingDomain   = signal(false);
  addingRedirect = signal(false);
  newRedOrigen   = signal('');
  newRedDestino  = signal('');
  newRedTipo     = signal<'301' | '302'>('301');
  nextId         = 3;
  nextRedId      = 2;

  readonly DNS_RECORDS = [
    { tipo: 'CNAME', host: 'www',  valor: 'cuaquiverso.co.cdn.provider.com' },
    { tipo: 'A',     host: '@',    valor: '76.223.105.230'                  },
    { tipo: 'TXT',   host: '@',    valor: 'v=cuac-verify abc123def456'      },
  ];

  async verificar() {
    if (!this.newDomain().trim()) return;
    this.verifState.set('checking');
    await new Promise(r => setTimeout(r, 1500));
    this.verifState.set('records');
  }

  async reVerificar() {
    this.verifState.set('checking');
    await new Promise(r => setTimeout(r, 1200));
    this.verifState.set('verified');
    this.dominios.update(d => [...d, {
      id: this.nextId++,
      dominio: this.newDomain(),
      tipo: this.newDomainTipo(),
      ssl: false,
      activo: true,
    }]);
    this.newDomain.set('');
    this.verifState.set('idle');
    this.addingDomain.set(false);
  }

  eliminarDominio(id: number) { this.dominios.update(d => d.filter(x => x.id !== id)); }

  agregarRedirect() {
    if (!this.newRedOrigen().trim() || !this.newRedDestino().trim()) return;
    this.redirects.update(r => [...r, {
      id: this.nextRedId++,
      origen: this.newRedOrigen(),
      destino: this.newRedDestino(),
      tipo: this.newRedTipo(),
      activo: true,
    }]);
    this.newRedOrigen.set('');
    this.newRedDestino.set('');
    this.addingRedirect.set(false);
  }

  eliminarRedirect(id: number) { this.redirects.update(r => r.filter(x => x.id !== id)); }
}
```

- [ ] **Crear `ajustes-dominios.component.html`**

```html
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Sistema</div>
    <h1><em>Dominios</em></h1>
    <p class="sub">Administra los dominios asociados a tu tienda.</p>
  </div>
</div>

<div class="panel">
  <div class="panel-h"><h3>Dominio principal</h3></div>
  <div class="panel-b" style="display:flex;align-items:center;gap:16px">
    <svg style="width:32px;height:32px;color:var(--selva)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
    <div style="flex:1">
      <div style="font-family:var(--display);font-size:22px;line-height:1">cuaquiverso.co</div>
      <div style="font-size:12px;color:var(--carbon-50);margin-top:3px">Vence 2027-11-30 · Registrador: GoDaddy</div>
    </div>
    <span class="badge ok"><span class="pdot"></span>DNS verificado</span>
    <span class="badge ok"><span class="pdot"></span>SSL activo</span>
  </div>
</div>

<div class="panel">
  <div class="panel-h">
    <h3>Dominios adicionales</h3>
    <button class="btn-sm ghost" (click)="addingDomain.set(true)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg>
      Agregar dominio
    </button>
  </div>
  <div class="panel-b flush">
    <table class="tbl">
      <thead><tr><th>Dominio</th><th>Tipo</th><th>SSL</th><th>Estado</th><th></th></tr></thead>
      <tbody>
        @for (d of dominios(); track d.id) {
        <tr>
          <td><span style="font-family:var(--mono);font-size:13px">{{ d.dominio }}</span></td>
          <td><span class="badge">{{ d.tipo }}</span></td>
          <td>
            @if (d.ssl) { <span class="badge ok"><span class="pdot"></span>Activo</span> }
            @else { <span class="badge"><span class="pdot"></span>Pendiente</span> }
          </td>
          <td>
            @if (d.activo) { <span class="badge ok"><span class="pdot"></span>Activo</span> }
            @else { <span class="badge err"><span class="pdot"></span>Inactivo</span> }
          </td>
          <td class="actions">
            @if (d.tipo !== 'principal') {
            <button class="icon-act" title="Eliminar" (click)="eliminarDominio(d.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>
            </button>
            }
          </td>
        </tr>
        }
      </tbody>
    </table>
  </div>

  @if (addingDomain()) {
  <div style="padding:var(--s-4) var(--s-5);border-top:1px solid var(--carbon-08);display:flex;flex-direction:column;gap:var(--s-3)">
    <div style="display:flex;gap:12px;align-items:flex-end">
      <div class="field" style="flex:1"><label>Dominio</label><input class="input" placeholder="mitienda.com" [value]="newDomain()" (input)="newDomain.set($any($event.target).value)" /></div>
      <div class="field" style="width:160px">
        <label>Tipo</label>
        <select class="select" [value]="newDomainTipo()" (change)="newDomainTipo.set($any($event.target).value)">
          <option value="alias">Alias</option>
          <option value="redirect">Redirect</option>
        </select>
      </div>
      <button class="btn-sm solid" [disabled]="!newDomain().trim() || verifState() === 'checking'" (click)="verificar()">
        @if (verifState() === 'checking') { Verificando… } @else { Verificar }
      </button>
      <button class="btn-sm ghost" (click)="addingDomain.set(false); verifState.set('idle')">Cancelar</button>
    </div>

    @if (verifState() === 'records') {
    <div style="background:var(--cream-2);border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:var(--s-3)">
      <div style="font-weight:600;font-size:13px">Configura estos registros DNS en tu registrador:</div>
      <table class="tbl">
        <thead><tr><th>Tipo</th><th>Host</th><th>Valor</th></tr></thead>
        <tbody>
          @for (r of DNS_RECORDS; track r.tipo) {
          <tr>
            <td><span class="badge">{{ r.tipo }}</span></td>
            <td><span class="id">{{ r.host }}</span></td>
            <td><span style="font-family:var(--mono);font-size:11.5px">{{ r.valor }}</span></td>
          </tr>
          }
        </tbody>
      </table>
      <button class="btn-sm ghost" style="align-self:flex-start" (click)="reVerificar()">Verificar de nuevo</button>
    </div>
    }
  </div>
  }
</div>

<div class="panel">
  <div class="panel-h">
    <h3>Redirects</h3>
    <button class="btn-sm ghost" (click)="addingRedirect.set(true)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg>
      Agregar redirect
    </button>
  </div>
  <div class="panel-b flush">
    <table class="tbl">
      <thead><tr><th>Origen</th><th>Destino</th><th>Tipo</th><th>Activo</th><th></th></tr></thead>
      <tbody>
        @for (r of redirects(); track r.id) {
        <tr>
          <td><span class="id">{{ r.origen }}</span></td>
          <td><span class="id">{{ r.destino }}</span></td>
          <td><span class="badge">{{ r.tipo }}</span></td>
          <td><span class="badge" [class]="r.activo ? 'ok' : ''"><span class="pdot"></span>{{ r.activo ? 'Activo' : 'Inactivo' }}</span></td>
          <td class="actions"><button class="icon-act" (click)="eliminarRedirect(r.id)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg></button></td>
        </tr>
        }
        @if (addingRedirect()) {
        <tr>
          <td><input class="input" style="padding:5px 9px;font-size:13px" placeholder="/ruta-vieja" [value]="newRedOrigen()" (input)="newRedOrigen.set($any($event.target).value)" /></td>
          <td><input class="input" style="padding:5px 9px;font-size:13px" placeholder="/ruta-nueva" [value]="newRedDestino()" (input)="newRedDestino.set($any($event.target).value)" /></td>
          <td>
            <select class="select" style="padding:5px 9px;font-size:13px" [value]="newRedTipo()" (change)="newRedTipo.set($any($event.target).value)">
              <option value="301">301</option>
              <option value="302">302</option>
            </select>
          </td>
          <td></td>
          <td class="actions" style="display:flex;gap:4px">
            <button class="icon-act" title="Confirmar" (click)="agregarRedirect()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m5 12 5 5L20 7"/></svg></button>
            <button class="icon-act" title="Cancelar" (click)="addingRedirect.set(false)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
          </td>
        </tr>
        }
      </tbody>
    </table>
  </div>
</div>
```

- [ ] **Crear `ajustes-dominios.component.scss`**

```scss
:host { display: contents; }
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/ajustes/dominios/
git commit -m "feat(admin/ajustes): dominios — gestión de dominios, verificación DNS, redirects"
```

---

## Task 10: Verificación final

- [ ] **Levantar el servidor de desarrollo**

```bash
npx ng serve --open
```

- [ ] **Verificar cada ruta navegando manualmente:**
  - `/admin/ajustes` → debe redirigir a `/admin/ajustes/negocio`
  - `/admin/ajustes/negocio` → formulario de datos del negocio
  - `/admin/ajustes/impuestos` → IVA y tasas
  - `/admin/ajustes/envios` → zonas y transportadoras
  - `/admin/ajustes/correos` → lista + editor de plantillas
  - `/admin/ajustes/equipo` → tabla de miembros + invitación
  - `/admin/ajustes/integraciones` → tarjetas expandibles
  - `/admin/ajustes/dominios` → dominios y redirects

- [ ] **Verificar breadcrumbs** en cada sub-ruta (deben mostrar `Cuaquiverso / Sistema / Ajustes / <Nombre>`)

- [ ] **Verificar link activo del sidebar** — "Ajustes" debe quedar marcado con `is-active` en todas las sub-rutas

- [ ] **Verificar botón Guardar** en al menos 2 sub-páginas — debe mostrar spinner → checkmark

- [ ] **Verificar que el sidebar de Ajustes** muestra el ítem activo correcto al navegar entre sub-páginas

- [ ] **Commit final**

```bash
git add -A
git commit -m "feat(admin/ajustes): 7 sub-páginas completas con formularios funcionales"
```
