# Admin Refactor — Inventario, Ventas, Evento y Pedido Manual

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la sección Inventario del sidebar, mejorar el registro de ventas (canal específico, total por producto, drill-down por fila), exponer gestión de eventos desde Productos, y agregar el drawer de pedido manual en Pedidos.

**Architecture:** Todos los cambios son en la capa de presentación Angular del admin. No se crean nuevos componentes ni servicios — se modifican archivos existentes. El único cambio al servicio es extender el tipo `VentaEvento` y la query de Supabase en `inventario.service.ts`.

**Tech Stack:** Angular 18 standalone components, signals, Supabase (PostgreSQL join), SCSS con tokens CSS.

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `src/app/app.routes.ts` | Eliminar 4 rutas inventario |
| `src/app/pages/admin/admin-shell.component.html` | Quitar link + condiciones isInventarioRoute |
| `src/app/pages/admin/admin-shell.component.ts` | Quitar computed + método + crumbs inventario |
| `src/app/core/services/inventario.service.ts` | Extender interfaz VentaEvento + query getVentas |
| `src/app/pages/admin/productos/ventas-general.component.ts` | Agregar computed totalProductosVendidos + signal ventaSeleccionada |
| `src/app/pages/admin/productos/ventas-general.component.html` | Canal fix + total-row + click handler + drawer detalle |
| `src/app/pages/admin/productos/ventas-general.component.scss` | Estilo .total-row |
| `src/app/pages/admin/productos/productos-list.component.ts` | Inyectar EventosService + signals evento activo |
| `src/app/pages/admin/productos/productos-list.component.html` | Botones evento + dialogs crear/finalizar |
| `src/app/pages/admin/admin-home.component.ts` | Signal manualOrderOn + estado formulario pedido manual |
| `src/app/pages/admin/admin-home.component.html` | Fix botón Pedido manual + drawer pedido manual |

---

## Task 1: Eliminar sección Inventario del sidebar y rutas

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/pages/admin/admin-shell.component.html`
- Modify: `src/app/pages/admin/admin-shell.component.ts`

- [ ] **Step 1: Eliminar las 4 rutas inventario de app.routes.ts**

En `src/app/app.routes.ts`, dentro del array `children` de la ruta `/admin`, eliminar los 4 objetos con path `inventario`, `inventario/nuevo`, `inventario/:id/editar`, `inventario/ventas`. El bloque a eliminar es exactamente:

```typescript
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
```

- [ ] **Step 2: Quitar el link Inventario del sidebar HTML**

En `src/app/pages/admin/admin-shell.component.html`, eliminar el bloque completo del link de Inventario (líneas 92–96):

```html
      <a [class.is-active]="isInventarioRoute()" (click)="goInventario()">
        <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="7" cy="6" r="1" fill="currentColor"/><circle cx="7" cy="12" r="1" fill="currentColor"/><circle cx="7" cy="18" r="1" fill="currentColor"/></svg>
        <span>Inventario</span>
        <span class="count">sofa-26</span>
      </a>
```

- [ ] **Step 3: Limpiar isInventarioRoute() de las condiciones is-active en el HTML**

En `admin-shell.component.html`, línea ~58, cambiar:

```html
      <a [class.is-active]="(state.view() === id && !isInventarioRoute() && !isPortafolioRoute() && !isCotizacionesRoute() && !isProductosRoute() && !isEventosRoute()) || (id === 'productos' && isProductosRoute())" (click)="goHome(id)">
```

por:

```html
      <a [class.is-active]="(state.view() === id && !isPortafolioRoute() && !isCotizacionesRoute() && !isProductosRoute() && !isEventosRoute()) || (id === 'productos' && isProductosRoute())" (click)="goHome(id)">
```

Y en línea ~72 (sección Universo), cambiar:

```html
      <a [class.is-active]="state.view() === id && !isInventarioRoute() && !isPortafolioRoute() && !isCotizacionesRoute() && !isProductosRoute() && !isEventosRoute()" (click)="goHome(id)">
```

por:

```html
      <a [class.is-active]="state.view() === id && !isPortafolioRoute() && !isCotizacionesRoute() && !isProductosRoute() && !isEventosRoute()" (click)="goHome(id)">
```

- [ ] **Step 4: Limpiar admin-shell.component.ts**

En `src/app/pages/admin/admin-shell.component.ts`:

**a)** Eliminar la línea del computed:
```typescript
  isInventarioRoute    = computed(() => this.routerUrl().includes('/admin/inventario'));
```

**b)** Eliminar la función `goInventario()`:
```typescript
  goInventario() { this.router.navigate(['/admin/inventario']); }
```

**c)** En el método `goHome()`, eliminar `this.isInventarioRoute()` de la condición. Cambiar:
```typescript
    if (this.isInventarioRoute() || this.isPortafolioRoute() || this.isCotizacionesRoute() || this.isProductosRoute() || this.isEventosRoute()) {
```
por:
```typescript
    if (this.isPortafolioRoute() || this.isCotizacionesRoute() || this.isProductosRoute() || this.isEventosRoute()) {
```

**d)** En el computed `crumbs`, eliminar las 4 líneas que referencian `/inventario`:
```typescript
    if (url.includes('/inventario/ventas'))            return ['Evento', 'Inventario', 'Log de ventas'];
    if (url.includes('/inventario/nuevo'))             return ['Evento', 'Inventario', 'Nuevo producto'];
    if (url.match(/\/inventario\/.+\/editar/))         return ['Evento', 'Inventario', 'Editar producto'];
    if (url.includes('/inventario'))                   return ['Evento', 'Inventario'];
```

- [ ] **Step 5: Verificar que compila**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Esperado: `Application bundle generation complete.` sin errores. Si hay error de TypeScript sobre `isInventarioRoute`, buscar todas las ocurrencias restantes con grep y eliminarlas.

- [ ] **Step 6: Commit**

```bash
git add src/app/app.routes.ts src/app/pages/admin/admin-shell.component.html src/app/pages/admin/admin-shell.component.ts
git commit -m "feat: remove inventario section from admin sidebar and routes"
```

---

## Task 2: Canal con evento específico + total en "Por producto"

**Files:**
- Modify: `src/app/core/services/inventario.service.ts`
- Modify: `src/app/pages/admin/productos/ventas-general.component.ts`
- Modify: `src/app/pages/admin/productos/ventas-general.component.html`
- Modify: `src/app/pages/admin/productos/ventas-general.component.scss`

- [ ] **Step 1: Extender interfaz VentaEvento en inventario.service.ts**

Cambiar la interfaz `VentaEvento`:

```typescript
export interface VentaEvento {
  id: string;
  producto_id: string;
  cantidad: number;
  dispositivo: string | null;
  vendido_en: string;
  sincronizado: boolean;
  canal: 'evento' | 'web';
  productos_evento?: { nombre: string; categoria: string; precio?: number; evento_id?: string | null };
}
```

- [ ] **Step 2: Actualizar query getVentas para incluir evento_id**

En `inventario.service.ts`, método `getVentas()`, cambiar la línea del select:

```typescript
      .select('*, productos_evento(nombre, categoria, precio)')
```

por:

```typescript
      .select('*, productos_evento(nombre, categoria, precio, evento_id)')
```

- [ ] **Step 3: Agregar computed totalProductosVendidos en ventas-general.component.ts**

En `src/app/pages/admin/productos/ventas-general.component.ts`, agregar después de `totalesPorProducto`:

```typescript
  totalProductosVendidos = computed(() =>
    this.totalesPorProducto().reduce((acc, t) => acc + t.total, 0)
  );
```

- [ ] **Step 4: Actualizar la columna Canal en el template HTML**

En `src/app/pages/admin/productos/ventas-general.component.html`, localizar el bloque `<td>` de la columna Canal:

```html
          <td>
            @if (v.canal === 'evento') {
              <span class="badge rio"><span class="pdot"></span>Evento</span>
            } @else {
              <span class="badge ok"><span class="pdot"></span>Web</span>
            }
          </td>
```

Reemplazar por:

```html
          <td>
            @if (v.canal === 'evento') {
              <span class="badge rio"><span class="pdot"></span>{{ v.productos_evento?.evento_id ?? 'Evento' }}</span>
            } @else {
              <span class="badge ok"><span class="pdot"></span>Web</span>
            }
          </td>
```

- [ ] **Step 5: Agregar fila de total al pie del panel "Por producto"**

En `ventas-general.component.html`, localizar el panel "Por producto". Después del bloque `@for (t of totalesPorProducto(); ...)`, antes del `</div>` que cierra `panel-b`, agregar:

```html
      @if (totalesPorProducto().length > 0) {
        <div class="total-row">
          <span>Total</span>
          <strong>{{ totalProductosVendidos() }} ud.</strong>
        </div>
      }
```

- [ ] **Step 6: Agregar estilo .total-row en el SCSS**

En `src/app/pages/admin/productos/ventas-general.component.scss`, agregar al final:

```scss
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0 0;
  margin-top: 4px;
  border-top: 1px solid var(--carbon-12);
  font-size: 13.5px;
  font-weight: 700;

  strong {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.06em;
  }
}
```

- [ ] **Step 7: Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | tail -10
```

Esperado: `Application bundle generation complete.` sin errores TypeScript.

- [ ] **Step 8: Commit**

```bash
git add src/app/core/services/inventario.service.ts src/app/pages/admin/productos/ventas-general.component.ts src/app/pages/admin/productos/ventas-general.component.html src/app/pages/admin/productos/ventas-general.component.scss
git commit -m "feat: show specific event id in canal column, add total row in por-producto panel"
```

---

## Task 3: Drill-down — click en fila abre detalle de venta

**Files:**
- Modify: `src/app/pages/admin/productos/ventas-general.component.ts`
- Modify: `src/app/pages/admin/productos/ventas-general.component.html`

- [ ] **Step 1: Agregar signal ventaSeleccionada y métodos en ventas-general.component.ts**

En `ventas-general.component.ts`, agregar después de la declaración de `errorMsg`:

```typescript
  ventaSeleccionada = signal<VentaEvento | null>(null);

  verDetalle(v: VentaEvento)  { this.ventaSeleccionada.set(v); }
  cerrarDetalle()             { this.ventaSeleccionada.set(null); }
```

- [ ] **Step 2: Agregar click handler en las filas de la tabla**

En `ventas-general.component.html`, localizar cada `<tr>` dentro del `@for (v of ventas(); ...)`. Cambiar:

```html
        <tr>
```

por:

```html
        <tr (click)="verDetalle(v)" style="cursor:pointer">
```

- [ ] **Step 3: Agregar drawer de detalle al final del template**

En `ventas-general.component.html`, al final del archivo (después del `}` que cierra el bloque `@if (!cargando())`), agregar:

```html
<!-- Drawer backdrop -->
<div class="drawer-back" [class.on]="ventaSeleccionada()" (click)="cerrarDetalle()"></div>

<!-- Detalle de venta drawer -->
<div class="drawer" [class.on]="ventaSeleccionada()">
  @if (ventaSeleccionada(); as v) {
    <div class="drawer-h">
      <div>
        <div class="eyebrow"><span class="dot"></span> Detalle de venta</div>
        <h2>{{ v.productos_evento?.nombre ?? v.producto_id }}</h2>
      </div>
      <button class="drawer-close" (click)="cerrarDetalle()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="drawer-b">
      <div class="kv-list">
        <div class="kv"><span class="k">Fecha / Hora</span><span class="v">{{ fmtFecha(v.vendido_en) }}</span></div>
        <div class="kv"><span class="k">Producto</span><span class="v">{{ v.productos_evento?.nombre ?? v.producto_id }}</span></div>
        <div class="kv"><span class="k">Categoría</span><span class="v">{{ v.productos_evento?.categoria ?? '—' }}</span></div>
        <div class="kv"><span class="k">Cantidad</span><span class="v">{{ v.cantidad }}</span></div>
        <div class="kv">
          <span class="k">Canal</span>
          <span class="v">
            @if (v.canal === 'evento') {
              <span class="badge rio"><span class="pdot"></span>{{ v.productos_evento?.evento_id ?? 'Evento' }}</span>
            } @else {
              <span class="badge ok"><span class="pdot"></span>Web</span>
            }
          </span>
        </div>
        @if (v.canal === 'evento') {
          <div class="kv"><span class="k">Dispositivo</span><span class="v">{{ v.dispositivo ?? '—' }}</span></div>
          <div class="kv">
            <span class="k">Sincronizado</span>
            <span class="v">
              @if (v.sincronizado) { <span class="badge ok"><span class="pdot"></span>Sync</span> }
              @else { <span class="badge warn"><span class="pdot"></span>Pendiente</span> }
            </span>
          </div>
        }
        @if (v.productos_evento?.precio) {
          <div class="kv"><span class="k">Precio unitario</span><span class="v">{{ fmtCOP(v.productos_evento!.precio!) }}</span></div>
          <div class="kv"><span class="k">Subtotal</span><span class="v">{{ fmtCOP(v.cantidad * v.productos_evento!.precio!) }}</span></div>
        }
      </div>
    </div>
    <div class="drawer-f">
      <button class="btn-sm ghost" (click)="cerrarDetalle()">Cerrar</button>
    </div>
  }
</div>
```

- [ ] **Step 4: Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | tail -10
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/productos/ventas-general.component.ts src/app/pages/admin/productos/ventas-general.component.html
git commit -m "feat: click on sale row opens detail drawer in ventas-general"
```

---

## Task 4: Gestión de evento activo desde Productos

**Files:**
- Modify: `src/app/pages/admin/productos/productos-list.component.ts`
- Modify: `src/app/pages/admin/productos/productos-list.component.html`

- [ ] **Step 1: Actualizar el TS del ProductosListComponent**

Reemplazar el bloque de imports al inicio de `productos-list.component.ts`:

```typescript
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { Router }       from '@angular/router';
import { InventarioService, ProductoEvento, CATEGORIAS } from '../../../core/services/inventario.service';
import { EventosService, Evento } from '../../../core/services/eventos.service';
```

En la clase `ProductosListComponent`, inyectar `EventosService` y agregar signals. Insertar después de `readonly inv = inject(InventarioService);`:

```typescript
  private eventosSvc = inject(EventosService);
```

Agregar después de `private toastTimer?`:

```typescript
  // Evento activo
  eventoActivo      = signal<Evento | null>(null);

  // Crear evento
  crearEventoOpen   = signal(false);
  nuevoEventoNombre = '';
  creando           = signal(false);
  crearError        = signal<string | null>(null);

  // Finalizar evento
  finalizarOpen     = signal(false);
  finalizando       = signal(false);
  finalizarError    = signal<string | null>(null);
```

Actualizar `ngOnInit` para cargar el evento activo:

```typescript
  ngOnInit() {
    this.inv.cargarTodos();
    this.cargarEventoActivo();
  }

  private async cargarEventoActivo() {
    try {
      const e = await this.eventosSvc.getEventoActivo();
      this.eventoActivo.set(e);
    } catch { /* no-op */ }
  }
```

Agregar métodos para crear y finalizar evento (antes de `fmtCOP`):

```typescript
  abrirCrearEvento()  { this.nuevoEventoNombre = ''; this.crearError.set(null); this.crearEventoOpen.set(true); }
  cerrarCrearEvento() { this.crearEventoOpen.set(false); }

  async crearEvento() {
    const nombre = this.nuevoEventoNombre.trim();
    if (!nombre) { this.crearError.set('El nombre es obligatorio.'); return; }
    this.creando.set(true);
    this.crearError.set(null);
    const { error } = await this.eventosSvc.crearEvento(nombre);
    this.creando.set(false);
    if (error) { this.crearError.set(error); return; }
    this.cerrarCrearEvento();
    await this.cargarEventoActivo();
    this.flash(`Evento "${nombre}" creado.`);
  }

  abrirFinalizarEvento()  { this.finalizarError.set(null); this.finalizarOpen.set(true); }
  cerrarFinalizarEvento() { this.finalizarOpen.set(false); }

  async finalizarEvento() {
    const e = this.eventoActivo();
    if (!e) return;
    this.finalizando.set(true);
    this.finalizarError.set(null);
    const { error } = await this.eventosSvc.finalizarEvento(e.id);
    this.finalizando.set(false);
    if (error) { this.finalizarError.set(error); return; }
    this.cerrarFinalizarEvento();
    this.eventoActivo.set(null);
    this.flash(`Evento "${e.nombre}" finalizado.`);
  }
```

- [ ] **Step 2: Actualizar el HTML de productos-list — botones en ph-r**

En `productos-list.component.html`, localizar el bloque `ph-r`:

```html
  <div class="ph-r">
    <button class="btn-sm ghost" (click)="verVentas()">
      ...
    </button>
    <button class="btn-sm solid" (click)="nuevo()">
      ...
    </button>
  </div>
```

Reemplazar por (agregar botones de evento entre los dos existentes):

```html
  <div class="ph-r">
    <button class="btn-sm ghost" (click)="verVentas()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/></svg>
      Registro de ventas
    </button>
    @if (!eventoActivo()) {
      <button class="btn-sm ghost" (click)="abrirCrearEvento()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg>
        Nuevo evento
      </button>
    }
    @if (eventoActivo()) {
      <span class="badge rio" style="align-self:center"><span class="pdot"></span>{{ eventoActivo()!.nombre }}</span>
      <button class="btn-sm danger" (click)="abrirFinalizarEvento()">Finalizar evento</button>
    }
    <button class="btn-sm solid" (click)="nuevo()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg>
      Nuevo producto
    </button>
  </div>
```

- [ ] **Step 3: Agregar los dos dialogs al final del template HTML**

Al final de `productos-list.component.html`, después del `@if (toast())` block, agregar:

```html
<!-- Dialog: Crear evento -->
@if (crearEventoOpen()) {
  <div class="drawer-back on" (click)="cerrarCrearEvento()"></div>
  <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:202;background:var(--paper);border:1px solid var(--carbon-08);border-radius:var(--r-lg);padding:var(--s-6);width:440px;max-width:90vw;box-shadow:0 20px 60px rgba(21,31,40,0.25)">
    <h3 style="font-family:var(--display);font-size:22px;letter-spacing:-0.01em;margin-bottom:var(--s-2)">Nuevo evento</h3>
    <p style="color:var(--carbon-70);font-size:13.5px;margin-bottom:var(--s-4)">Crea un evento activo. Solo puede haber uno a la vez.</p>
    <div class="field" style="margin-bottom:var(--s-4)">
      <label style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--carbon-70);font-weight:500">Nombre del evento</label>
      <input class="input" [(ngModel)]="nuevoEventoNombre" placeholder="Ej: Sofa 2026" style="margin-top:6px" />
    </div>
    @if (crearError()) {
      <p style="color:var(--terra);font-size:13px;margin-bottom:var(--s-3)">{{ crearError() }}</p>
    }
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn-sm ghost" (click)="cerrarCrearEvento()">Cancelar</button>
      <button class="btn-sm solid" [disabled]="creando()" (click)="crearEvento()">
        {{ creando() ? 'Creando…' : 'Crear evento' }}
      </button>
    </div>
  </div>
}

<!-- Dialog: Finalizar evento -->
@if (finalizarOpen()) {
  <div class="drawer-back on" (click)="cerrarFinalizarEvento()"></div>
  <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:202;background:var(--paper);border:1px solid var(--carbon-08);border-radius:var(--r-lg);padding:var(--s-6);width:460px;max-width:90vw;box-shadow:0 20px 60px rgba(21,31,40,0.25)">
    <h3 style="font-family:var(--display);font-size:22px;letter-spacing:-0.01em;margin-bottom:var(--s-3)">¿Finalizar evento?</h3>
    <p style="color:var(--carbon-70);font-size:13.5px;line-height:1.55;margin-bottom:var(--s-5)">
      Estás a punto de cerrar <strong>{{ eventoActivo()?.nombre }}</strong>. Se registrará la fecha de fin y no se podrá revertir.
    </p>
    @if (finalizarError()) {
      <p style="color:var(--terra);font-size:13px;margin-bottom:var(--s-4)">{{ finalizarError() }}</p>
    }
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn-sm ghost" (click)="cerrarFinalizarEvento()">Cancelar</button>
      <button class="btn-sm danger" [disabled]="finalizando()" (click)="finalizarEvento()">
        {{ finalizando() ? 'Finalizando…' : 'Sí, finalizar' }}
      </button>
    </div>
  </div>
}
```

- [ ] **Step 4: Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | tail -10
```

Esperado: sin errores TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/productos/productos-list.component.ts src/app/pages/admin/productos/productos-list.component.html
git commit -m "feat: add active event management (create/finalize) to productos list header"
```

---

## Task 5: Drawer de pedido manual en Pedidos

**Files:**
- Modify: `src/app/pages/admin/admin-home.component.ts`
- Modify: `src/app/pages/admin/admin-home.component.html`

- [ ] **Step 1: Agregar estado del formulario pedido manual en admin-home.component.ts**

En `admin-home.component.ts`, en la sección `// ── Drawer states`, agregar después de `orderOn`:

```typescript
  manualOrderOn  = signal(false);
```

Agregar una nueva sección de estado del formulario manual. Insertar después del bloque `// ── Toast`:

```typescript
  // ── Pedido manual ──────────────────────────────────────────────────────────
  moClienteNombre   = '';
  moClienteEmail    = '';
  moClienteTel      = '';
  moClienteCiudad   = '';
  moClienteDireccion = '';
  moMetodo          = 'efectivo';
  moCanal           = 'web';
  moNotas           = '';
  moProductSearch   = '';
  moItems           = signal<{ id: string; name: string; price: number; qty: number }[]>([]);

  moProductosFiltrados = computed(() => {
    const q = this.moProductSearch.toLowerCase().trim();
    if (!q) return this.PRODUCTS.slice(0, 6);
    return this.PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 8);
  });

  moSubtotal = computed(() =>
    this.moItems().reduce((acc, i) => acc + i.price * i.qty, 0)
  );

  moTotal = computed(() => this.moSubtotal());
```

Agregar los métodos del pedido manual. Insertar después de `closeOrder()`:

```typescript
  openManualOrder() {
    this.moClienteNombre = '';
    this.moClienteEmail  = '';
    this.moClienteTel    = '';
    this.moClienteCiudad = '';
    this.moClienteDireccion = '';
    this.moMetodo        = 'efectivo';
    this.moCanal         = 'web';
    this.moNotas         = '';
    this.moProductSearch = '';
    this.moItems.set([]);
    this.manualOrderOn.set(true);
  }

  closeManualOrder() { this.manualOrderOn.set(false); }

  moAddProduct(p: Product) {
    this.moItems.update(items => {
      const existing = items.find(i => i.id === p.id);
      if (existing) {
        return items.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...items, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  }

  moRemoveItem(id: string) {
    this.moItems.update(items => items.filter(i => i.id !== id));
  }

  moChangeQty(id: string, delta: number) {
    this.moItems.update(items =>
      items
        .map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    );
  }

  moCrear() {
    if (this.moItems().length === 0 || !this.moClienteNombre.trim()) return;
    this.closeManualOrder();
    this.flash('Pedido manual creado.');
  }
```

- [ ] **Step 2: Corregir el botón "Pedido manual" en el HTML**

En `admin-home.component.html`, dentro del `@case ('pedidos')`, localizar:

```html
            <button class="btn-sm solid"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg> Pedido manual</button>
```

Reemplazar por:

```html
            <button class="btn-sm solid" (click)="openManualOrder()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg> Pedido manual</button>
```

- [ ] **Step 3: Agregar el drawer de pedido manual al final del template HTML**

En `admin-home.component.html`, después del bloque `@if (orderOn())` (el drawer de detalle de orden existente) y antes del `<!-- ══ TOAST ══... -->`, insertar el nuevo drawer:

```html
<!-- ══ MANUAL ORDER DRAWER ══════════════════════════════════════════════════ -->
@if (manualOrderOn()) {
<div class="drawer-back on" (click)="closeManualOrder()"></div>
<div class="drawer on" style="width:min(880px,94vw)">
  <div class="drawer-h">
    <div>
      <div class="crumbs-admin"><span>Pedidos</span><span class="sep">/</span><strong>Pedido manual</strong></div>
      <h2>Crear pedido manual</h2>
    </div>
    <button class="drawer-close" (click)="closeManualOrder()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
  </div>
  <div class="drawer-b">
    <div style="display:grid;grid-template-columns:1fr 280px;gap:var(--s-4);align-items:start">

      <!-- Columna izquierda: productos + resumen -->
      <div style="display:flex;flex-direction:column;gap:var(--s-4)">

        <!-- Buscar y agregar productos -->
        <div class="panel">
          <div class="panel-h"><h3>Línea de productos</h3></div>
          <div class="panel-b" style="display:flex;flex-direction:column;gap:var(--s-3)">
            <div class="search-min">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
              <input placeholder="Buscar producto por nombre o SKU…" [(ngModel)]="moProductSearch" name="moSearch" />
            </div>
            @if (moProductosFiltrados().length > 0) {
              <div style="display:flex;flex-direction:column;gap:4px;max-height:220px;overflow-y:auto">
                @for (p of moProductosFiltrados(); track p.id) {
                  <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:var(--cream-2)">
                    <div class="thumb" [style.background]="tone(p.color).bg" [style.color]="tone(p.color).fg" style="width:30px;height:30px;border-radius:6px;display:grid;place-items:center;font-family:var(--display);font-size:13px;flex-shrink:0">{{ p.name.charAt(0) }}</div>
                    <div style="flex:1;min-width:0">
                      <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ p.name }}</div>
                      <div style="font-family:var(--mono);font-size:10.5px;color:var(--carbon-50)">{{ p.sku }} · {{ fmtCOP(p.price) }}</div>
                    </div>
                    <button class="btn-sm ghost" style="padding:4px 10px;font-size:12px" (click)="moAddProduct(p)">+ Agregar</button>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Tabla de items agregados -->
        @if (moItems().length > 0) {
        <div class="panel">
          <div class="panel-h"><h3>Items del pedido</h3><span class="sub">{{ moItems().length }} productos</span></div>
          <div class="panel-b flush">
            <table class="tbl">
              <thead><tr><th>Producto</th><th class="num">Precio</th><th class="num">Cant.</th><th class="num">Subtotal</th><th></th></tr></thead>
              <tbody>
                @for (item of moItems(); track item.id) {
                <tr>
                  <td><strong style="font-size:13px">{{ item.name }}</strong></td>
                  <td class="num">{{ fmtCOP(item.price) }}</td>
                  <td class="num">
                    <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
                      <button class="icon-act" style="width:22px;height:22px;font-size:14px" (click)="moChangeQty(item.id, -1)">−</button>
                      <span style="font-variant-numeric:tabular-nums;min-width:20px;text-align:center">{{ item.qty }}</span>
                      <button class="icon-act" style="width:22px;height:22px;font-size:14px" (click)="moChangeQty(item.id, 1)">+</button>
                    </div>
                  </td>
                  <td class="num">{{ fmtCOP(item.price * item.qty) }}</td>
                  <td class="actions">
                    <button class="icon-act" title="Quitar" (click)="moRemoveItem(item.id)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
                    </button>
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
          <div style="padding:var(--s-4) var(--s-5);border-top:1px solid var(--carbon-08);background:var(--cream)">
            <div class="kv-list" style="max-width:280px;margin-left:auto">
              <div class="kv"><span class="k">Subtotal</span><span class="v">{{ fmtCOP(moSubtotal()) }}</span></div>
              <div class="kv"><span class="k">Envío</span><span class="v" style="color:var(--carbon-50)">Por definir</span></div>
              <div class="kv total"><span class="k">Total estimado</span><span class="v">{{ fmtCOP(moTotal()) }}</span></div>
            </div>
          </div>
        </div>
        }

      </div>

      <!-- Columna derecha: cliente + pago + notas -->
      <div style="display:flex;flex-direction:column;gap:var(--s-4)">

        <div class="panel">
          <div class="panel-h"><h3>Cliente</h3></div>
          <div class="panel-b" style="display:flex;flex-direction:column;gap:var(--s-3)">
            <div class="field">
              <label>Nombre <span style="color:var(--terra)">*</span></label>
              <input class="input" [(ngModel)]="moClienteNombre" name="moNombre" placeholder="Ej: Mariana Restrepo" />
            </div>
            <div class="field">
              <label>Email</label>
              <input class="input" type="email" [(ngModel)]="moClienteEmail" name="moEmail" placeholder="correo@ejemplo.co" />
            </div>
            <div class="field">
              <label>Teléfono</label>
              <input class="input" [(ngModel)]="moClienteTel" name="moTel" placeholder="+57 311 000 0000" />
            </div>
            <div class="field">
              <label>Ciudad</label>
              <input class="input" [(ngModel)]="moClienteCiudad" name="moCiudad" placeholder="Bogotá" />
            </div>
            <div class="field">
              <label>Dirección</label>
              <input class="input" [(ngModel)]="moClienteDireccion" name="moDireccion" placeholder="Cra 11 # 71-30" />
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-h"><h3>Pago</h3></div>
          <div class="panel-b" style="display:flex;flex-direction:column;gap:var(--s-3)">
            <div class="field">
              <label>Método de pago</label>
              <select class="select" [(ngModel)]="moMetodo" name="moMetodo">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="nequi">Nequi</option>
                <option value="bold">Bold</option>
                <option value="contra-entrega">Contra-entrega</option>
              </select>
            </div>
            <div class="field">
              <label>Canal</label>
              <select class="select" [(ngModel)]="moCanal" name="moCanal">
                <option value="web">Web</option>
                <option value="evento">Evento</option>
              </select>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-h"><h3>Notas</h3></div>
          <div class="panel-b">
            <textarea class="textarea" rows="3" [(ngModel)]="moNotas" name="moNotas" placeholder="Instrucciones especiales, tallas, etc."></textarea>
          </div>
        </div>

      </div>
    </div>
  </div>
  <div class="drawer-f">
    <span style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;color:var(--carbon-50);text-transform:uppercase;align-self:center">
      @if (moItems().length === 0) { Agrega al menos 1 producto }
      @else if (!moClienteNombre.trim()) { Ingresa el nombre del cliente }
      @else { {{ moItems().length }} producto(s) · {{ fmtCOP(moTotal()) }} }
    </span>
    <div style="display:flex;gap:10px">
      <button class="btn-sm ghost" (click)="closeManualOrder()">Cancelar</button>
      <button class="btn-sm solid"
        [disabled]="moItems().length === 0 || !moClienteNombre.trim()"
        (click)="moCrear()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="m5 12 5 5L20 7"/></svg>
        Crear pedido
      </button>
    </div>
  </div>
</div>
}
```

- [ ] **Step 4: Verificar compilación final**

```bash
npx ng build --configuration development 2>&1 | tail -10
```

Esperado: `Application bundle generation complete.` sin errores.

- [ ] **Step 5: Commit final**

```bash
git add src/app/pages/admin/admin-home.component.ts src/app/pages/admin/admin-home.component.html
git commit -m "feat: add manual order drawer to pedidos section"
```

---

## Self-Review del Plan

**Cobertura del spec:**
- ✅ Cambio 1 — Task 1: rutas + sidebar + computed eliminados
- ✅ Cambio 2 — Task 2: `evento_id` en interfaz + query + template canal
- ✅ Cambio 3 — Task 2: `totalProductosVendidos` + `.total-row` en HTML + SCSS
- ✅ Cambio 4 — Task 3: `ventaSeleccionada` + drawer completo con todos los campos del spec
- ✅ Cambio 5 — Task 4: `EventosService` inyectado, signals, métodos crear/finalizar, botones condicionales + dialogs
- ✅ Cambio 6 — Task 5: `manualOrderOn`, form state, `openManualOrder`, `moAddProduct`, `moRemoveItem`, `moChangeQty`, `moCrear`, drawer completo con 2 columnas

**Sin placeholders:** todos los pasos tienen código concreto y comandos exactos.

**Consistencia de tipos:**
- `VentaEvento.productos_evento.evento_id?: string | null` usado en Task 2 y referenciado correctamente en Task 3 drawer
- `Evento` importado de `eventos.service.ts` en Task 4
- `moItems = signal<{id,name,price,qty}[]>` definido en Task 5 Step 1 y usado en todos los métodos del mismo task
- `moProductosFiltrados` usa `this.PRODUCTS` — array existente en `admin-home.component.ts`
