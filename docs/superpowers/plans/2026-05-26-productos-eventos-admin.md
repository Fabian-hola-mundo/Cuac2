# Productos + Eventos Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the static Productos view and the hardcoded Inventario section into a real-data Productos section, and replace Inventario with a dynamic Eventos section featuring event lifecycle management and read-only analytics.

**Architecture:** Eight tasks — DB migrations + global style scope first, then services, then routes/shell, then components. All admin styles live in `src/styles/_admin.scss` as global CSS scoped to component selectors; every new component must be added to that selector list. Components use Angular signals + standalone pattern; data flows through InventarioService and EventosService via SupabaseService.

**Tech Stack:** Angular 18+ (standalone, signals, reactive forms), Supabase via `SupabaseService`, `@angular/router`, TypeScript

---

### Task 1: DB Migrations + Global Style Scope

**Files:**
- Modify: `src/styles/_admin.scss` (add new component selectors)
- DB migrations applied via Supabase MCP

- [ ] **Step 1: Find the Supabase project ID**

Call `mcp__claude_ai_Supabase__list_projects` and identify the project named `cuaquiverso-pos`. Note its `id` — needed for all subsequent migration calls.

- [ ] **Step 2: Create `eventos` table**

Call `mcp__claude_ai_Supabase__apply_migration` with:
```sql
CREATE TABLE IF NOT EXISTS eventos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_fin    timestamptz,
  estado       text NOT NULL DEFAULT 'activo'
);
```

- [ ] **Step 3: Add `personaje` column to `productos_evento`**

Call `mcp__claude_ai_Supabase__apply_migration` with:
```sql
ALTER TABLE productos_evento ADD COLUMN IF NOT EXISTS personaje text;
```

- [ ] **Step 4: Add `canal` column to `ventas_evento`**

Call `mcp__claude_ai_Supabase__apply_migration` with:
```sql
ALTER TABLE ventas_evento ADD COLUMN IF NOT EXISTS canal text DEFAULT 'evento';
```

- [ ] **Step 5: Verify migrations**

Call `mcp__claude_ai_Supabase__execute_sql` with:
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('eventos','productos_evento','ventas_evento')
  AND column_name IN ('id','nombre','estado','personaje','canal')
ORDER BY table_name, column_name;
```
Expected: rows for `eventos.id`, `eventos.nombre`, `eventos.estado`, `productos_evento.personaje`, `ventas_evento.canal`.

- [ ] **Step 6: Add new component selectors to `_admin.scss`**

In `src/styles/_admin.scss`, find the opening selector block (lines 6–12) and replace it:

```scss
app-admin,
app-admin-shell,
app-admin-home,
app-inventario-list,
app-inventario-form,
app-inventario-ventas,
app-cotizaciones-list,
app-productos-list,
app-producto-form,
app-ventas-general,
app-eventos-list,
app-evento-detail {
```

- [ ] **Step 7: Commit**

```bash
git add src/styles/_admin.scss
git commit -m "feat: db migrations for eventos/personaje/canal + admin style scope"
```

---

### Task 2: Service Layer — InventarioService + EventosService

**Files:**
- Modify: `src/app/core/services/inventario.service.ts`
- Create: `src/app/core/services/eventos.service.ts`

- [ ] **Step 1: Update `inventario.service.ts`**

Replace the full file:

```typescript
import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ProductoEvento {
  id: string;
  evento_id: string | null;
  nombre: string;
  categoria: string;
  personaje: string | null;
  precio: number;
  stock_inicial: number;
  stock_actual: number;
  activo: boolean;
  creado_en: string;
}

export interface VentaEvento {
  id: string;
  producto_id: string;
  cantidad: number;
  dispositivo: string | null;
  vendido_en: string;
  sincronizado: boolean;
  canal: 'evento' | 'web';
  productos_evento?: { nombre: string; categoria: string; precio?: number };
}

export const EVENTO_ACTIVO = 'sofa-2026';

export const CATEGORIAS = [
  { id: 'tote',      label: 'Tote bags'  },
  { id: 'llavero',   label: 'Llaveros'   },
  { id: 'gorra',     label: 'Gorras'     },
  { id: 'pañoleta',  label: 'Pañoletas'  },
  { id: 'sticker',   label: 'Stickers'   },
  { id: 'amigurumi', label: 'Amigurumis' },
  { id: 'charm',     label: 'Charms'     },
];

export const CHARACTERS = [
  { id: 'cuac',       label: 'Cuac'       },
  { id: 'yeison',     label: 'Yeison'     },
  { id: 'roar',       label: 'Roar'       },
  { id: 'kiki',       label: 'Kiki'       },
  { id: 'abejandro',  label: 'Abejandro'  },
  { id: 'atolita',    label: 'Atolita'    },
  { id: 'colibriana', label: 'Colibriana' },
  { id: 'tiburcio',   label: 'Tiburcio'   },
];

@Injectable({ providedIn: 'root' })
export class InventarioService {
  readonly productos = signal<ProductoEvento[]>([]);
  readonly cargando  = signal(false);
  readonly error     = signal<string | null>(null);

  constructor(private sb: SupabaseService) {}

  /** Carga TODOS los productos (catálogo global — sin filtrar por evento) */
  async cargarTodos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    const { data, error } = await this.sb.db
      .from('productos_evento')
      .select('*')
      .order('creado_en', { ascending: false });
    this.cargando.set(false);
    if (error) { this.error.set(error.message); return; }
    this.productos.set(data ?? []);
  }

  /** Mantiene compatibilidad con el POS — filtra por evento activo */
  async cargarProductos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    const { data, error } = await this.sb.db
      .from('productos_evento')
      .select('*')
      .eq('evento_id', EVENTO_ACTIVO)
      .order('creado_en', { ascending: false });
    this.cargando.set(false);
    if (error) { this.error.set(error.message); return; }
    this.productos.set(data ?? []);
  }

  async getProducto(id: string): Promise<ProductoEvento | null> {
    const { data, error } = await this.sb.db
      .from('productos_evento')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  async createProducto(
    payload: Omit<ProductoEvento, 'id' | 'creado_en' | 'stock_actual'>
  ): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('productos_evento')
      .insert({ ...payload, stock_actual: payload.stock_inicial });
    if (error) return { error: error.message };
    await this.cargarTodos();
    return { error: null };
  }

  async updateProducto(
    id: string,
    payload: Partial<Omit<ProductoEvento, 'id' | 'creado_en' | 'stock_actual'>>
  ): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('productos_evento')
      .update(payload)
      .eq('id', id);
    if (error) return { error: error.message };
    await this.cargarTodos();
    return { error: null };
  }

  async duplicarProducto(id: string): Promise<{ error: string | null }> {
    const original = await this.getProducto(id);
    if (!original) return { error: 'Producto no encontrado' };
    const { id: _id, creado_en: _ce, stock_actual: _sa, ...rest } = original;
    const { error } = await this.sb.db
      .from('productos_evento')
      .insert({ ...rest, nombre: `${rest.nombre} (copia)`, stock_actual: rest.stock_inicial });
    if (error) return { error: error.message };
    await this.cargarTodos();
    return { error: null };
  }

  async toggleActivo(id: string, activo: boolean): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('productos_evento')
      .update({ activo })
      .eq('id', id);
    if (error) return { error: error.message };
    await this.cargarTodos();
    return { error: null };
  }

  async getVentas(
    desde?: string,
    hasta?: string,
    canal?: 'evento' | 'web'
  ): Promise<VentaEvento[]> {
    let q = this.sb.db
      .from('ventas_evento')
      .select('*, productos_evento(nombre, categoria, precio)')
      .order('vendido_en', { ascending: false });
    if (desde) q = q.gte('vendido_en', `${desde}T00:00:00`);
    if (hasta) q = q.lte('vendido_en', `${hasta}T23:59:59`);
    if (canal) q = q.eq('canal', canal);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async getVentasPorRango(desde: string, hasta: string): Promise<VentaEvento[]> {
    const { data, error } = await this.sb.db
      .from('ventas_evento')
      .select('*, productos_evento(nombre, categoria, precio)')
      .gte('vendido_en', desde)
      .lte('vendido_en', hasta)
      .order('vendido_en', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
}
```

- [ ] **Step 2: Create `eventos.service.ts`**

Create `src/app/core/services/eventos.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { VentaEvento } from './inventario.service';

export interface Evento {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: 'activo' | 'finalizado';
}

@Injectable({ providedIn: 'root' })
export class EventosService {
  constructor(private sb: SupabaseService) {}

  async getEventos(): Promise<Evento[]> {
    const { data, error } = await this.sb.db
      .from('eventos')
      .select('*')
      .order('fecha_inicio', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getEventoActivo(): Promise<Evento | null> {
    const { data, error } = await this.sb.db
      .from('eventos')
      .select('*')
      .eq('estado', 'activo')
      .maybeSingle();
    if (error) return null;
    return data;
  }

  async getEventoById(id: string): Promise<Evento | null> {
    const { data, error } = await this.sb.db
      .from('eventos')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  async crearEvento(nombre: string): Promise<{ error: string | null }> {
    const activo = await this.getEventoActivo();
    if (activo) {
      return { error: `Ya hay un evento activo: "${activo.nombre}". Finalízalo primero.` };
    }
    const { error } = await this.sb.db
      .from('eventos')
      .insert({ nombre, fecha_inicio: new Date().toISOString(), estado: 'activo' });
    if (error) return { error: error.message };
    return { error: null };
  }

  async finalizarEvento(id: string): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('eventos')
      .update({ estado: 'finalizado', fecha_fin: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  }

  async getVentasEvento(evento: Evento): Promise<VentaEvento[]> {
    const fin = evento.fecha_fin ?? new Date().toISOString();
    const { data, error } = await this.sb.db
      .from('ventas_evento')
      .select('*, productos_evento(nombre, categoria, precio)')
      .gte('vendido_en', evento.fecha_inicio)
      .lte('vendido_en', fin)
      .order('vendido_en', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /** Calcula ventas totales por rango de fechas de un evento (para el listado) */
  async getTotalUnidadesEvento(evento: Evento): Promise<number> {
    const ventas = await this.getVentasEvento(evento);
    return ventas.reduce((sum, v) => sum + v.cantidad, 0);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/inventario.service.ts src/app/core/services/eventos.service.ts
git commit -m "feat: update InventarioService and create EventosService"
```

---

### Task 3: Routes + AdminShell

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/pages/admin/admin-shell.component.ts`
- Modify: `src/app/pages/admin/admin-shell.component.html`

- [ ] **Step 1: Update `app.routes.ts`**

Replace the entire `admin` children array with the new routes (keep cotizaciones and portafolio, replace inventario with productos/eventos, keep old inventario for backward compat):

```typescript
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
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin/admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/admin/admin-home.component').then(m => m.AdminHomeComponent),
      },
      // ── Productos (catálogo global) ──────────────────────────────────────────
      {
        path: 'productos',
        loadComponent: () =>
          import('./pages/admin/productos/productos-list.component').then(
            m => m.ProductosListComponent,
          ),
      },
      {
        path: 'productos/ventas',
        loadComponent: () =>
          import('./pages/admin/productos/ventas-general.component').then(
            m => m.VentasGeneralComponent,
          ),
      },
      {
        path: 'productos/nuevo',
        loadComponent: () =>
          import('./pages/admin/productos/producto-form.component').then(
            m => m.ProductoFormComponent,
          ),
      },
      {
        path: 'productos/:id/editar',
        loadComponent: () =>
          import('./pages/admin/productos/producto-form.component').then(
            m => m.ProductoFormComponent,
          ),
      },
      // ── Eventos ─────────────────────────────────────────────────────────────
      {
        path: 'eventos',
        loadComponent: () =>
          import('./pages/admin/eventos/eventos-list.component').then(
            m => m.EventosListComponent,
          ),
      },
      {
        path: 'eventos/:id',
        loadComponent: () =>
          import('./pages/admin/eventos/evento-detail.component').then(
            m => m.EventoDetailComponent,
          ),
      },
      // ── Legacy (mantener para el POS) ────────────────────────────────────────
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
      // ── Otros ────────────────────────────────────────────────────────────────
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

- [ ] **Step 2: Update `admin-shell.component.ts`**

Replace the full file:

```typescript
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal }       from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { SupabaseService }        from '../../core/services/supabase.service';
import { AdminStateService, ViewId } from '../../core/services/admin-state.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent implements OnInit {
  private router = inject(Router);
  readonly sb     = inject(SupabaseService);
  readonly state  = inject(AdminStateService);

  loginEmail    = 'designcuac@gmail.com';
  loginPass     = '';
  loginError    = signal<string | null>(null);
  loginLoading  = signal(false);

  toast         = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  private routerUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  isProductosRoute    = computed(() => this.routerUrl().includes('/admin/productos'));
  isEventosRoute      = computed(() => this.routerUrl().includes('/admin/eventos'));
  isInventarioRoute   = computed(() => this.routerUrl().includes('/admin/inventario'));
  isCotizacionesRoute = computed(() => this.routerUrl().includes('/admin/cotizaciones'));

  crumbs = computed(() => {
    const url = this.routerUrl();
    if (url.includes('/cotizaciones'))                  return ['Diseño', 'Cotizaciones'];
    if (url.includes('/productos/ventas'))              return ['Tienda', 'Productos', 'Registro de ventas'];
    if (url.includes('/productos/nuevo'))               return ['Tienda', 'Productos', 'Nuevo producto'];
    if (url.match(/\/productos\/.+\/editar/))           return ['Tienda', 'Productos', 'Editar producto'];
    if (url.includes('/productos'))                     return ['Tienda', 'Productos'];
    if (url.match(/\/eventos\/.{2,}/))                  return ['Evento', 'Eventos', 'Detalle'];
    if (url.includes('/eventos'))                       return ['Evento', 'Eventos'];
    if (url.includes('/inventario/ventas'))             return ['Evento', 'Inventario', 'Log de ventas'];
    if (url.includes('/inventario/nuevo'))              return ['Evento', 'Inventario', 'Nuevo producto'];
    if (url.match(/\/inventario\/.+\/editar/))          return ['Evento', 'Inventario', 'Editar producto'];
    if (url.includes('/inventario'))                    return ['Evento', 'Inventario'];

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

  readonly NAV_TIENDA   = ['dashboard','productos','pedidos','clientes','pagos'] as ViewId[];
  readonly NAV_UNIVERSO = ['contenido','ajustes'] as ViewId[];
  readonly NAV_META: Record<string, { label: string; count?: number }> = {
    dashboard: { label: 'Dashboard' },
    productos: { label: 'Productos' },
    pedidos:   { label: 'Pedidos',   count: 12 },
    clientes:  { label: 'Clientes'  },
    pagos:     { label: 'Pagos'     },
    contenido: { label: 'Contenido' },
    ajustes:   { label: 'Ajustes'   },
  };

  ngOnInit() {
    this.sb.db.auth.onAuthStateChange(() => {});
    this.sb.signInWithPassword('designcuac@gmail.com', 'Cuac123');
  }

  goHome(id: ViewId) {
    if (id === 'productos') { this.goProductos(); return; }
    this.state.view.set(id);
    if (this.isInventarioRoute() || this.isProductosRoute() || this.isEventosRoute()) {
      this.router.navigate(['/admin']);
    }
  }

  goProductos()    { this.router.navigate(['/admin/productos']); }
  goEventos()      { this.router.navigate(['/admin/eventos']); }
  goInventario()   { this.router.navigate(['/admin/inventario']); }
  goCotizaciones() { this.router.navigate(['/admin/cotizaciones']); }

  async loginGoogle() {
    this.loginLoading.set(true);
    this.loginError.set(null);
    const { error } = await this.sb.signInWithGoogle();
    this.loginLoading.set(false);
    if (error) this.loginError.set('Google no está habilitado aún. Usa contraseña por ahora.');
  }

  async loginPassword() {
    this.loginLoading.set(true);
    this.loginError.set(null);
    const { error } = await this.sb.signInWithPassword(this.loginEmail, this.loginPass);
    this.loginLoading.set(false);
    if (error) this.loginError.set('Credenciales incorrectas. Intenta de nuevo.');
  }

  async logout() { await this.sb.signOut(); }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }

  get userEmail(): string   { return this.sb.session()?.user?.email ?? ''; }
  get userInitial(): string { return (this.sb.session()?.user?.email?.[0] ?? 'C').toUpperCase(); }
}
```

- [ ] **Step 3: Update `admin-shell.component.html` — sidebar Evento section**

Find the `<div class="sb-section">Evento</div>` block and the `<div class="sb-nav">` that follows it. Replace that entire Evento section with:

```html
    <div class="sb-section">Evento</div>
    <div class="sb-nav">
      <a [class.is-active]="isEventosRoute()" (click)="goEventos()">
        <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="12" cy="16" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/></svg>
        <span>Eventos</span>
      </a>
      <a [class.is-active]="isCotizacionesRoute()" (click)="goCotizaciones()">
        <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span>Cotizaciones</span>
      </a>
    </div>
```

- [ ] **Step 4: Compile check**

```bash
npx ng build --configuration development 2>&1 | tail -20
```
Expected: no errors (only warnings about bundle size are fine).

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts src/app/pages/admin/admin-shell.component.ts src/app/pages/admin/admin-shell.component.html
git commit -m "feat: add productos/eventos routes and update admin sidebar"
```

---

### Task 4: ProductosListComponent

**Files:**
- Create: `src/app/pages/admin/productos/productos-list.component.ts`
- Create: `src/app/pages/admin/productos/productos-list.component.html`
- Create: `src/app/pages/admin/productos/productos-list.component.scss`

- [ ] **Step 1: Create `productos-list.component.ts`**

```typescript
import { Component, computed, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { Router }       from '@angular/router';
import { InventarioService, ProductoEvento, CATEGORIAS } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-productos-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productos-list.component.html',
  styleUrl: './productos-list.component.scss',
})
export class ProductosListComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  readonly inv   = inject(InventarioService);
  readonly categorias = CATEGORIAS;

  catFiltro   = signal<string>('all');
  query       = signal('');
  viewProduct = signal<ProductoEvento | null>(null);
  toast       = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  productosFiltrados = computed(() => {
    const cat = this.catFiltro();
    const q   = this.query().toLowerCase();
    return this.inv.productos().filter(p =>
      (cat === 'all' || p.categoria === cat) &&
      (q === '' || p.nombre.toLowerCase().includes(q))
    );
  });

  ngOnInit() { this.inv.cargarTodos(); }

  nuevo()                    { this.router.navigate(['/admin/productos/nuevo']); }
  editar(p: ProductoEvento)  { this.router.navigate(['/admin/productos', p.id, 'editar']); }
  verVentas()                { this.router.navigate(['/admin/productos/ventas']); }

  verDetalle(p: ProductoEvento, e: Event) {
    e.stopPropagation();
    this.viewProduct.set(p);
  }
  cerrarDetalle() { this.viewProduct.set(null); }

  async duplicar(p: ProductoEvento, e: Event) {
    e.stopPropagation();
    const result = await this.inv.duplicarProducto(p.id);
    this.flash(result.error ? `Error: ${result.error}` : `"${p.nombre}" duplicado`);
  }

  async toggleActivo(p: ProductoEvento, e: Event) {
    e.stopPropagation();
    const result = await this.inv.toggleActivo(p.id, !p.activo);
    if (!result.error) this.flash(p.activo ? 'Producto ocultado' : 'Producto visible');
  }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }

  fmtCOP(n: number)          { return '$' + n.toLocaleString('es-CO'); }
  labelCat(id: string)       { return CATEGORIAS.find(c => c.id === id)?.label ?? id; }

  private readonly CAT_TONES: Record<string, string> = {
    tote: '#C9D9F6', llavero: '#FCEFC2', gorra: '#D7EBDD',
    pañoleta: '#FCE0EC', sticker: '#E5DDF7', amigurumi: '#FBE0D5', charm: '#DDE3EA',
  };
  toneForCat(cat: string) { return this.CAT_TONES[cat] ?? '#DDE3EA'; }

  ngOnDestroy() { if (this.toastTimer) clearTimeout(this.toastTimer); }
}
```

- [ ] **Step 2: Create `productos-list.component.html`**

```html
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Catálogo</div>
    <h1>Productos del <em>catálogo</em>.</h1>
    <p class="sub">{{ inv.productos().length }} productos en total. Stock en tiempo real.</p>
  </div>
  <div class="ph-r">
    <button class="btn-sm ghost" (click)="verVentas()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/></svg>
      Registro de ventas
    </button>
    <button class="btn-sm solid" (click)="nuevo()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      Nuevo producto
    </button>
  </div>
</div>

<div class="tlb">
  <div class="chips">
    <button class="chip" [class.is-on]="catFiltro() === 'all'" (click)="catFiltro.set('all')">Todas</button>
    @for (c of categorias; track c.id) {
      <button class="chip" [class.is-on]="catFiltro() === c.id" (click)="catFiltro.set(c.id)">{{ c.label }}</button>
    }
  </div>
  <div class="spacer"></div>
  <div class="search-min">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
    <input placeholder="Buscar producto…" [value]="query()" (input)="query.set($any($event.target).value)" />
  </div>
</div>

@if (inv.cargando()) {
  <p style="color:var(--carbon-50);font-size:14px;padding:12px 0">Cargando productos…</p>
}
@if (inv.error()) {
  <p style="color:var(--terra);font-size:14px;padding:12px 0">{{ inv.error() }}</p>
}

@if (!inv.cargando() && productosFiltrados().length > 0) {
<div class="panel">
  <table class="tbl">
    <thead>
      <tr>
        <th>Producto</th>
        <th>Categoría</th>
        <th class="num">Precio</th>
        <th class="num">Ini.</th>
        <th class="num">Stock</th>
        <th>Estado</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      @for (p of productosFiltrados(); track p.id) {
      <tr (click)="editar(p)">
        <td>
          <div class="pname">
            <div class="thumb" [style.background]="toneForCat(p.categoria)">{{ p.nombre[0] }}</div>
            <div class="meta">
              <strong>{{ p.nombre }}</strong>
              <span>{{ labelCat(p.categoria) }}{{ p.personaje ? ' · ' + p.personaje : '' }}</span>
            </div>
          </div>
        </td>
        <td class="id">{{ p.categoria }}</td>
        <td class="num">{{ fmtCOP(p.precio) }}</td>
        <td class="num id">{{ p.stock_inicial }}</td>
        <td class="num">
          @if (p.stock_actual === 0) {
            <span class="badge err"><span class="pdot"></span>Agotado</span>
          } @else if (p.stock_actual < 3) {
            <span class="badge warn"><span class="pdot"></span>{{ p.stock_actual }}</span>
          } @else {
            {{ p.stock_actual }}
          }
        </td>
        <td>
          @if (p.activo) { <span class="badge ok"><span class="pdot"></span>Activo</span> }
          @else { <span class="badge"><span class="pdot"></span>Oculto</span> }
        </td>
        <td class="row-actions-cell" (click)="$event.stopPropagation()">
          <div class="row-acts">
            <button class="icon-act" title="Ver detalle" (click)="verDetalle(p, $event)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="icon-act" title="Editar" (click)="editar(p)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
            <button class="icon-act" title="Duplicar" (click)="duplicar(p, $event)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="icon-act" [title]="p.activo ? 'Ocultar' : 'Mostrar'" (click)="toggleActivo(p, $event)">
              @if (p.activo) {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              } @else {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              }
            </button>
          </div>
        </td>
      </tr>
      }
    </tbody>
  </table>
</div>
}

@if (!inv.cargando() && productosFiltrados().length === 0 && !inv.error()) {
<div class="panel" style="padding:64px 32px;text-align:center">
  <p style="font-family:var(--display);font-size:22px;letter-spacing:-0.01em;margin-bottom:8px">Sin productos aún.</p>
  <p style="color:var(--carbon-50);font-size:14px;margin-bottom:24px">Crea el primer producto del catálogo.</p>
  <button class="btn-sm solid" (click)="nuevo()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg>
    Nuevo producto
  </button>
</div>
}

<!-- View drawer -->
<div class="drawer-back" [class.on]="!!viewProduct()" (click)="cerrarDetalle()"></div>
<div class="drawer" [class.on]="!!viewProduct()">
  @if (viewProduct(); as p) {
  <div class="drawer-h">
    <div>
      <div class="crumbs-admin" style="margin-bottom:4px">
        <span>Productos</span><span class="sep">/</span><strong>{{ p.nombre }}</strong>
      </div>
      <h2>{{ p.nombre }}</h2>
    </div>
    <button class="drawer-close" (click)="cerrarDetalle()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
  </div>
  <div class="drawer-b">
    <div class="kv-list">
      <div class="kv"><span class="k">Categoría</span><span class="v">{{ labelCat(p.categoria) }}</span></div>
      <div class="kv"><span class="k">Personaje</span><span class="v">{{ p.personaje ?? '—' }}</span></div>
      <div class="kv"><span class="k">Precio</span><span class="v">{{ fmtCOP(p.precio) }}</span></div>
      <div class="kv"><span class="k">Stock inicial</span><span class="v">{{ p.stock_inicial }}</span></div>
      <div class="kv"><span class="k">Stock actual</span><span class="v">{{ p.stock_actual }}</span></div>
      <div class="kv">
        <span class="k">Estado</span>
        <span class="v">
          @if (p.activo) { <span class="badge ok"><span class="pdot"></span>Activo</span> }
          @else { <span class="badge"><span class="pdot"></span>Oculto</span> }
        </span>
      </div>
      <div class="kv"><span class="k">Creado</span><span class="v id">{{ p.creado_en | date:'dd/MM/yyyy' }}</span></div>
    </div>
  </div>
  <div class="drawer-f">
    <button class="btn-sm solid" (click)="editar(p)">Editar producto</button>
    <button class="btn-sm ghost" (click)="duplicar(p, $event)">Duplicar</button>
  </div>
  }
</div>

@if (toast()) {
  <div class="toast-global">{{ toast() }}</div>
}
```

- [ ] **Step 3: Create `productos-list.component.scss`**

```scss
:host { display: block; }

.row-acts {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity .12s;
}

.tbl tbody tr:hover .row-acts { opacity: 1; }

.row-actions-cell { width: 1%; white-space: nowrap; padding-right: 12px !important; }
```

- [ ] **Step 4: Verify in browser**

Run `ng serve`, navigate to `/admin/productos`. The product list should load, category chips should filter, action icons should appear on row hover, "Ver detalle" should open the drawer, "Duplicar" should create a copy and show toast, clicking the eye icon should toggle visibility.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/productos/
git commit -m "feat: add ProductosListComponent with view/edit/duplicate/hide actions"
```

---

### Task 5: ProductoFormComponent

**Files:**
- Create: `src/app/pages/admin/productos/producto-form.component.ts`
- Create: `src/app/pages/admin/productos/producto-form.component.html`
- Create: `src/app/pages/admin/productos/producto-form.component.scss`

- [ ] **Step 1: Create `producto-form.component.ts`**

```typescript
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule }    from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute }  from '@angular/router';
import { InventarioService, CATEGORIAS, CHARACTERS } from '../../../core/services/inventario.service';
import { EventosService } from '../../../core/services/eventos.service';

@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './producto-form.component.html',
  styleUrl: './producto-form.component.scss',
})
export class ProductoFormComponent implements OnInit {
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private fb     = inject(FormBuilder);
  private inv    = inject(InventarioService);
  private eventos = inject(EventosService);

  readonly categorias  = CATEGORIAS;
  readonly characters  = CHARACTERS;
  readonly editId      = signal<string | null>(null);
  readonly guardando   = signal(false);
  readonly errorMsg    = signal<string | null>(null);
  readonly isEdit      = computed(() => this.editId() !== null);

  private eventoActivoId: string | null = null;

  form = this.fb.group({
    nombre:        ['', [Validators.required, Validators.minLength(2)]],
    categoria:     ['tote', Validators.required],
    personaje:     [null as string | null],
    precio:        [null as number | null, [Validators.required, Validators.min(1)]],
    stock_inicial: [0, [Validators.required, Validators.min(0)]],
    activo:        [true],
  });

  async ngOnInit() {
    const eventoActivo = await this.eventos.getEventoActivo();
    this.eventoActivoId = eventoActivo?.id ?? null;

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      const p = await this.inv.getProducto(id);
      if (p) {
        this.form.patchValue({
          nombre:        p.nombre,
          categoria:     p.categoria,
          personaje:     p.personaje ?? null,
          precio:        p.precio,
          stock_inicial: p.stock_inicial,
          activo:        p.activo,
        });
        this.form.get('stock_inicial')?.disable();
      }
    }
  }

  async guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set(null);

    const v = this.form.getRawValue();
    const payload = {
      evento_id:     this.eventoActivoId,
      nombre:        v.nombre!,
      categoria:     v.categoria!,
      personaje:     v.personaje ?? null,
      precio:        v.precio!,
      stock_inicial: v.stock_inicial!,
      activo:        v.activo ?? true,
    };

    const result = this.isEdit()
      ? await this.inv.updateProducto(this.editId()!, payload)
      : await this.inv.createProducto(payload);

    this.guardando.set(false);
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.router.navigate(['/admin/productos']);
  }

  cancelar() { this.router.navigate(['/admin/productos']); }

  hasError(field: string) {
    const c = this.form.get(field);
    return c?.invalid && c?.touched;
  }
}
```

- [ ] **Step 2: Create `producto-form.component.html`**

```html
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Catálogo</div>
    <h1>{{ isEdit() ? 'Editar' : 'Nuevo' }} <em>producto</em>.</h1>
  </div>
  <div class="ph-r">
    <button class="btn-sm ghost" (click)="cancelar()">← Productos</button>
  </div>
</div>

<div class="grid-form-cols">
  <div class="panel">
    <div class="panel-h">
      <h3>{{ isEdit() ? 'Datos del producto' : 'Crear producto' }}</h3>
    </div>
    <div class="panel-b">
      <form [formGroup]="form" (ngSubmit)="guardar()">

        <div class="field">
          <label>Nombre <span class="opt">*</span></label>
          <input class="input" formControlName="nombre" placeholder="Tote bag sofa-2026" />
          @if (hasError('nombre')) {
            <span class="help" style="color:var(--terra)">Nombre requerido (mínimo 2 caracteres)</span>
          }
        </div>

        <div class="grid-2">
          <div class="field">
            <label>Categoría <span class="opt">*</span></label>
            <select class="input select" formControlName="categoria">
              @for (c of categorias; track c.id) {
                <option [value]="c.id">{{ c.label }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Personaje</label>
            <select class="input select" formControlName="personaje">
              <option [value]="null">Sin personaje</option>
              @for (ch of characters; track ch.id) {
                <option [value]="ch.id">{{ ch.label }}</option>
              }
            </select>
          </div>
        </div>

        <div class="field">
          <label>Precio COP <span class="opt">*</span></label>
          <input class="input" type="number" formControlName="precio" placeholder="28000" min="1" />
          @if (hasError('precio')) {
            <span class="help" style="color:var(--terra)">Debe ser mayor a 0</span>
          }
        </div>

        <div class="field">
          <label>Stock inicial <span class="opt">*</span></label>
          <input class="input" type="number" formControlName="stock_inicial" placeholder="0" min="0" />
          @if (!isEdit()) {
            <span class="help">El stock actual se igualará a este valor al crear el producto</span>
          }
          @if (isEdit()) {
            <span class="help">El stock actual lo gestiona el POS — no se edita desde aquí</span>
          }
          @if (hasError('stock_inicial')) {
            <span class="help" style="color:var(--terra)">El stock no puede ser negativo</span>
          }
        </div>

        <div class="toggle-row">
          <span class="toggle-label">Activo en el POS</span>
          <label class="toggle-wrap">
            <input type="checkbox" formControlName="activo" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        @if (errorMsg()) {
          <p style="font-size:13px;color:var(--terra);margin:var(--s-4) 0">{{ errorMsg() }}</p>
        }

        <div style="display:flex;gap:10px;margin-top:var(--s-5)">
          <button class="btn-sm solid" type="submit" [disabled]="guardando()">
            {{ guardando() ? 'Guardando…' : (isEdit() ? 'Actualizar' : 'Crear producto') }}
          </button>
          <button class="btn-sm ghost" type="button" (click)="cancelar()">Cancelar</button>
        </div>

      </form>
    </div>
  </div>

  <div class="panel" style="align-self:start">
    <div class="panel-h"><h3>Categorías</h3></div>
    <div class="panel-b">
      @for (c of categorias; track c.id) {
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--carbon-08)">
        <span style="font-size:13.5px">{{ c.label }}</span>
        <span class="id">{{ c.id }}</span>
      </div>
      }
    </div>
  </div>
</div>
```

- [ ] **Step 3: Create `producto-form.component.scss`**

```scss
:host { display: block; }

.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: var(--cream);
  border: 1px solid var(--carbon-12);
  border-radius: 10px;
  margin-top: var(--s-4);
}

.toggle-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--carbon);
}

.toggle-wrap {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;

  input { opacity: 0; width: 0; height: 0; position: absolute; }
}

.toggle-slider {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: var(--carbon-12);
  cursor: pointer;
  transition: background .2s;

  &::before {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    left: 3px;
    top: 3px;
    transition: transform .2s;
    box-shadow: 0 1px 3px rgba(21,31,40,0.2);
  }
}

.toggle-wrap input:checked + .toggle-slider { background: var(--selva); }
.toggle-wrap input:checked + .toggle-slider::before { transform: translateX(20px); }
```

- [ ] **Step 4: Verify in browser**

Navigate to `/admin/productos/nuevo`. Fill in nombre, categoría, precio (ej. 28000), stock inicial (ej. 50). Submit. Should redirect to `/admin/productos` and the new product should appear in the list. Then click "editar" on the product — form should populate with its values and stock_inicial should be disabled.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/productos/producto-form.component.*
git commit -m "feat: add ProductoFormComponent with personaje field and toggle"
```

---

### Task 6: VentasGeneralComponent

**Files:**
- Create: `src/app/pages/admin/productos/ventas-general.component.ts`
- Create: `src/app/pages/admin/productos/ventas-general.component.html`
- Create: `src/app/pages/admin/productos/ventas-general.component.scss`

- [ ] **Step 1: Create `ventas-general.component.ts`**

```typescript
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { Router }       from '@angular/router';
import { InventarioService, VentaEvento } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-ventas-general',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas-general.component.html',
  styleUrl: './ventas-general.component.scss',
})
export class VentasGeneralComponent implements OnInit {
  private router = inject(Router);
  private inv    = inject(InventarioService);

  readonly ventas    = signal<VentaEvento[]>([]);
  readonly cargando  = signal(false);
  readonly errorMsg  = signal<string | null>(null);

  desde = '';
  hasta = '';
  canal: '' | 'evento' | 'web' = '';

  totalUnidades = computed(() =>
    this.ventas().reduce((acc, v) => acc + v.cantidad, 0)
  );

  totalCOP = computed(() =>
    this.ventas().reduce((acc, v) => acc + v.cantidad * (v.productos_evento?.precio ?? 0), 0)
  );

  totalesPorProducto = computed(() => {
    const map = new Map<string, { nombre: string; total: number; monto: number }>();
    for (const v of this.ventas()) {
      const nombre = v.productos_evento?.nombre ?? v.producto_id;
      const precio = v.productos_evento?.precio ?? 0;
      const prev   = map.get(nombre) ?? { nombre, total: 0, monto: 0 };
      map.set(nombre, { nombre, total: prev.total + v.cantidad, monto: prev.monto + v.cantidad * precio });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  });

  ngOnInit() { this.cargar(); }

  async cargar() {
    this.cargando.set(true);
    this.errorMsg.set(null);
    try {
      const data = await this.inv.getVentas(
        this.desde || undefined,
        this.hasta  || undefined,
        this.canal  || undefined
      );
      this.ventas.set(data);
    } catch (e: any) {
      this.errorMsg.set(e.message);
    }
    this.cargando.set(false);
  }

  volver() { this.router.navigate(['/admin/productos']); }

  fmtFecha(iso: string) {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  fmtCOP(n: number) { return '$' + n.toLocaleString('es-CO'); }
}
```

- [ ] **Step 2: Create `ventas-general.component.html`**

```html
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Catálogo</div>
    <h1>Registro de <em>ventas</em>.</h1>
    <p class="sub">{{ ventas().length }} registros · todos los canales.</p>
  </div>
  <div class="ph-r">
    <button class="btn-sm ghost" (click)="volver()">← Productos</button>
  </div>
</div>

<div class="tlb" style="margin-bottom:var(--s-5)">
  <div class="inv-date-field">
    <label>Desde</label>
    <input class="input" type="date" [(ngModel)]="desde" style="width:160px" />
  </div>
  <div class="inv-date-field">
    <label>Hasta</label>
    <input class="input" type="date" [(ngModel)]="hasta" style="width:160px" />
  </div>
  <div class="inv-date-field">
    <label>Canal</label>
    <select class="input select" [(ngModel)]="canal" style="width:140px">
      <option value="">Todos</option>
      <option value="evento">Eventos</option>
      <option value="web">Tienda web</option>
    </select>
  </div>
  <button class="btn-sm solid" (click)="cargar()">Filtrar</button>
  <div class="spacer"></div>
  @if (ventas().length > 0) {
    <span class="badge ok" style="margin-right:8px"><span class="pdot"></span>{{ totalUnidades() }} unidades</span>
    <span class="badge rio"><span class="pdot"></span>{{ fmtCOP(totalCOP()) }}</span>
  }
</div>

@if (cargando()) { <p style="color:var(--carbon-50);font-size:14px;padding:12px 0">Cargando ventas…</p> }
@if (errorMsg()) { <p style="color:var(--terra);font-size:14px;padding:12px 0">{{ errorMsg() }}</p> }

@if (!cargando()) {
<div style="display:grid;grid-template-columns:2fr 1fr;gap:var(--s-4);align-items:start">

  <div class="panel">
    <div class="panel-h">
      <h3>Detalle de ventas</h3>
      <span class="sub">{{ ventas().length }} registros</span>
    </div>
    @if (ventas().length === 0) {
      <div style="padding:48px 32px;text-align:center">
        <p style="font-family:var(--display);font-size:20px;letter-spacing:-0.01em;margin-bottom:6px">Sin ventas en este período.</p>
        <p style="color:var(--carbon-50);font-size:14px">Ajusta los filtros o regresa cuando haya actividad.</p>
      </div>
    }
    @if (ventas().length > 0) {
    <table class="tbl">
      <thead>
        <tr>
          <th>Fecha / Hora</th>
          <th>Producto</th>
          <th class="num">Cant.</th>
          <th>Canal</th>
          <th>Dispositivo</th>
          <th>Sync</th>
        </tr>
      </thead>
      <tbody>
        @for (v of ventas(); track v.id) {
        <tr>
          <td class="id" style="white-space:nowrap">{{ fmtFecha(v.vendido_en) }}</td>
          <td><strong>{{ v.productos_evento?.nombre ?? '—' }}</strong></td>
          <td class="num">{{ v.cantidad }}</td>
          <td>
            @if (v.canal === 'web') {
              <span class="badge ok"><span class="pdot"></span>Web</span>
            } @else {
              <span class="badge rio"><span class="pdot"></span>Evento</span>
            }
          </td>
          <td class="id">{{ v.dispositivo ?? '—' }}</td>
          <td>
            @if (v.sincronizado) { <span class="badge ok"><span class="pdot"></span>Sync</span> }
            @else { <span class="badge warn"><span class="pdot"></span>Pendiente</span> }
          </td>
        </tr>
        }
      </tbody>
    </table>
    }
  </div>

  <div class="panel" style="position:sticky;top:80px">
    <div class="panel-h"><h3>Por producto</h3></div>
    <div class="panel-b">
      @if (totalesPorProducto().length === 0) {
        <p style="color:var(--carbon-50);font-size:14px">Sin datos en el período.</p>
      }
      @for (t of totalesPorProducto(); track t.nombre) {
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--carbon-08)">
        <span style="font-size:13.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:12px">{{ t.nombre }}</span>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0">
          <strong style="font-family:var(--mono);font-size:12px;letter-spacing:0.06em">{{ t.total }} ud.</strong>
          @if (t.monto > 0) {
            <span style="font-family:var(--mono);font-size:10px;color:var(--carbon-50);letter-spacing:0.04em">{{ fmtCOP(t.monto) }}</span>
          }
        </div>
      </div>
      }
    </div>
  </div>

</div>
}
```

- [ ] **Step 3: Create `ventas-general.component.scss`**

```scss
:host { display: block; }

.inv-date-field {
  display: flex;
  flex-direction: column;
  gap: 3px;

  label {
    font-family: var(--mono);
    font-size: 9.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--carbon-50);
    font-weight: 500;
  }
}
```

- [ ] **Step 4: Verify in browser**

Navigate to `/admin/productos`, click "Registro de ventas". Page should load with the date/canal filters. Hit Filtrar — should show all ventas. Filter by canal "Eventos" — should show only event sales.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/productos/ventas-general.component.*
git commit -m "feat: add VentasGeneralComponent with canal filter and COP totals"
```

---

### Task 7: EventosListComponent

**Files:**
- Create: `src/app/pages/admin/eventos/eventos-list.component.ts`
- Create: `src/app/pages/admin/eventos/eventos-list.component.html`
- Create: `src/app/pages/admin/eventos/eventos-list.component.scss`

- [ ] **Step 1: Create `eventos-list.component.ts`**

```typescript
import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { Router }       from '@angular/router';
import { EventosService, Evento } from '../../../core/services/eventos.service';

@Component({
  selector: 'app-eventos-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './eventos-list.component.html',
  styleUrl: './eventos-list.component.scss',
})
export class EventosListComponent implements OnInit, OnDestroy {
  private router  = inject(Router);
  private svc     = inject(EventosService);

  readonly eventos   = signal<Evento[]>([]);
  readonly cargando  = signal(false);
  readonly errorMsg  = signal<string | null>(null);

  drawerOn       = signal(false);
  nuevoNombre    = '';
  guardando      = signal(false);
  drawerError    = signal<string | null>(null);

  toast          = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  ngOnInit() { this.cargar(); }

  async cargar() {
    this.cargando.set(true);
    this.errorMsg.set(null);
    try {
      this.eventos.set(await this.svc.getEventos());
    } catch (e: any) {
      this.errorMsg.set(e.message);
    }
    this.cargando.set(false);
  }

  abrirDrawer() {
    this.nuevoNombre = '';
    this.drawerError.set(null);
    this.drawerOn.set(true);
  }
  cerrarDrawer() { this.drawerOn.set(false); }

  async crearEvento() {
    if (!this.nuevoNombre.trim()) { this.drawerError.set('El nombre es obligatorio.'); return; }
    this.guardando.set(true);
    this.drawerError.set(null);
    const result = await this.svc.crearEvento(this.nuevoNombre.trim());
    this.guardando.set(false);
    if (result.error) { this.drawerError.set(result.error); return; }
    this.cerrarDrawer();
    await this.cargar();
    this.flash('Evento creado');
  }

  verEvento(e: Evento) { this.router.navigate(['/admin/eventos', e.id]); }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }

  fmtFecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  diasEvento(e: Evento): number {
    const desde = new Date(e.fecha_inicio).getTime();
    const hasta = e.fecha_fin ? new Date(e.fecha_fin).getTime() : Date.now();
    return Math.max(1, Math.ceil((hasta - desde) / 86400000));
  }

  ngOnDestroy() { if (this.toastTimer) clearTimeout(this.toastTimer); }
}
```

- [ ] **Step 2: Create `eventos-list.component.html`**

```html
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Evento</div>
    <h1>Eventos <em>realizados</em>.</h1>
    <p class="sub">{{ eventos().length }} eventos registrados. Haz clic para ver las métricas.</p>
  </div>
  <div class="ph-r">
    <button class="btn-sm solid" (click)="abrirDrawer()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg>
      Nuevo evento
    </button>
  </div>
</div>

@if (cargando()) { <p style="color:var(--carbon-50);font-size:14px;padding:12px 0">Cargando eventos…</p> }
@if (errorMsg()) { <p style="color:var(--terra);font-size:14px;padding:12px 0">{{ errorMsg() }}</p> }

@if (!cargando() && eventos().length > 0) {
<div class="panel">
  <table class="tbl">
    <thead>
      <tr>
        <th>Evento</th>
        <th>Estado</th>
        <th>Inicio</th>
        <th>Fin</th>
        <th class="num">Días</th>
      </tr>
    </thead>
    <tbody>
      @for (e of eventos(); track e.id) {
      <tr (click)="verEvento(e)">
        <td>
          <strong style="font-size:14px">{{ e.nombre }}</strong>
        </td>
        <td>
          @if (e.estado === 'activo') {
            <span class="badge ok"><span class="pdot"></span>En curso</span>
          } @else {
            <span class="badge"><span class="pdot"></span>Finalizado</span>
          }
        </td>
        <td class="id">{{ fmtFecha(e.fecha_inicio) }}</td>
        <td class="id">{{ e.fecha_fin ? fmtFecha(e.fecha_fin) : '—' }}</td>
        <td class="num id">{{ diasEvento(e) }}</td>
      </tr>
      }
    </tbody>
  </table>
</div>
}

@if (!cargando() && eventos().length === 0 && !errorMsg()) {
<div class="panel" style="padding:64px 32px;text-align:center">
  <p style="font-family:var(--display);font-size:22px;letter-spacing:-0.01em;margin-bottom:8px">Sin eventos aún.</p>
  <p style="color:var(--carbon-50);font-size:14px;margin-bottom:24px">Crea el primer evento para empezar a registrar ventas.</p>
  <button class="btn-sm solid" (click)="abrirDrawer()">+ Nuevo evento</button>
</div>
}

<!-- Nuevo evento drawer -->
<div class="drawer-back" [class.on]="drawerOn()" (click)="cerrarDrawer()"></div>
<div class="drawer drawer-sm" [class.on]="drawerOn()">
  <div class="drawer-h">
    <h2>Nuevo <em>evento</em>.</h2>
    <button class="drawer-close" (click)="cerrarDrawer()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
  </div>
  <div class="drawer-b">
    <p style="color:var(--carbon-70);font-size:14px;margin-bottom:var(--s-5)">
      El evento inicia en este momento. Las ventas registradas en el POS desde ahora hasta que lo finalices quedarán agrupadas aquí.
    </p>
    <div class="field">
      <label>Nombre del evento <span class="opt">*</span></label>
      <input class="input" [(ngModel)]="nuevoNombre" placeholder="ej. sofa-2026, Mercado Mayo" (keyup.enter)="crearEvento()" />
    </div>
    @if (drawerError()) {
      <p style="font-size:13px;color:var(--terra);margin-top:var(--s-3)">{{ drawerError() }}</p>
    }
  </div>
  <div class="drawer-f">
    <button class="btn-sm solid" (click)="crearEvento()" [disabled]="guardando()">
      {{ guardando() ? 'Creando…' : 'Iniciar evento' }}
    </button>
    <button class="btn-sm ghost" (click)="cerrarDrawer()">Cancelar</button>
  </div>
</div>

@if (toast()) {
  <div class="toast-global">{{ toast() }}</div>
}
```

- [ ] **Step 3: Create `eventos-list.component.scss`**

```scss
:host { display: block; }

.drawer-sm {
  width: 460px;
}
```

- [ ] **Step 4: Verify in browser**

Navigate to `/admin/eventos`. Click "+ Nuevo evento" — the drawer should slide in from the right. Enter a name and click "Iniciar evento". Should close drawer and show the new event in the table with "En curso" badge. Clicking the row should navigate to `/admin/eventos/:id` (the detail page from the next task).

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/eventos/eventos-list.component.*
git commit -m "feat: add EventosListComponent with nuevo evento drawer"
```

---

### Task 8: EventoDetailComponent

**Files:**
- Create: `src/app/pages/admin/eventos/evento-detail.component.ts`
- Create: `src/app/pages/admin/eventos/evento-detail.component.html`
- Create: `src/app/pages/admin/eventos/evento-detail.component.scss`

- [ ] **Step 1: Create `evento-detail.component.ts`**

```typescript
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { EventosService, Evento } from '../../../core/services/eventos.service';
import { VentaEvento } from '../../../core/services/inventario.service';

interface VentaDia { fecha: string; unidades: number; monto: number; }
interface TopProducto { nombre: string; unidades: number; monto: number; }

@Component({
  selector: 'app-evento-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './evento-detail.component.html',
  styleUrl: './evento-detail.component.scss',
})
export class EventoDetailComponent implements OnInit {
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private svc    = inject(EventosService);

  readonly evento      = signal<Evento | null>(null);
  readonly ventas      = signal<VentaEvento[]>([]);
  readonly cargando    = signal(false);
  readonly errorMsg    = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly finalizando = signal(false);

  toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  totalUnidades = computed(() =>
    this.ventas().reduce((sum, v) => sum + v.cantidad, 0)
  );

  totalCOP = computed(() =>
    this.ventas().reduce((sum, v) => sum + v.cantidad * (v.productos_evento?.precio ?? 0), 0)
  );

  productosDistintos = computed(() =>
    new Set(this.ventas().map(v => v.producto_id)).size
  );

  diasEvento = computed(() => {
    const e = this.evento();
    if (!e) return 0;
    const desde = new Date(e.fecha_inicio).getTime();
    const hasta = e.fecha_fin ? new Date(e.fecha_fin).getTime() : Date.now();
    return Math.max(1, Math.ceil((hasta - desde) / 86400000));
  });

  topProductos = computed((): TopProducto[] => {
    const map = new Map<string, TopProducto>();
    for (const v of this.ventas()) {
      const nombre = v.productos_evento?.nombre ?? v.producto_id;
      const precio = v.productos_evento?.precio ?? 0;
      const prev   = map.get(nombre) ?? { nombre, unidades: 0, monto: 0 };
      map.set(nombre, { nombre, unidades: prev.unidades + v.cantidad, monto: prev.monto + v.cantidad * precio });
    }
    return Array.from(map.values()).sort((a, b) => b.unidades - a.unidades);
  });

  ventasPorDia = computed((): VentaDia[] => {
    const map = new Map<string, VentaDia>();
    for (const v of this.ventas()) {
      const fecha = v.vendido_en.slice(0, 10);
      const precio = v.productos_evento?.precio ?? 0;
      const prev   = map.get(fecha) ?? { fecha, unidades: 0, monto: 0 };
      map.set(fecha, { fecha, unidades: prev.unidades + v.cantidad, monto: prev.monto + v.cantidad * precio });
    }
    return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.cargando.set(true);
    this.errorMsg.set(null);
    try {
      const e = await this.svc.getEventoById(id);
      if (!e) { this.errorMsg.set('Evento no encontrado.'); this.cargando.set(false); return; }
      this.evento.set(e);
      this.ventas.set(await this.svc.getVentasEvento(e));
    } catch (err: any) {
      this.errorMsg.set(err.message);
    }
    this.cargando.set(false);
  }

  async finalizar() {
    const e = this.evento();
    if (!e) return;
    this.finalizando.set(true);
    const result = await this.svc.finalizarEvento(e.id);
    this.finalizando.set(false);
    if (result.error) { this.flash('Error: ' + result.error); return; }
    this.confirmando.set(false);
    const updated = await this.svc.getEventoById(e.id);
    if (updated) this.evento.set(updated);
    this.flash('Evento finalizado');
  }

  volver() { this.router.navigate(['/admin/eventos']); }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }

  fmtFecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  fmtFechaDia(iso: string) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  fmtCOP(n: number) { return '$' + n.toLocaleString('es-CO'); }
}
```

- [ ] **Step 2: Create `evento-detail.component.html`**

```html
@if (cargando()) {
  <p style="color:var(--carbon-50);font-size:14px;padding:24px 0">Cargando evento…</p>
}
@if (errorMsg()) {
  <p style="color:var(--terra);font-size:14px;padding:24px 0">{{ errorMsg() }}</p>
}

@if (evento(); as e) {
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Evento</div>
    <h1>{{ e.nombre }}</h1>
    <p class="sub">
      {{ fmtFecha(e.fecha_inicio) }} →
      {{ e.fecha_fin ? fmtFecha(e.fecha_fin) : 'en curso' }}
    </p>
  </div>
  <div class="ph-r">
    <button class="btn-sm ghost" (click)="volver()">← Eventos</button>
    @if (e.estado === 'activo') {
      <button class="btn-sm danger" (click)="confirmando.set(true)">Finalizar evento</button>
    }
  </div>
</div>

<!-- KPIs -->
<div class="kpi-strip" style="margin-bottom:var(--s-5)">
  <div class="kpi-item" data-tone="selva">
    <div class="kpi-k">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/></svg>
      Total vendido
    </div>
    <div class="kpi-n">{{ fmtCOP(totalCOP()) }}</div>
    <div class="kpi-delta">COP · precio × unidades</div>
  </div>
  <div class="kpi-item" data-tone="rio">
    <div class="kpi-k">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
      Unidades
    </div>
    <div class="kpi-n">{{ totalUnidades() }}</div>
    <div class="kpi-delta">ítems vendidos</div>
  </div>
  <div class="kpi-item" data-tone="terra">
    <div class="kpi-k">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 8 9 5v8"/><path d="m21 8-9 5v8"/></svg>
      Productos
    </div>
    <div class="kpi-n">{{ productosDistintos() }}</div>
    <div class="kpi-delta">SKUs distintos vendidos</div>
  </div>
  <div class="kpi-item">
    <div class="kpi-k">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
      Duración
    </div>
    <div class="kpi-n">{{ diasEvento() }}</div>
    <div class="kpi-delta">días</div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-4);align-items:start">

  <!-- Top productos -->
  <div class="panel">
    <div class="panel-h">
      <h3>Top productos</h3>
      <span class="sub">{{ topProductos().length }} distintos</span>
    </div>
    @if (topProductos().length === 0) {
      <div style="padding:32px;text-align:center">
        <p style="color:var(--carbon-50);font-size:14px">Sin ventas registradas en este evento.</p>
      </div>
    }
    @if (topProductos().length > 0) {
    <table class="tbl">
      <thead>
        <tr>
          <th>Producto</th>
          <th class="num">Unidades</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        @for (p of topProductos(); track p.nombre) {
        <tr>
          <td><strong>{{ p.nombre }}</strong></td>
          <td class="num">{{ p.unidades }}</td>
          <td class="num id">@if (p.monto > 0) { {{ fmtCOP(p.monto) }} } @else { — }</td>
        </tr>
        }
      </tbody>
    </table>
    }
  </div>

  <!-- Ventas por día -->
  <div class="panel">
    <div class="panel-h">
      <h3>Ventas por día</h3>
      <span class="sub">{{ ventasPorDia().length }} días con actividad</span>
    </div>
    @if (ventasPorDia().length === 0) {
      <div style="padding:32px;text-align:center">
        <p style="color:var(--carbon-50);font-size:14px">Sin actividad registrada.</p>
      </div>
    }
    @if (ventasPorDia().length > 0) {
    <table class="tbl">
      <thead>
        <tr>
          <th>Fecha</th>
          <th class="num">Unidades</th>
          <th class="num">Monto</th>
        </tr>
      </thead>
      <tbody>
        @for (d of ventasPorDia(); track d.fecha) {
        <tr>
          <td class="id">{{ fmtFechaDia(d.fecha) }}</td>
          <td class="num">{{ d.unidades }}</td>
          <td class="num id">@if (d.monto > 0) { {{ fmtCOP(d.monto) }} } @else { — }</td>
        </tr>
        }
      </tbody>
    </table>
    }
  </div>

</div>
}

<!-- Confirm finalizar -->
@if (confirmando()) {
<div class="drawer-back on" (click)="confirmando.set(false)"></div>
<div class="confirm-modal">
  <h3>¿Finalizar el evento?</h3>
  <p>Esta acción registra <strong>{{ fmtFecha(new Date().toISOString()) }}</strong> como fecha de cierre. No se puede deshacer.</p>
  <div class="confirm-acts">
    <button class="btn-sm danger" (click)="finalizar()" [disabled]="finalizando()">
      {{ finalizando() ? 'Finalizando…' : 'Sí, finalizar' }}
    </button>
    <button class="btn-sm ghost" (click)="confirmando.set(false)">Cancelar</button>
  </div>
</div>
}

@if (toast()) {
  <div class="toast-global">{{ toast() }}</div>
}
```

- [ ] **Step 3: Create `evento-detail.component.scss`**

```scss
:host { display: block; }

.confirm-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 201;
  background: var(--paper);
  border: 1px solid var(--carbon-12);
  border-radius: var(--r-lg);
  padding: var(--s-6);
  width: 420px;
  max-width: calc(100vw - 32px);
  box-shadow: 0 24px 64px rgba(21,31,40,0.22);

  h3 {
    font-family: var(--display);
    font-size: 24px;
    letter-spacing: -0.01em;
    margin-bottom: var(--s-3);
  }

  p {
    font-size: 14px;
    color: var(--carbon-70);
    line-height: 1.6;
    margin-bottom: var(--s-5);
  }
}

.confirm-acts {
  display: flex;
  gap: 10px;
}
```

- [ ] **Step 4: Verify in browser**

Navigate to `/admin/eventos`, click a row. Detail page should load with KPI strip (4 metrics), top productos table, and ventas por día table. For an event with `estado = 'activo'`, "Finalizar evento" button should appear. Click it → confirm modal appears → confirm → event updates to "Finalizado" and button disappears.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/eventos/evento-detail.component.*
git commit -m "feat: add EventoDetailComponent with KPIs, top productos, ventas por día"
```

---

### Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| DB: tabla eventos | Task 1 |
| DB: columna personaje | Task 1 |
| DB: columna canal | Task 1 |
| Global style scope for new components | Task 1 |
| InventarioService: cargarTodos, duplicarProducto, toggleActivo | Task 2 |
| EventosService: CRUD eventos, getVentasEvento | Task 2 |
| Routes: /admin/productos/* y /admin/eventos/* | Task 3 |
| Sidebar: Eventos (reemplaza Inventario), Productos navega a ruta | Task 3 |
| Breadcrumbs actualizados | Task 3 |
| ProductosListComponent: tabla, filtros, acciones por fila | Task 4 |
| Ver (drawer read-only) | Task 4 |
| Editar (navega a form) | Task 4 |
| Duplicar (crea copia con toast) | Task 4 |
| Ocultar/Mostrar (toggle activo) | Task 4 |
| ProductoFormComponent: crear/editar con personaje | Task 5 |
| VentasGeneralComponent: filtro canal, totales COP | Task 6 |
| EventosListComponent: lista + drawer nuevo evento | Task 7 |
| Validación: un solo evento activo | Task 7 (EventosService.crearEvento) |
| EventoDetailComponent: KPIs, top productos, ventas por día | Task 8 |
| Finalizar evento con confirm | Task 8 |

All spec requirements are covered. No placeholders or TBDs found.
