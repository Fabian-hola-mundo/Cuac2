# Inventario de Eventos + App POS — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un sistema de inventario para eventos en el panel admin Angular (`/admin/inventario`) y una app PWA standalone de punto de venta (`pos/index.html`), con Supabase como backend y auth real.

**Architecture:** `AdminShellComponent` provee auth gate + sidebar + router-outlet. `AdminHomeComponent` (el monolito actual renombrado) mantiene su lógica ViewId intacta; la señal `view` se migra a `AdminStateService`. Tres componentes de inventario se montan como child routes reales. La app POS es vanilla HTML/JS con Supabase vía CDN.

**Tech Stack:** Angular 21 (standalone, signals, reactive forms), @supabase/supabase-js v2, pnpm, HTML/CSS/JS vanilla (POS)

---

## Mapa de archivos

| Acción | Archivo |
|---|---|
| CREAR | `src/environments/environment.ts` |
| CREAR | `src/app/core/services/supabase.service.ts` |
| CREAR | `src/app/core/services/inventario.service.ts` |
| CREAR | `src/app/core/services/admin-state.service.ts` |
| CREAR | `src/app/pages/admin/admin-shell.component.ts` |
| CREAR | `src/app/pages/admin/admin-shell.component.html` |
| CREAR | `src/app/pages/admin/admin-shell.component.scss` |
| RENOMBRAR | `admin.component.{ts,html,scss}` → `admin-home.component.{ts,html,scss}` |
| CREAR | `src/app/pages/admin/inventario/inventario-list.component.ts` |
| CREAR | `src/app/pages/admin/inventario/inventario-list.component.html` |
| CREAR | `src/app/pages/admin/inventario/inventario-list.component.scss` |
| CREAR | `src/app/pages/admin/inventario/inventario-form.component.ts` |
| CREAR | `src/app/pages/admin/inventario/inventario-form.component.html` |
| CREAR | `src/app/pages/admin/inventario/inventario-form.component.scss` |
| CREAR | `src/app/pages/admin/inventario/inventario-ventas.component.ts` |
| CREAR | `src/app/pages/admin/inventario/inventario-ventas.component.html` |
| CREAR | `src/app/pages/admin/inventario/inventario-ventas.component.scss` |
| MODIFICAR | `src/app/app.routes.ts` |
| CREAR | `supabase/migrations/001_inventario.sql` |
| CREAR | `pos/index.html` |
| CREAR | `pos/manifest.json` |

---

## Fase 1 — Supabase

### Task 1: Crear proyecto Supabase + instalar dependencia Angular

**Files:**
- Modify: `package.json`
- Create: `src/environments/environment.ts`

- [ ] **Step 1: Instalar @supabase/supabase-js**

```bash
pnpm add @supabase/supabase-js
```

Verificar que aparece en `package.json` dependencies.

- [ ] **Step 2: Crear el proyecto Supabase vía MCP**

Usar la herramienta MCP `mcp__claude_ai_Supabase__create_project` con:
- name: `cuaquiverso-pos`
- region: `sa-east-1`
- organization_id: `kdchnoqbwuvmeqxwxogp`

Guardar el `ref` (ID) del proyecto creado. Esperar a que el status sea `ACTIVE_HEALTHY`.

- [ ] **Step 3: Obtener URL y anon key del proyecto**

Usar `mcp__claude_ai_Supabase__get_project_url` y `mcp__claude_ai_Supabase__get_publishable_keys` con el `ref` del proyecto.

- [ ] **Step 4: Crear `src/environments/environment.ts`**

```ts
export const environment = {
  supabaseUrl: 'PEGAR_URL_DEL_PROYECTO',
  supabaseKey: 'PEGAR_ANON_KEY',
};
```

- [ ] **Step 5: Commit**

```bash
git add src/environments/environment.ts package.json pnpm-lock.yaml
git commit -m "feat: install supabase-js and add environment config"
```

---

### Task 2: Migración SQL — tablas, RLS y función atómica

**Files:**
- Create: `supabase/migrations/001_inventario.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/001_inventario.sql

-- Tabla de productos por evento
CREATE TABLE productos_evento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id     text NOT NULL,
  nombre        text NOT NULL,
  categoria     text,
  precio        integer,
  stock_inicial integer NOT NULL DEFAULT 0,
  stock_actual  integer NOT NULL DEFAULT 0,
  activo        boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Tabla de ventas registradas desde el POS
CREATE TABLE ventas_evento (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id  uuid NOT NULL REFERENCES productos_evento(id),
  cantidad     integer NOT NULL,
  dispositivo  text,
  vendido_en   timestamptz NOT NULL DEFAULT now(),
  sincronizado boolean NOT NULL DEFAULT true
);

-- Índices para queries frecuentes
CREATE INDEX idx_productos_evento_id ON productos_evento(evento_id);
CREATE INDEX idx_ventas_producto_id  ON ventas_evento(producto_id);
CREATE INDEX idx_ventas_vendido_en   ON ventas_evento(vendido_en);

-- Función atómica para decrementar stock (evita race conditions entre dispositivos)
CREATE OR REPLACE FUNCTION decrementar_stock_seguro(
  p_producto_id uuid,
  p_cantidad    integer
) RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
  UPDATE productos_evento
  SET stock_actual = GREATEST(0, stock_actual - p_cantidad)
  WHERE id = p_producto_id;
$$;

-- RLS
ALTER TABLE productos_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_evento    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solo_admin_productos" ON productos_evento
  FOR ALL USING (auth.email() = 'designcuac@gmail.com');

CREATE POLICY "solo_admin_ventas" ON ventas_evento
  FOR ALL USING (auth.email() = 'designcuac@gmail.com');

-- Realtime en productos_evento (el POS escucha cambios de stock)
ALTER PUBLICATION supabase_realtime ADD TABLE productos_evento;
```

- [ ] **Step 2: Aplicar migración vía MCP**

Usar `mcp__claude_ai_Supabase__apply_migration` con:
- project_id: ref del proyecto
- name: `001_inventario`
- query: contenido del SQL anterior

- [ ] **Step 3: Verificar tablas**

Usar `mcp__claude_ai_Supabase__list_tables` y confirmar que `productos_evento` y `ventas_evento` aparecen.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_inventario.sql
git commit -m "feat: add supabase migration for inventario schema"
```

---

### Task 3: Configurar Auth en Supabase

- [ ] **Step 1: Habilitar Google OAuth**

En el dashboard de Supabase → Authentication → Providers → Google:
- Habilitar el provider
- Agregar Site URL: `http://localhost:4200`
- Agregar Redirect URL adicional: `http://localhost:4200/admin`

Para la Client ID y Client Secret de Google:
1. Ir a [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Crear OAuth 2.0 Client ID (Web application)
3. Authorized redirect URIs: `https://<ref>.supabase.co/auth/v1/callback`
4. Pegar Client ID y Client Secret en Supabase

- [ ] **Step 2: Crear contraseña para el POS**

En Supabase → Authentication → Users → Invite user:
- Email: `designcuac@gmail.com`
- Esto crea el usuario. Luego en el dashboard → Users → buscar el usuario → "Send password reset" para establecer una contraseña.

Alternativamente, usar `mcp__claude_ai_Supabase__execute_sql`:
```sql
-- Esto crea el usuario con contraseña directamente (solo en desarrollo)
SELECT auth.uid() FROM auth.users WHERE email = 'designcuac@gmail.com';
```

Guardar la contraseña en un lugar seguro — el POS la necesita para el login.

---

## Fase 2 — Servicios Angular

### Task 4: SupabaseService

**Files:**
- Create: `src/app/core/services/supabase.service.ts`

- [ ] **Step 1: Crear directorio core**

```bash
mkdir -p src/app/core/services
```

- [ ] **Step 2: Crear `supabase.service.ts`**

```ts
// src/app/core/services/supabase.service.ts
import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseKey
  );

  readonly session = signal<Session | null>(null);

  constructor() {
    this.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
    });
    this.client.auth.onAuthStateChange((_, session) => {
      this.session.set(session);
    });
  }

  get db(): SupabaseClient { return this.client; }

  signInWithGoogle() {
    return this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    });
  }

  signInWithPassword(email: string, password: string) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  signOut() {
    return this.client.auth.signOut();
  }
}
```

- [ ] **Step 3: Verificar compilación**

```bash
ng build --configuration development 2>&1 | tail -20
```

Expected: sin errores de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/services/supabase.service.ts
git commit -m "feat: add SupabaseService with auth signals"
```

---

### Task 5: AdminStateService + InventarioService

**Files:**
- Create: `src/app/core/services/admin-state.service.ts`
- Create: `src/app/core/services/inventario.service.ts`

- [ ] **Step 1: Crear `admin-state.service.ts`**

```ts
// src/app/core/services/admin-state.service.ts
import { Injectable, signal } from '@angular/core';

export type ViewId = 'dashboard' | 'productos' | 'pedidos' | 'clientes' | 'pagos' | 'contenido' | 'ajustes';

@Injectable({ providedIn: 'root' })
export class AdminStateService {
  readonly view = signal<ViewId>('dashboard');
}
```

- [ ] **Step 2: Crear `inventario.service.ts`**

```ts
// src/app/core/services/inventario.service.ts
import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ProductoEvento {
  id: string;
  evento_id: string;
  nombre: string;
  categoria: string;
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
  productos_evento?: { nombre: string; categoria: string };
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

@Injectable({ providedIn: 'root' })
export class InventarioService {
  readonly productos = signal<ProductoEvento[]>([]);
  readonly cargando  = signal(false);
  readonly error     = signal<string | null>(null);

  constructor(private sb: SupabaseService) {}

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
    await this.cargarProductos();
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
    await this.cargarProductos();
    return { error: null };
  }

  async getVentas(desde?: string, hasta?: string): Promise<VentaEvento[]> {
    let q = this.sb.db
      .from('ventas_evento')
      .select('*, productos_evento(nombre, categoria)')
      .order('vendido_en', { ascending: false });
    if (desde) q = q.gte('vendido_en', `${desde}T00:00:00`);
    if (hasta) q = q.lte('vendido_en', `${hasta}T23:59:59`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }
}
```

- [ ] **Step 3: Verificar compilación**

```bash
ng build --configuration development 2>&1 | tail -20
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/services/admin-state.service.ts src/app/core/services/inventario.service.ts
git commit -m "feat: add AdminStateService and InventarioService"
```

---

## Fase 3 — Refactor Admin Shell

### Task 6: Crear AdminShellComponent

**Files:**
- Create: `src/app/pages/admin/admin-shell.component.ts`
- Create: `src/app/pages/admin/admin-shell.component.html`
- Create: `src/app/pages/admin/admin-shell.component.scss`

- [ ] **Step 1: Crear `admin-shell.component.ts`**

```ts
// src/app/pages/admin/admin-shell.component.ts
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal }       from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { SupabaseService }   from '../../core/services/supabase.service';
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

  // Login form
  loginEmail    = 'designcuac@gmail.com';
  loginPass     = '';
  loginError    = signal<string | null>(null);
  loginLoading  = signal(false);

  // Toast
  toast         = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  // Track current URL reactively
  private routerUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  isInventarioRoute = computed(() => this.routerUrl().includes('/admin/inventario'));

  crumbs = computed(() => {
    const url = this.routerUrl();
    if (url.includes('/inventario/ventas'))       return ['Evento', 'Inventario', 'Log de ventas'];
    if (url.includes('/inventario/nuevo'))        return ['Evento', 'Inventario', 'Nuevo producto'];
    if (url.match(/\/inventario\/.+\/editar/))    return ['Evento', 'Inventario', 'Editar producto'];
    if (url.includes('/inventario'))              return ['Evento', 'Inventario'];

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

  // Sidebar nav data (mirrors admin-home)
  readonly NAV_TIENDA   = ['dashboard','productos','pedidos','clientes','pagos'] as ViewId[];
  readonly NAV_UNIVERSO = ['contenido','ajustes'] as ViewId[];
  readonly NAV_META: Record<string, { label: string; count?: number }> = {
    dashboard: { label: 'Dashboard' },
    productos: { label: 'Productos', count: 42 },
    pedidos:   { label: 'Pedidos',   count: 12 },
    clientes:  { label: 'Clientes'  },
    pagos:     { label: 'Pagos'     },
    contenido: { label: 'Contenido' },
    ajustes:   { label: 'Ajustes'   },
  };

  ngOnInit() {
    // Restore session on page reload
    this.sb.db.auth.onAuthStateChange(() => {});
  }

  goHome(id: ViewId) {
    this.state.view.set(id);
    if (this.isInventarioRoute()) this.router.navigate(['/admin']);
  }

  goInventario() { this.router.navigate(['/admin/inventario']); }

  async loginGoogle() { await this.sb.signInWithGoogle(); }

  async loginPassword() {
    this.loginLoading.set(true);
    this.loginError.set(null);
    const { error } = await this.sb.signInWithPassword(this.loginEmail, this.loginPass);
    this.loginLoading.set(false);
    if (error) this.loginError.set('Credenciales incorrectas. Intenta de nuevo.');
  }

  async logout() {
    await this.sb.signOut();
  }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }

  get userEmail(): string { return this.sb.session()?.user?.email ?? ''; }
  get userInitial(): string { return (this.sb.session()?.user?.email?.[0] ?? 'C').toUpperCase(); }
}
```

- [ ] **Step 2: Crear `admin-shell.component.html`**

```html
<!-- src/app/pages/admin/admin-shell.component.html -->

<!-- ══ LOGIN SCREEN ══════════════════════════════════════════════════════════ -->
@if (!sb.session()) {
<div id="login-screen">
  <div class="login-grid">

    <div class="login-side">
      <div class="login-dots" aria-hidden="true"></div>
      <span class="login-deco" aria-hidden="true">Cv</span>
      <div>
        <div class="brand-l">Cuaqui<em>verso</em></div>
        <div class="tag-l">Admin v0.5</div>
      </div>
      <h2>Detrás del telón del <em>universo</em>.</h2>
      <p class="b">Gestiona productos, pedidos, clientes y pagos. Acceso restringido al equipo de operaciones.</p>
    </div>

    <div class="login-form">
      <h3>Hola de nuevo, <em>capitán</em>.</h3>
      <p class="pp">Entra con tu cuenta de Google o con contraseña.</p>

      <!-- Google OAuth -->
      <button class="submit" type="button" (click)="loginGoogle()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 12A10 10 0 1 1 12 2"/><path d="M22 12h-10"/></svg>
        Continuar con Google
      </button>

      <div class="or">o usa contraseña</div>

      <!-- Password login -->
      <div class="field">
        <label>Correo</label>
        <div class="input-wrap">
          <input class="input" type="email" [(ngModel)]="loginEmail" name="email" autocomplete="email" />
        </div>
      </div>
      <div class="field">
        <label>Contraseña</label>
        <div class="input-wrap">
          <input class="input" type="password" [(ngModel)]="loginPass" name="password" autocomplete="current-password" />
        </div>
      </div>
      @if (loginError()) {
        <p style="color:var(--terra);font-size:13px;margin-bottom:8px">{{ loginError() }}</p>
      }
      <button class="submit ghost" type="button" [disabled]="loginLoading()" (click)="loginPassword()">
        {{ loginLoading() ? 'Entrando…' : 'Entrar con contraseña' }}
      </button>

      <div class="legal">Solo personal autorizado · sesión cifrada · expira en 24h</div>
    </div>
  </div>
</div>
}

<!-- ══ ADMIN SHELL ════════════════════════════════════════════════════════════ -->
@if (sb.session()) {
<div class="admin-shell">

  <!-- ── SIDEBAR ─────────────────────────────────────────────────────────── -->
  <aside class="sidebar">
    <div class="sb-brand">
      <span class="b1">Cuaqui</span><span class="b2">verso</span>
      <span class="tag">Admin</span>
    </div>

    <div class="sb-section">Tienda</div>
    <div class="sb-nav">
      @for (id of NAV_TIENDA; track id) {
      <a [class.is-active]="state.view() === id && !isInventarioRoute()" (click)="goHome(id)">
        @if (id === 'dashboard') { <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg> }
        @if (id === 'productos') { <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 8 9 5v8L3 16V8Z"/><path d="m21 8-9 5v8l9-5V8Z"/></svg> }
        @if (id === 'pedidos')   { <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V5a3 3 0 0 1 6 0v3"/></svg> }
        @if (id === 'clientes')  { <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M21 20c0-2.5-1.9-4.6-4.4-4.95"/></svg> }
        @if (id === 'pagos')     { <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/></svg> }
        <span>{{ NAV_META[id].label }}</span>
        @if (NAV_META[id].count != null) { <span class="count">{{ NAV_META[id].count }}</span> }
      </a>
      }
    </div>

    <div class="sb-section">Universo</div>
    <div class="sb-nav">
      @for (id of NAV_UNIVERSO; track id) {
      <a [class.is-active]="state.view() === id && !isInventarioRoute()" (click)="goHome(id)">
        @if (id === 'contenido') { <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.6 5.7 6.4.7-4.8 4.4 1.3 6.2L12 17l-5.5 3 1.3-6.2L3 9.4l6.4-.7L12 3Z"/></svg> }
        @if (id === 'ajustes')   { <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg> }
        <span>{{ NAV_META[id].label }}</span>
      </a>
      }
    </div>

    <div class="sb-section">Evento</div>
    <div class="sb-nav">
      <a [class.is-active]="isInventarioRoute()" (click)="goInventario()">
        <svg class="sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/><circle cx="7" cy="6" r="1" fill="currentColor"/><circle cx="7" cy="12" r="1" fill="currentColor"/><circle cx="7" cy="18" r="1" fill="currentColor"/></svg>
        <span>Inventario</span>
        <span class="count">sofa-26</span>
      </a>
    </div>

    <div class="sb-foot">
      <div class="avatar">{{ userInitial }}</div>
      <div class="who"><strong>Design Cuac</strong><span>{{ userEmail }}</span></div>
      <button class="logout" title="Cerrar sesión" (click)="logout()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="m10 16-4-4 4-4"/><path d="M6 12h11"/></svg>
      </button>
    </div>
  </aside>

  <!-- ── MAIN ───────────────────────────────────────────────────────────── -->
  <main class="main">
    <div class="topbar-admin">
      <div class="crumbs-admin">
        <span>Cuaquiverso</span><span class="sep">/</span>
        @for (c of crumbs().slice(0,-1); track $index) {
          <span>{{ c }}</span><span class="sep">/</span>
        }
        <strong>{{ crumbs()[crumbs().length - 1] }}</strong>
      </div>
      <div class="top-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
        <input placeholder="Buscar…" />
        <kbd>⌘ K</kbd>
      </div>
      <div class="top-actions-admin">
        <button class="ib" title="Notificaciones">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16H6a3 3 0 0 0 3-3V9a3 3 0 0 1 6 0v4a3 3 0 0 0 3 3Z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>
        </button>
      </div>
    </div>

    <div class="content">
      <router-outlet />
    </div>
  </main>

  <!-- Toast global -->
  @if (toast()) {
  <div class="toast-global">{{ toast() }}</div>
  }
</div>
}
```

- [ ] **Step 3: Crear `admin-shell.component.scss`**

```scss
// src/app/pages/admin/admin-shell.component.scss
:host { display: block; }

.toast-global {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--carbon);
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 9999;
  pointer-events: none;
}
```

- [ ] **Step 4: Verificar compilación**

```bash
ng build --configuration development 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/admin-shell.component.ts src/app/pages/admin/admin-shell.component.html src/app/pages/admin/admin-shell.component.scss
git commit -m "feat: add AdminShellComponent with real Supabase auth"
```

---

### Task 7: Renombrar AdminComponent → AdminHomeComponent

**Files:**
- Rename: `admin.component.{ts,html,scss}` → `admin-home.component.{ts,html,scss}`
- Modify: `admin-home.component.ts` — usar AdminStateService, quitar auth, quitar outer shell HTML

- [ ] **Step 1: Renombrar los archivos**

```bash
cd src/app/pages/admin
mv admin.component.ts admin-home.component.ts
mv admin.component.html admin-home.component.html
mv admin.component.scss admin-home.component.scss
```

- [ ] **Step 2: Actualizar `admin-home.component.ts`**

Cambiar la parte superior del archivo (imports, decorador, clase):

```ts
// src/app/pages/admin/admin-home.component.ts
import { Component, computed, signal, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminStateService, ViewId } from '../../core/services/admin-state.service';

// Mantener todas las interfaces (Character, Category, Product, Order, Customer, Payment, ToneStyle)
// Mantener todos los readonly data arrays (CHARACTERS, CATEGORIES, PRODUCTS, ORDERS, etc.)
// Mantener todos los métodos de UI (openEditor, saveEditor, flash, fmtCOP, etc.)

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-home.component.html',
  styleUrl: './admin-home.component.scss',
})
export class AdminHomeComponent implements OnDestroy {
  private adminState = inject(AdminStateService);

  // Delegar view al servicio compartido
  view = this.adminState.view;

  // ELIMINAR: authed, loginEmail, loginPass, loginRemember (movidos al shell)
  // ELIMINAR: logout() — movido al shell
  // ELIMINAR: crumbs, NAV_TIENDA, NAV_UNIVERSO, NAV_META (movidos al shell)

  // Mantener el resto exactamente igual
  // ... (resto del código existente)
}
```

Edits concretos a hacer en `admin-home.component.ts`:
1. Cambiar `selector` de `'app-admin'` a `'app-admin-home'`
2. Cambiar `templateUrl` de `'./admin.component.html'` a `'./admin-home.component.html'`
3. Cambiar `styleUrl` de `'./admin.component.scss'` a `'./admin-home.component.scss'`
4. Cambiar nombre de clase de `AdminComponent` a `AdminHomeComponent`
5. Añadir `import { AdminStateService, ViewId } from '../../core/services/admin-state.service';`
6. Añadir `private adminState = inject(AdminStateService);` en la clase
7. Cambiar `view = signal<ViewId>('dashboard');` a `view = this.adminState.view;`
8. Eliminar: `authed`, `loginEmail`, `loginPass`, `loginRemember`, campos de login
9. Eliminar: métodos `login()`, `logout()`
10. Eliminar: `crumbs`, `NAV_TIENDA`, `NAV_UNIVERSO`, `NAV_META`, `BARS`, `DAYS`, `MAX_BAR`, `barHeight()`

- [ ] **Step 3: Actualizar `admin-home.component.html`**

Eliminar del HTML:
- El bloque `@if (!authed())` completo (el login screen — ahora en el shell)
- El `<div class="admin-shell">` wrapper externo
- El `<aside class="sidebar">` completo
- El `<div class="topbar-admin">` completo
- Los divs de cierre correspondientes al shell y main wrapper

Mantener solo:
```html
@switch (view()) {
  @case ('dashboard') { ... }
  @case ('productos') { ... }
  <!-- etc. -->
}
```

Envuelto en un wrapper mínimo:
```html
<div class="content-home">
  @switch (view()) {
    @case ('dashboard') { ... todo el contenido existente ... }
    @case ('productos') { ... }
    @case ('pedidos')   { ... }
    @case ('clientes')  { ... }
    @case ('pagos')     { ... }
    @case ('contenido') { ... }
    @case ('ajustes')   { ... }
  }
</div>
```

- [ ] **Step 4: Verificar compilación**

```bash
ng build --configuration development 2>&1 | tail -20
```

Expected: sin errores. Si hay errores de propiedades eliminadas que aún se usan en el HTML (ej. `authed()`, `crumbs()`), eliminarlos también del HTML.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/admin-home.component.ts src/app/pages/admin/admin-home.component.html src/app/pages/admin/admin-home.component.scss
git commit -m "refactor: extract AdminShell, AdminHome uses AdminStateService"
```

---

### Task 8: Actualizar app.routes.ts con child routes

**Files:**
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Reemplazar la ruta `/admin`**

```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then(m => m.HomeComponent),
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
    ],
  },
];
```

- [ ] **Step 2: Verificar compilación**

```bash
ng build --configuration development 2>&1 | tail -20
```

- [ ] **Step 3: Verificar en navegador**

```bash
ng serve
```

Abrir `http://localhost:4200/admin` — debe mostrar la pantalla de login del shell.

- [ ] **Step 4: Commit**

```bash
git add src/app/app.routes.ts
git commit -m "feat: convert admin to child routes with AdminShellComponent"
```

---

## Fase 4 — Vistas de Inventario

### Task 9: InventarioListComponent

**Files:**
- Create: `src/app/pages/admin/inventario/inventario-list.component.ts`
- Create: `src/app/pages/admin/inventario/inventario-list.component.html`
- Create: `src/app/pages/admin/inventario/inventario-list.component.scss`

- [ ] **Step 1: Crear directorio**

```bash
mkdir -p src/app/pages/admin/inventario
```

- [ ] **Step 2: Crear `inventario-list.component.ts`**

```ts
// src/app/pages/admin/inventario/inventario-list.component.ts
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router }       from '@angular/router';
import { InventarioService, ProductoEvento, CATEGORIAS } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-inventario-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inventario-list.component.html',
  styleUrl: './inventario-list.component.scss',
})
export class InventarioListComponent implements OnInit {
  private router    = inject(Router);
  readonly inv      = inject(InventarioService);
  readonly categorias = CATEGORIAS;

  catFiltro = signal<string>('all');

  productosFiltrados = computed(() => {
    const cat  = this.catFiltro();
    const list = this.inv.productos();
    return cat === 'all' ? list : list.filter(p => p.categoria === cat);
  });

  ngOnInit() { this.inv.cargarProductos(); }

  nuevo()      { this.router.navigate(['/admin/inventario/nuevo']); }
  editar(p: ProductoEvento) { this.router.navigate(['/admin/inventario', p.id, 'editar']); }
  verVentas()  { this.router.navigate(['/admin/inventario/ventas']); }

  fmtCOP(n: number) {
    return '$' + n.toLocaleString('es-CO');
  }

  labelCategoria(id: string) {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }
}
```

- [ ] **Step 3: Crear `inventario-list.component.html`**

```html
<!-- src/app/pages/admin/inventario/inventario-list.component.html -->
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Inventario · sofa-2026</div>
    <h1>Productos del <em>evento</em>.</h1>
    <p class="sub">Stock en tiempo real. Edita precios, categorías y stock inicial desde aquí.</p>
  </div>
  <div class="ph-r">
    <button class="btn-sm ghost" (click)="verVentas()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/></svg>
      Log de ventas
    </button>
    <button class="btn-sm solid" (click)="nuevo()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg>
      Nuevo producto
    </button>
  </div>
</div>

<!-- Filtros -->
<div style="display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap">
  <button class="chip" [class.is-on]="catFiltro() === 'all'" (click)="catFiltro.set('all')">Todos</button>
  @for (c of categorias; track c.id) {
    <button class="chip" [class.is-on]="catFiltro() === c.id" (click)="catFiltro.set(c.id)">{{ c.label }}</button>
  }
</div>

<!-- Estado de carga -->
@if (inv.cargando()) {
  <p style="color:var(--mid);font-size:14px">Cargando productos…</p>
}
@if (inv.error()) {
  <p style="color:var(--terra);font-size:14px">Error: {{ inv.error() }}</p>
}

<!-- Tabla -->
@if (!inv.cargando() && productosFiltrados().length > 0) {
<div class="panel">
  <table class="data-table">
    <thead>
      <tr>
        <th>Producto</th>
        <th>Categoría</th>
        <th>Precio</th>
        <th>Stock inicial</th>
        <th>Stock actual</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      @for (p of productosFiltrados(); track p.id) {
      <tr class="clickable-row" (click)="editar(p)">
        <td><strong>{{ p.nombre }}</strong></td>
        <td>{{ labelCategoria(p.categoria) }}</td>
        <td>{{ fmtCOP(p.precio) }}</td>
        <td>{{ p.stock_inicial }}</td>
        <td>
          <span [style.color]="p.stock_actual === 0 ? 'var(--terra)' : p.stock_actual < 3 ? '#B07820' : 'inherit'">
            {{ p.stock_actual }}
          </span>
        </td>
        <td>
          @if (p.activo) {
            <span class="badge-ok">Activo</span>
          } @else {
            <span class="badge-off">Inactivo</span>
          }
        </td>
      </tr>
      }
    </tbody>
  </table>
</div>
}

@if (!inv.cargando() && productosFiltrados().length === 0 && !inv.error()) {
<div class="panel" style="text-align:center;padding:48px 24px;color:var(--mid)">
  <p>No hay productos. <button class="link-btn" (click)="nuevo()">Crea el primero →</button></p>
</div>
}
```

- [ ] **Step 4: Crear `inventario-list.component.scss`**

```scss
// src/app/pages/admin/inventario/inventario-list.component.scss
:host { display: block; }

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;

  th {
    text-align: left;
    padding: 10px 14px;
    color: var(--mid);
    font-weight: 500;
    border-bottom: 1px solid var(--line);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: .04em;
  }

  td {
    padding: 12px 14px;
    border-bottom: 1px solid var(--line);
    vertical-align: middle;
  }

  .clickable-row {
    cursor: pointer;
    transition: background .12s;
    &:hover { background: var(--surface); }
  }
}

.badge-ok {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  background: rgba(31,138,91,.15);
  color: #1F8A5B;
}

.badge-off {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  background: var(--surface);
  color: var(--mid);
}

.link-btn {
  background: none;
  border: none;
  color: var(--ember);
  cursor: pointer;
  font-size: inherit;
  padding: 0;
  &:hover { text-decoration: underline; }
}
```

- [ ] **Step 5: Verificar en navegador**

Con `ng serve` abierto, navegar a `http://localhost:4200/admin/inventario`. Debe mostrar la lista (vacía si no hay productos aún).

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/admin/inventario/inventario-list.component.ts src/app/pages/admin/inventario/inventario-list.component.html src/app/pages/admin/inventario/inventario-list.component.scss
git commit -m "feat: add InventarioListComponent"
```

---

### Task 10: InventarioFormComponent

**Files:**
- Create: `src/app/pages/admin/inventario/inventario-form.component.ts`
- Create: `src/app/pages/admin/inventario/inventario-form.component.html`
- Create: `src/app/pages/admin/inventario/inventario-form.component.scss`

- [ ] **Step 1: Crear `inventario-form.component.ts`**

```ts
// src/app/pages/admin/inventario/inventario-form.component.ts
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule }    from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute }  from '@angular/router';
import { InventarioService, CATEGORIAS } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-inventario-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './inventario-form.component.html',
  styleUrl: './inventario-form.component.scss',
})
export class InventarioFormComponent implements OnInit {
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private fb     = inject(FormBuilder);
  private inv    = inject(InventarioService);

  readonly categorias = CATEGORIAS;
  readonly editId     = signal<string | null>(null);
  readonly guardando  = signal(false);
  readonly errorMsg   = signal<string | null>(null);
  readonly isEdit     = computed(() => this.editId() !== null);

  form = this.fb.group({
    nombre:        ['', [Validators.required, Validators.minLength(2)]],
    categoria:     ['tote', Validators.required],
    precio:        [null as number | null, [Validators.required, Validators.min(1)]],
    stock_inicial: [0, [Validators.required, Validators.min(0)]],
    activo:        [true],
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      const p = await this.inv.getProducto(id);
      if (p) {
        this.form.patchValue({
          nombre: p.nombre,
          categoria: p.categoria,
          precio: p.precio,
          stock_inicial: p.stock_inicial,
          activo: p.activo,
        });
      }
    }
  }

  async guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set(null);

    const v = this.form.value;
    const payload = {
      evento_id:     'sofa-2026',
      nombre:        v.nombre!,
      categoria:     v.categoria!,
      precio:        v.precio!,
      stock_inicial: v.stock_inicial!,
      activo:        v.activo ?? true,
    };

    const result = this.isEdit()
      ? await this.inv.updateProducto(this.editId()!, payload)
      : await this.inv.createProducto(payload);

    this.guardando.set(false);
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.router.navigate(['/admin/inventario']);
  }

  cancelar() { this.router.navigate(['/admin/inventario']); }

  hasError(field: string) {
    const c = this.form.get(field);
    return c?.invalid && c?.touched;
  }
}
```

- [ ] **Step 2: Crear `inventario-form.component.html`**

```html
<!-- src/app/pages/admin/inventario/inventario-form.component.html -->
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Inventario · sofa-2026</div>
    <h1>{{ isEdit() ? 'Editar' : 'Nuevo' }} <em>producto</em>.</h1>
  </div>
  <div class="ph-r">
    <button class="btn-sm ghost" (click)="cancelar()">Cancelar</button>
  </div>
</div>

<div class="panel" style="max-width:560px">
  <form [formGroup]="form" (ngSubmit)="guardar()">

    <!-- Nombre -->
    <div class="field">
      <label>Nombre del producto *</label>
      <input class="input" formControlName="nombre" placeholder="Tote bag sofa-2026" />
      @if (hasError('nombre')) {
        <span class="field-err">El nombre es requerido (mínimo 2 caracteres)</span>
      }
    </div>

    <!-- Categoría -->
    <div class="field">
      <label>Categoría *</label>
      <select class="input" formControlName="categoria">
        @for (c of categorias; track c.id) {
          <option [value]="c.id">{{ c.label }}</option>
        }
      </select>
    </div>

    <!-- Precio -->
    <div class="field">
      <label>Precio (COP) *</label>
      <input class="input" type="number" formControlName="precio" placeholder="28000" min="1" />
      @if (hasError('precio')) {
        <span class="field-err">El precio debe ser mayor a 0</span>
      }
    </div>

    <!-- Stock inicial -->
    <div class="field">
      <label>Stock inicial *</label>
      <input class="input" type="number" formControlName="stock_inicial" placeholder="0" min="0" />
      @if (!isEdit()) {
        <span class="field-hint">El stock actual se igualará a este valor al crear</span>
      }
      @if (isEdit()) {
        <span class="field-hint">El stock actual se gestiona desde el POS — no se modifica aquí</span>
      }
      @if (hasError('stock_inicial')) {
        <span class="field-err">El stock no puede ser negativo</span>
      }
    </div>

    <!-- Activo -->
    <div class="field field-toggle">
      <label>Producto activo</label>
      <label class="toggle">
        <input type="checkbox" formControlName="activo" />
        <span class="slider"></span>
      </label>
    </div>

    @if (errorMsg()) {
      <p class="api-error">Error: {{ errorMsg() }}</p>
    }

    <div style="display:flex;gap:10px;margin-top:24px">
      <button class="btn-sm solid" type="submit" [disabled]="guardando()">
        {{ guardando() ? 'Guardando…' : (isEdit() ? 'Actualizar' : 'Crear producto') }}
      </button>
      <button class="btn-sm ghost" type="button" (click)="cancelar()">Cancelar</button>
    </div>
  </form>
</div>
```

- [ ] **Step 3: Crear `inventario-form.component.scss`**

```scss
// src/app/pages/admin/inventario/inventario-form.component.scss
:host { display: block; }

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 18px;

  label {
    font-size: 12px;
    font-weight: 600;
    color: var(--mid);
    text-transform: uppercase;
    letter-spacing: .04em;
  }
}

.field-toggle {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.field-err  { font-size: 12px; color: var(--terra); }
.field-hint { font-size: 12px; color: var(--mid); }
.api-error  { font-size: 13px; color: var(--terra); margin-bottom: 8px; }

.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;

  input { opacity: 0; width: 0; height: 0; }

  .slider {
    position: absolute;
    inset: 0;
    background: var(--line);
    border-radius: 11px;
    transition: .2s;
    cursor: pointer;
    &::before {
      content: '';
      position: absolute;
      width: 16px; height: 16px;
      left: 3px; bottom: 3px;
      background: #fff;
      border-radius: 50%;
      transition: .2s;
    }
  }

  input:checked + .slider { background: var(--ember); }
  input:checked + .slider::before { transform: translateX(18px); }
}
```

- [ ] **Step 4: Verificar crear producto**

Con `ng serve`: entrar al admin → Inventario → "Nuevo producto" → rellenar el form → Guardar. Debe redirigir a la lista y el producto aparecer.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/inventario/inventario-form.component.ts src/app/pages/admin/inventario/inventario-form.component.html src/app/pages/admin/inventario/inventario-form.component.scss
git commit -m "feat: add InventarioFormComponent with reactive form"
```

---

### Task 11: InventarioVentasComponent

**Files:**
- Create: `src/app/pages/admin/inventario/inventario-ventas.component.ts`
- Create: `src/app/pages/admin/inventario/inventario-ventas.component.html`
- Create: `src/app/pages/admin/inventario/inventario-ventas.component.scss`

- [ ] **Step 1: Crear `inventario-ventas.component.ts`**

```ts
// src/app/pages/admin/inventario/inventario-ventas.component.ts
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { Router }         from '@angular/router';
import { InventarioService, VentaEvento } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-inventario-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario-ventas.component.html',
  styleUrl: './inventario-ventas.component.scss',
})
export class InventarioVentasComponent implements OnInit {
  private router = inject(Router);
  private inv    = inject(InventarioService);

  readonly ventas    = signal<VentaEvento[]>([]);
  readonly cargando  = signal(false);
  readonly errorMsg  = signal<string | null>(null);

  // Filtros de fecha
  desde = '';
  hasta = '';

  totalesPorProducto = computed(() => {
    const map = new Map<string, { nombre: string; total: number }>();
    for (const v of this.ventas()) {
      const nombre = v.productos_evento?.nombre ?? v.producto_id;
      const prev   = map.get(nombre) ?? { nombre, total: 0 };
      map.set(nombre, { nombre, total: prev.total + v.cantidad });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  });

  ngOnInit() { this.cargar(); }

  async cargar() {
    this.cargando.set(true);
    this.errorMsg.set(null);
    try {
      const data = await this.inv.getVentas(this.desde || undefined, this.hasta || undefined);
      this.ventas.set(data);
    } catch (e: any) {
      this.errorMsg.set(e.message);
    }
    this.cargando.set(false);
  }

  volver() { this.router.navigate(['/admin/inventario']); }

  fmtFecha(iso: string) {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
```

- [ ] **Step 2: Crear `inventario-ventas.component.html`**

```html
<!-- src/app/pages/admin/inventario/inventario-ventas.component.html -->
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Inventario · sofa-2026</div>
    <h1>Log de <em>ventas</em>.</h1>
    <p class="sub">{{ ventas().length }} registros en el período seleccionado.</p>
  </div>
  <div class="ph-r">
    <button class="btn-sm ghost" (click)="volver()">← Inventario</button>
  </div>
</div>

<!-- Filtro de fechas -->
<div class="filter-row">
  <label>Desde
    <input class="input" type="date" [(ngModel)]="desde" />
  </label>
  <label>Hasta
    <input class="input" type="date" [(ngModel)]="hasta" />
  </label>
  <button class="btn-sm solid" (click)="cargar()">Filtrar</button>
</div>

@if (cargando()) { <p style="color:var(--mid);font-size:14px">Cargando…</p> }
@if (errorMsg()) { <p style="color:var(--terra);font-size:14px">Error: {{ errorMsg() }}</p> }

@if (!cargando()) {
<div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;align-items:start">

  <!-- Tabla de ventas -->
  <div class="panel">
    <div class="panel-h"><h3>Detalle de ventas</h3></div>
    @if (ventas().length === 0) {
      <p style="padding:24px;color:var(--mid);font-size:14px">Sin ventas en este período.</p>
    }
    @if (ventas().length > 0) {
    <table class="data-table">
      <thead>
        <tr>
          <th>Fecha / Hora</th>
          <th>Producto</th>
          <th>Cant.</th>
          <th>Dispositivo</th>
          <th>Sync</th>
        </tr>
      </thead>
      <tbody>
        @for (v of ventas(); track v.id) {
        <tr>
          <td style="font-size:12px;white-space:nowrap">{{ fmtFecha(v.vendido_en) }}</td>
          <td>{{ v.productos_evento?.nombre ?? '—' }}</td>
          <td><strong>{{ v.cantidad }}</strong></td>
          <td style="color:var(--mid);font-size:12px">{{ v.dispositivo ?? '—' }}</td>
          <td>
            @if (v.sincronizado) { <span class="badge-ok">✓</span> }
            @else { <span class="badge-warn">Pendiente</span> }
          </td>
        </tr>
        }
      </tbody>
    </table>
    }
  </div>

  <!-- Resumen por producto -->
  <div class="panel">
    <div class="panel-h"><h3>Totales por producto</h3></div>
    <div class="panel-b">
      @if (totalesPorProducto().length === 0) {
        <p style="color:var(--mid);font-size:14px">Sin datos.</p>
      }
      @for (t of totalesPorProducto(); track t.nombre) {
      <div class="total-row">
        <span>{{ t.nombre }}</span>
        <strong>{{ t.total }} ud.</strong>
      </div>
      }
    </div>
  </div>

</div>
}
```

- [ ] **Step 3: Crear `inventario-ventas.component.scss`**

```scss
// src/app/pages/admin/inventario/inventario-ventas.component.scss
:host { display: block; }

.filter-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 20px;
  flex-wrap: wrap;

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--mid);
    text-transform: uppercase;
    letter-spacing: .04em;
    font-weight: 600;
  }
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
  th {
    text-align: left;
    padding: 10px 14px;
    color: var(--mid);
    font-weight: 500;
    border-bottom: 1px solid var(--line);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  td { padding: 12px 14px; border-bottom: 1px solid var(--line); }
}

.badge-ok   { font-size: 12px; color: #1F8A5B; }
.badge-warn { font-size: 12px; color: #B07820; }

.total-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  font-size: 13.5px;
  &:last-child { border-bottom: none; }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/admin/inventario/inventario-ventas.component.ts src/app/pages/admin/inventario/inventario-ventas.component.html src/app/pages/admin/inventario/inventario-ventas.component.scss
git commit -m "feat: add InventarioVentasComponent with date filter and totals"
```

---

## Fase 5 — App POS

### Task 12: Crear pos/index.html

**Files:**
- Create: `pos/index.html`
- Create: `pos/manifest.json`

- [ ] **Step 1: Crear directorio POS**

```bash
mkdir -p pos
```

- [ ] **Step 2: Crear `pos/manifest.json`**

```json
{
  "name": "Cuaquiverso POS",
  "short_name": "CuacPOS",
  "description": "Punto de venta para eventos Cuaquiverso",
  "start_url": "/pos/index.html",
  "display": "standalone",
  "background_color": "#0f1117",
  "theme_color": "#E8623D",
  "icons": [
    {
      "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦆</text></svg>",
      "sizes": "any",
      "type": "image/svg+xml"
    }
  ]
}
```

- [ ] **Step 3: Crear `pos/index.html`**

Reemplazar `PEGAR_SUPABASE_URL` y `PEGAR_ANON_KEY` con los valores del proyecto creado en Task 1.

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>Cuaquiverso POS</title>
  <link rel="manifest" href="manifest.json" />
  <meta name="theme-color" content="#E8623D" />
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:      #0f1117;
      --surface: #1a1f2e;
      --card:    #22293b;
      --text:    #f0f0f0;
      --mid:     #8a93a8;
      --terra:   #E8623D;
      --warn:    #B07820;
      --ok:      #1F8A5B;
      --line:    #2a3044;
      --radius:  12px;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100dvh;
    }
    /* ── Utility ─────────────────────────────────────────────────────── */
    .hidden { display: none !important; }
    .btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      border: none; border-radius: var(--radius); cursor: pointer;
      font-size: 16px; font-weight: 600; padding: 14px 20px;
      min-height: 52px; transition: opacity .12s;
      -webkit-tap-highlight-color: transparent;
    }
    .btn:active { opacity: .75; }
    .btn-primary { background: var(--terra); color: #fff; }
    .btn-ghost   { background: var(--surface); color: var(--text); border: 1px solid var(--line); }
    .btn-sm      { min-height: 40px; font-size: 14px; padding: 8px 16px; }
    .input {
      width: 100%; background: var(--surface); border: 1px solid var(--line);
      color: var(--text); border-radius: 8px; padding: 12px 14px; font-size: 16px;
    }
    .input:focus { outline: 2px solid var(--terra); border-color: transparent; }
    /* ── Header ──────────────────────────────────────────────────────── */
    .header {
      position: sticky; top: 0; z-index: 100;
      background: var(--surface); border-bottom: 1px solid var(--line);
      padding: 12px 16px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .header-brand { font-weight: 700; font-size: 15px; }
    .status-pill {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; padding: 4px 10px; border-radius: 20px;
      background: var(--card);
    }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .online  .status-dot { background: #1F8A5B; }
    .offline .status-dot { background: var(--terra); }
    /* ── Screens ─────────────────────────────────────────────────────── */
    .screen { padding: 24px 16px; max-width: 600px; margin: 0 auto; }
    .screen-title { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .screen-sub   { font-size: 14px; color: var(--mid); margin-bottom: 24px; }
    .field        { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .field label  { font-size: 12px; font-weight: 600; color: var(--mid); text-transform: uppercase; }
    /* ── Catálogo ─────────────────────────────────────────────────────── */
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 16px;
      max-width: 640px;
      margin: 0 auto;
    }
    .card {
      background: var(--card); border-radius: var(--radius);
      padding: 16px; display: flex; flex-direction: column; gap: 10px;
      border: 1px solid var(--line);
    }
    .card.agotado { opacity: .5; }
    .card-nombre { font-weight: 600; font-size: 15px; line-height: 1.3; }
    .card-cat    { font-size: 12px; color: var(--mid); text-transform: uppercase; }
    .card-precio { font-size: 18px; font-weight: 700; color: var(--terra); }
    .stock-row   { display: flex; align-items: center; justify-content: space-between; }
    .stock-num   { font-size: 13px; color: var(--mid); }
    .stock-low   { color: var(--warn); font-weight: 600; }
    .stock-out   { color: var(--terra); font-weight: 600; }
    .vender-btn {
      background: var(--terra); color: #fff;
      border: none; border-radius: 8px;
      padding: 12px; font-size: 18px; font-weight: 700;
      cursor: pointer; min-height: 48px;
      -webkit-tap-highlight-color: transparent;
      transition: opacity .12s;
    }
    .vender-btn:active { opacity: .75; }
    .vender-btn:disabled { background: var(--line); color: var(--mid); cursor: default; }
    /* ── Modal ───────────────────────────────────────────────────────── */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.7);
      display: flex; align-items: flex-end; justify-content: center;
      z-index: 200; padding: 0 0 env(safe-area-inset-bottom);
    }
    .modal-box {
      background: var(--surface); border-radius: var(--radius) var(--radius) 0 0;
      padding: 24px 20px; width: 100%; max-width: 480px;
    }
    .modal-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .modal-sub   { font-size: 13px; color: var(--mid); margin-bottom: 20px; }
    .qty-row     { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .qty-btn     { width: 48px; height: 48px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); font-size: 22px; cursor: pointer; }
    .qty-input   { flex: 1; text-align: center; font-size: 24px; font-weight: 700; }
    .modal-btns  { display: flex; gap: 10px; }
    /* ── Toast ───────────────────────────────────────────────────────── */
    .toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #1F8A5B; color: #fff; padding: 12px 24px;
      border-radius: 24px; font-size: 14px; font-weight: 600;
      z-index: 300; pointer-events: none;
      animation: slideUp .2s ease;
    }
    .toast.error { background: var(--terra); }
    @keyframes slideUp { from { opacity:0; transform: translateX(-50%) translateY(10px); } }
  </style>
</head>
<body>

<!-- ── Pantalla 0: Nombre del dispositivo ─────────────────────────────── -->
<div id="screen-device" class="screen hidden">
  <div class="screen-title">Bienvenido al POS</div>
  <p class="screen-sub">¿Cómo se llama este dispositivo? Se usará para identificar las ventas.</p>
  <div class="field">
    <label>Nombre del dispositivo</label>
    <input class="input" id="device-input" type="text" placeholder="celular-nathali" autocomplete="off" />
  </div>
  <button class="btn btn-primary" onclick="confirmarDispositivo()">Confirmar y continuar</button>
</div>

<!-- ── Pantalla 1: Login ───────────────────────────────────────────────── -->
<div id="screen-login" class="screen hidden">
  <div class="screen-title">Iniciar sesión</div>
  <p class="screen-sub">Ingresa con la cuenta del equipo Cuaquiverso.</p>
  <div class="field">
    <label>Correo</label>
    <input class="input" id="login-email" type="email" value="designcuac@gmail.com" autocomplete="email" />
  </div>
  <div class="field">
    <label>Contraseña</label>
    <input class="input" id="login-pass" type="password" autocomplete="current-password" />
  </div>
  <p id="login-error" style="color:var(--terra);font-size:13px;margin-bottom:12px;display:none"></p>
  <button class="btn btn-primary" id="login-btn" onclick="hacerLogin()">Entrar</button>
</div>

<!-- ── Pantalla 2: Catálogo ──────────────────────────────────────────── -->
<div id="screen-catalogo" class="hidden">
  <div class="header">
    <div class="header-brand">Cuaquiverso POS · sofa-2026</div>
    <div style="display:flex;align-items:center;gap:8px">
      <span id="device-label" style="font-size:12px;color:var(--mid)"></span>
      <div id="status-pill" class="status-pill online">
        <div class="status-dot"></div>
        <span id="status-text">Conectado</span>
      </div>
    </div>
  </div>
  <div id="grid" class="grid"></div>
</div>

<!-- ── Modal de venta ─────────────────────────────────────────────────── -->
<div id="modal" class="modal-overlay hidden">
  <div class="modal-box">
    <div class="modal-title" id="modal-nombre"></div>
    <div class="modal-sub" id="modal-stock"></div>
    <div class="qty-row">
      <button class="qty-btn" onclick="cambiarQty(-1)">−</button>
      <input class="input qty-input" id="qty-input" type="number" value="1" min="1" />
      <button class="qty-btn" onclick="cambiarQty(+1)">+</button>
    </div>
    <div class="modal-btns">
      <button class="btn btn-primary" style="flex:1" onclick="confirmarVenta()">Registrar venta</button>
      <button class="btn btn-ghost btn-sm" onclick="cerrarModal()">Cancelar</button>
    </div>
  </div>
</div>

<script type="module">
// ── Config ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'PEGAR_SUPABASE_URL';
const SUPABASE_KEY = 'PEGAR_ANON_KEY';
const EVENTO_ID    = 'sofa-2026';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Estado global ──────────────────────────────────────────────────────────
let productos    = [];
let modalProducto = null;
let colaOffline  = JSON.parse(localStorage.getItem('pos_offline_queue') ?? '[]');

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  const device = localStorage.getItem('pos_device_name');
  if (!device) { mostrar('screen-device'); return; }

  document.getElementById('device-label').textContent = device;

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { mostrar('screen-login'); return; }

  await cargarCatalogo();
  suscribirRealtime();
  initConexion();
}

// ── Navegación ─────────────────────────────────────────────────────────────
function mostrar(id) {
  ['screen-device','screen-login','screen-catalogo'].forEach(s => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}

// ── Dispositivo ────────────────────────────────────────────────────────────
window.confirmarDispositivo = function() {
  const val = document.getElementById('device-input').value.trim();
  if (!val) return;
  localStorage.setItem('pos_device_name', val);
  document.getElementById('device-label').textContent = val;
  mostrar('screen-login');
};

// ── Auth ───────────────────────────────────────────────────────────────────
window.hacerLogin = async function() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const btn   = document.getElementById('login-btn');
  const err   = document.getElementById('login-error');

  btn.textContent = 'Entrando…';
  btn.disabled = true;
  err.style.display = 'none';

  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.textContent = 'Entrar';
  btn.disabled = false;

  if (error) {
    err.textContent = 'Credenciales incorrectas. Intenta de nuevo.';
    err.style.display = 'block';
    return;
  }
  await cargarCatalogo();
  suscribirRealtime();
  initConexion();
};

// ── Catálogo ───────────────────────────────────────────────────────────────
async function cargarCatalogo() {
  const { data, error } = await sb
    .from('productos_evento')
    .select('*')
    .eq('evento_id', EVENTO_ID)
    .eq('activo', true)
    .order('nombre');

  if (error) { mostrarToast('Error al cargar productos', true); return; }
  productos = data ?? [];
  renderGrid();
  mostrar('screen-catalogo');
}

function renderGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  for (const p of productos) {
    const agotado = p.stock_actual <= 0;
    const bajo    = !agotado && p.stock_actual < 3;
    const card    = document.createElement('div');
    card.className = 'card' + (agotado ? ' agotado' : '');
    card.innerHTML = `
      <div>
        <div class="card-cat">${p.categoria}</div>
        <div class="card-nombre">${p.nombre}</div>
      </div>
      <div class="card-precio">${fmtCOP(p.precio)}</div>
      <div class="stock-row">
        <span class="stock-num ${agotado ? 'stock-out' : bajo ? 'stock-low' : ''}">
          ${agotado ? 'Agotado' : bajo ? `⚠ ${p.stock_actual} ud.` : `${p.stock_actual} ud.`}
        </span>
      </div>
      <button class="vender-btn" ${agotado ? 'disabled' : ''} data-id="${p.id}">
        ${agotado ? 'Agotado' : '− 1'}
      </button>
    `;
    card.querySelector('.vender-btn')?.addEventListener('click', () => {
      if (!agotado) abrirModal(p);
    });
    grid.appendChild(card);
  }
}

function actualizarCardStock(updatedProduct) {
  const idx = productos.findIndex(p => p.id === updatedProduct.id);
  if (idx !== -1) {
    productos[idx] = { ...productos[idx], stock_actual: updatedProduct.stock_actual };
    renderGrid();
  }
}

// ── Modal ──────────────────────────────────────────────────────────────────
function abrirModal(p) {
  modalProducto = p;
  document.getElementById('modal-nombre').textContent = p.nombre;
  document.getElementById('modal-stock').textContent  = `Stock disponible: ${p.stock_actual} unidades`;
  document.getElementById('qty-input').value = 1;
  document.getElementById('modal').classList.remove('hidden');
}

window.cerrarModal = function() {
  document.getElementById('modal').classList.add('hidden');
  modalProducto = null;
};

window.cambiarQty = function(delta) {
  const input = document.getElementById('qty-input');
  const val   = Math.max(1, (parseInt(input.value) || 1) + delta);
  input.value = val;
};

window.confirmarVenta = async function() {
  if (!modalProducto) return;
  const cantidad = Math.max(1, parseInt(document.getElementById('qty-input').value) || 1);
  const device   = localStorage.getItem('pos_device_name') ?? 'desconocido';

  cerrarModal();

  const venta = {
    producto_id:  modalProducto.id,
    cantidad,
    dispositivo:  device,
    vendido_en:   new Date().toISOString(),
    sincronizado: false,
  };

  if (!navigator.onLine) {
    colaOffline.push(venta);
    localStorage.setItem('pos_offline_queue', JSON.stringify(colaOffline));
    actualizarStockLocal(modalProducto.id, cantidad);
    actualizarIndicador();
    mostrarToast(`Guardada offline (${colaOffline.length} pendientes)`);
    return;
  }

  await registrarVenta(venta);
};

async function registrarVenta(venta) {
  const { error: errInsert } = await sb.from('ventas_evento').insert({
    ...venta, sincronizado: true
  });
  if (errInsert) { mostrarToast('Error al registrar venta', true); return; }

  const { error: errStock } = await sb.rpc('decrementar_stock_seguro', {
    p_producto_id: venta.producto_id,
    p_cantidad:    venta.cantidad,
  });
  if (errStock) { mostrarToast('Venta registrada pero error de stock', true); return; }

  actualizarStockLocal(venta.producto_id, venta.cantidad);
  mostrarToast('✓ Venta registrada');
}

function actualizarStockLocal(productoId, cantidad) {
  const idx = productos.findIndex(p => p.id === productoId);
  if (idx !== -1) {
    productos[idx].stock_actual = Math.max(0, productos[idx].stock_actual - cantidad);
    renderGrid();
  }
}

// ── Offline ────────────────────────────────────────────────────────────────
function initConexion() {
  actualizarIndicador();
  window.addEventListener('online',  async () => {
    actualizarIndicador();
    await procesarCola();
  });
  window.addEventListener('offline', actualizarIndicador);
}

function actualizarIndicador() {
  const pill = document.getElementById('status-pill');
  const txt  = document.getElementById('status-text');
  const pendientes = colaOffline.length;

  if (navigator.onLine) {
    pill.className = 'status-pill online';
    txt.textContent = pendientes > 0 ? `Conectado · ${pendientes} pendientes` : 'Conectado';
  } else {
    pill.className = 'status-pill offline';
    txt.textContent = pendientes > 0 ? `Sin conexión · ${pendientes} pendientes` : 'Sin conexión';
  }
}

async function procesarCola() {
  if (colaOffline.length === 0) return;
  const cola = [...colaOffline];
  colaOffline = [];
  localStorage.removeItem('pos_offline_queue');

  let ok = 0;
  for (const venta of cola) {
    const { error } = await sb.from('ventas_evento').insert({ ...venta, sincronizado: true });
    if (!error) {
      await sb.rpc('decrementar_stock_seguro', {
        p_producto_id: venta.producto_id,
        p_cantidad:    venta.cantidad,
      });
      ok++;
    } else {
      colaOffline.push(venta);
    }
  }
  if (colaOffline.length > 0) localStorage.setItem('pos_offline_queue', JSON.stringify(colaOffline));
  if (ok > 0) mostrarToast(`✓ ${ok} ventas sincronizadas`);
  actualizarIndicador();
}

// ── Realtime ───────────────────────────────────────────────────────────────
function suscribirRealtime() {
  sb.channel('stock-live')
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'productos_evento'
    }, payload => actualizarCardStock(payload.new))
    .subscribe();
}

// ── Toast ──────────────────────────────────────────────────────────────────
function mostrarToast(msg, isError = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' error' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ── Utils ──────────────────────────────────────────────────────────────────
function fmtCOP(n) {
  return '$' + Number(n).toLocaleString('es-CO');
}

// ── Arrancar ───────────────────────────────────────────────────────────────
init();
</script>
</body>
</html>
```

- [ ] **Step 4: Actualizar las credenciales en pos/index.html**

Reemplazar en el script:
```js
const SUPABASE_URL = 'https://<ref>.supabase.co';   // valor real del Task 1
const SUPABASE_KEY = '<anon-key>';                   // valor real del Task 1
```

- [ ] **Step 5: Verificar el POS en móvil**

Abrir `pos/index.html` directamente en el navegador (puede servirse con cualquier servidor estático):

```bash
npx serve pos -p 3001
```

Abrir `http://localhost:3001` en el móvil (o usando la IP local).

Verificar flujo completo:
1. Primer arranque → pide nombre del dispositivo
2. → login con email/password
3. → aparece el catálogo con los productos creados desde el admin
4. → tap en "− 1" → modal → confirmar → toast verde

- [ ] **Step 6: Commit final**

```bash
git add pos/index.html pos/manifest.json
git commit -m "feat: add POS standalone app with offline mode and Realtime"
```

---

## Verificación end-to-end

Flujo completo para confirmar que todo funciona:

1. Abrir `http://localhost:4200/admin` → login con Google
2. Ir a Inventario → crear 3 productos de prueba (un tote, un llavero, un sticker)
3. Abrir POS en móvil → login con password
4. En el POS: registrar una venta de cada producto
5. En el admin: ir a Inventario → confirmar que stock_actual bajó
6. En el admin: ir a Log de ventas → confirmar que aparecen las 3 ventas con el nombre del dispositivo
7. Poner el móvil en modo avión → intentar venta → confirmar toast "Guardada offline"
8. Desactivar modo avión → confirmar que la cola se sincroniza automáticamente
