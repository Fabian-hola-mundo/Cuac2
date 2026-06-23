# Restock + Historial de Movimientos de Producto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Restock" action to the products table actions column and a per-product activity history (creation, restocks, sales) visible in the product detail drawer.

**Architecture:** A new Supabase table `producto_movimientos` logs creation and restock events (sales stay in the existing `ventas_evento` table, untouched). An atomic RPC `registrar_restock` updates `stock_actual` and inserts the log row in one call. A DB trigger auto-logs creation. The Angular service merges `producto_movimientos` + `ventas_evento` client-side for display. UI follows the existing confirm-dialog and drawer patterns already used for "Finalizar evento" and the product detail drawer.

**Tech Stack:** Angular standalone components (signals), Supabase (Postgres + `@supabase/supabase-js`), SCSS (global admin stylesheet at `src/styles/_admin.scss`).

## Global Constraints

- Spec source: `docs/superpowers/specs/2026-06-23-restock-historial-productos-design.md`.
- Do not modify the sales flow (`ventas_evento`, `decrementar_stock_seguro`). Sales are read-only inputs to the historial, never duplicated into `producto_movimientos`.
- `producto_movimientos.tipo` is `'creacion' | 'restock' | 'ajuste'`. `'ajuste'` is schema-only for now — no UI exposes it yet (YAGNI per spec).
- Follow existing RLS convention: `FOR ALL USING (auth.email() = 'designcuac@gmail.com')`, matching `solo_admin_productos` / `solo_admin_ventas` in `supabase/migrations/001_inventario.sql`.
- Follow existing SQL function convention: `LANGUAGE sql SECURITY INVOKER` for the RPC (matches `decrementar_stock_seguro`), since the caller is always an authenticated admin already passing RLS — do not introduce `SECURITY DEFINER`.
- This project has no automated test suite for services/components (only the Angular CLI default `src/app/app.spec.ts` exists). Verification in this plan uses: (a) the Supabase MCP tools to apply/verify the migration directly against the live project, (b) `ng build` for type-check, and (c) manual browser verification per the project's established workflow — not Karma/Jasmine unit tests.
- This project's Supabase project URL is `https://ytqcwrjxlnlsjgnjxiiw.supabase.co` (`src/environments/environment.ts:2`). Use `mcp__claude_ai_Supabase__list_projects` to resolve the matching `project_id` before calling other Supabase MCP tools.

---

### Task 1: Database — `producto_movimientos` table, creation trigger, restock RPC

**Files:**
- Create: `supabase/migrations/010_producto_movimientos.sql`

**Interfaces:**
- Produces: table `producto_movimientos(id, producto_id, tipo, cantidad, nota, creado_en)`; RPC `registrar_restock(p_producto_id uuid, p_cantidad integer, p_nota text default null) returns void`. Task 2's service calls this RPC and selects from this table by exact name.

- [ ] **Step 1: Write the migration file**

```sql
-- 010_producto_movimientos.sql
-- Historial de movimientos de stock por producto (creación, restock, ajuste manual).
-- Las ventas NO se duplican aquí: siguen viviendo solo en ventas_evento y se
-- combinan con esta tabla en el cliente (InventarioService.getHistorialProducto).

CREATE TABLE producto_movimientos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id  uuid NOT NULL REFERENCES productos_evento(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN ('creacion','restock','ajuste')),
  cantidad     integer NOT NULL,
  nota         text,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_producto_movimientos_producto ON producto_movimientos(producto_id, creado_en DESC);

-- Trigger: registra automáticamente el movimiento de creación al insertar un producto
CREATE OR REPLACE FUNCTION registrar_creacion_producto()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  INSERT INTO producto_movimientos (producto_id, tipo, cantidad)
  VALUES (NEW.id, 'creacion', NEW.stock_inicial);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_producto_creado
  AFTER INSERT ON productos_evento
  FOR EACH ROW
  EXECUTE FUNCTION registrar_creacion_producto();

-- RPC atómica: suma stock y registra el movimiento de restock en una sola llamada
CREATE OR REPLACE FUNCTION registrar_restock(
  p_producto_id uuid,
  p_cantidad    integer,
  p_nota        text DEFAULT NULL
) RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
  UPDATE productos_evento
  SET stock_actual = stock_actual + p_cantidad
  WHERE id = p_producto_id;

  INSERT INTO producto_movimientos (producto_id, tipo, cantidad, nota)
  VALUES (p_producto_id, 'restock', p_cantidad, p_nota);
$$;

-- RLS — mismo patrón que solo_admin_productos / solo_admin_ventas
ALTER TABLE producto_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solo_admin_movimientos" ON producto_movimientos
  FOR ALL USING (auth.email() = 'designcuac@gmail.com');
```

- [ ] **Step 2: Resolve the Supabase project_id**

Call `mcp__claude_ai_Supabase__list_projects` and find the project whose URL/ref matches `ytqcwrjxlnlsjgnjxiiw` (the host in `src/environments/environment.ts:2`). Note the `project_id` for the next steps.

- [ ] **Step 3: Apply the migration**

Call `mcp__claude_ai_Supabase__apply_migration` with:
- `project_id`: the id from Step 2
- `name`: `producto_movimientos`
- `query`: the full SQL from Step 1

Expected: tool returns success, no error.

- [ ] **Step 4: Verify the trigger fires on creation**

Call `mcp__claude_ai_Supabase__execute_sql` with `project_id` from Step 2 and this query:

```sql
WITH t AS (
  INSERT INTO productos_evento (evento_id, nombre, categoria, precio, stock_inicial)
  VALUES ('test-plan-verify', 'TEST_PLAN_PRODUCTO', 'tee', 1000, 7)
  RETURNING id
)
SELECT pm.tipo, pm.cantidad, pm.producto_id = t.id AS matches_product
FROM t, producto_movimientos pm
WHERE pm.producto_id = t.id;
```

Expected: one row, `tipo = 'creacion'`, `cantidad = 7`, `matches_product = true`.

- [ ] **Step 5: Verify the restock RPC is atomic and correct**

Call `mcp__claude_ai_Supabase__execute_sql` with:

```sql
SELECT registrar_restock(
  (SELECT id FROM productos_evento WHERE nombre = 'TEST_PLAN_PRODUCTO'),
  15,
  'verificación plan'
);

SELECT stock_actual FROM productos_evento WHERE nombre = 'TEST_PLAN_PRODUCTO';

SELECT tipo, cantidad, nota FROM producto_movimientos
WHERE producto_id = (SELECT id FROM productos_evento WHERE nombre = 'TEST_PLAN_PRODUCTO')
ORDER BY creado_en;
```

Expected: `stock_actual = 22` (7 + 15); two rows in `producto_movimientos` — `('creacion', 7, NULL)` and `('restock', 15, 'verificación plan')`.

- [ ] **Step 6: Clean up the test product**

Call `mcp__claude_ai_Supabase__execute_sql` with:

```sql
DELETE FROM productos_evento WHERE nombre = 'TEST_PLAN_PRODUCTO';
```

Expected: the `ON DELETE CASCADE` on `producto_movimientos.producto_id` removes its log rows too. Verify with:

```sql
SELECT count(*) FROM producto_movimientos
WHERE producto_id = (SELECT id FROM productos_evento WHERE nombre = 'TEST_PLAN_PRODUCTO');
```

Expected: `0` (and the outer `SELECT id FROM productos_evento WHERE nombre = 'TEST_PLAN_PRODUCTO'` itself returns no row, since the product was deleted).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/010_producto_movimientos.sql
git commit -m "feat(db): tabla producto_movimientos con trigger de creación y RPC de restock"
```

---

### Task 2: Service layer — `InventarioService.restockProducto` and `getHistorialProducto`

**Files:**
- Modify: `src/app/core/services/inventario.service.ts`

**Interfaces:**
- Consumes: Supabase RPC `registrar_restock` and table `producto_movimientos` from Task 1; existing `ventas_evento` table (already used by `getVentas`).
- Produces: `export interface MovimientoProducto { tipo: 'creacion' | 'restock' | 'ajuste' | 'venta'; cantidad: number; nota: string | null; fecha: string; }`, `restockProducto(productoId: string, cantidad: number, nota?: string): Promise<{ error: string | null }>`, `getHistorialProducto(productoId: string): Promise<MovimientoProducto[]>`. Task 3 calls these by these exact names/signatures.

- [ ] **Step 1: Add the `MovimientoProducto` interface**

In `src/app/core/services/inventario.service.ts`, after the `VentaEvento` interface (after line 34), add:

```ts
export interface MovimientoProducto {
  tipo: 'creacion' | 'restock' | 'ajuste' | 'venta';
  cantidad: number;   // positivo = entrada de stock, negativo = salida (venta)
  nota: string | null;
  fecha: string;       // ISO timestamp
}
```

- [ ] **Step 2: Add `restockProducto` and `getHistorialProducto` to `InventarioService`**

In `src/app/core/services/inventario.service.ts`, add these two methods inside the `InventarioService` class, right after `toggleActivo` (after line 173):

```ts
  async restockProducto(
    productoId: string,
    cantidad: number,
    nota?: string
  ): Promise<{ error: string | null }> {
    const { error } = await this.sb.db.rpc('registrar_restock', {
      p_producto_id: productoId,
      p_cantidad: cantidad,
      p_nota: nota || null,
    });
    if (error) return { error: error.message };
    await this.cargarTodos();
    return { error: null };
  }

  async getHistorialProducto(productoId: string): Promise<MovimientoProducto[]> {
    const [movRes, ventasRes] = await Promise.all([
      this.sb.db
        .from('producto_movimientos')
        .select('tipo, cantidad, nota, creado_en')
        .eq('producto_id', productoId),
      this.sb.db
        .from('ventas_evento')
        .select('cantidad, vendido_en')
        .eq('producto_id', productoId),
    ]);
    if (movRes.error) throw movRes.error;
    if (ventasRes.error) throw ventasRes.error;

    const movimientos: MovimientoProducto[] = (movRes.data ?? []).map(m => ({
      tipo: m.tipo as MovimientoProducto['tipo'],
      cantidad: m.cantidad,
      nota: m.nota ?? null,
      fecha: m.creado_en,
    }));

    const ventas: MovimientoProducto[] = (ventasRes.data ?? []).map(v => ({
      tipo: 'venta' as const,
      cantidad: -v.cantidad,
      nota: null,
      fecha: v.vendido_en,
    }));

    return [...movimientos, ...ventas].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }
```

- [ ] **Step 3: Type-check**

Run: `npx ng build --configuration development`
Expected: build succeeds (exit code 0), no new errors. The project has pre-existing unrelated `NG8102`/`NG8113` warnings in other files — those are expected and not caused by this change.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/services/inventario.service.ts
git commit -m "feat(inventario): agrega restockProducto y getHistorialProducto al servicio"
```

---

### Task 3: Component logic — restock dialog and historial loading

**Files:**
- Modify: `src/app/pages/admin/productos/productos-list.component.ts`

**Interfaces:**
- Consumes: `InventarioService.restockProducto`, `InventarioService.getHistorialProducto`, `MovimientoProducto` from Task 2.
- Produces: signals `restockOpen`, `restockTarget`, `restockLoading`, `restockError`, `historial`, `historialCargando`; fields `restockCantidad: number | null`, `restockNota: string`; methods `abrirRestock(p, event)`, `cerrarRestock()`, `confirmarRestock()`, `historialLabel(tipo)`, `historialBadgeClass(tipo)`, `fmtFecha(iso)`. Task 4's template binds to these exact names.

- [ ] **Step 1: Update the import line**

In `src/app/pages/admin/productos/productos-list.component.ts:5`, change:

```ts
import { InventarioService, ProductoEvento, CATEGORIAS, CAT_TONES } from '../../../core/services/inventario.service';
```

to:

```ts
import { InventarioService, ProductoEvento, MovimientoProducto, CATEGORIAS, CAT_TONES } from '../../../core/services/inventario.service';
```

- [ ] **Step 2: Add restock and historial state**

In `src/app/pages/admin/productos/productos-list.component.ts`, after the `drawerProduct` signal declaration (after line 47), add:

```ts
  // Restock
  restockOpen     = signal(false);
  restockTarget   = signal<ProductoEvento | null>(null);
  restockCantidad: number | null = null;
  restockNota     = '';
  restockLoading  = signal(false);
  restockError    = signal<string | null>(null);

  // Historial (drawer)
  historial          = signal<MovimientoProducto[]>([]);
  historialCargando  = signal(false);
```

- [ ] **Step 3: Load historial when the drawer opens**

In `src/app/pages/admin/productos/productos-list.component.ts`, replace the existing `verDetalle` method (lines 74-78):

```ts
  verDetalle(p: ProductoEvento, event: Event) {
    event.stopPropagation();
    this.drawerProduct.set(p);
    this.drawerOpen.set(true);
  }
```

with:

```ts
  verDetalle(p: ProductoEvento, event: Event) {
    event.stopPropagation();
    this.drawerProduct.set(p);
    this.drawerOpen.set(true);
    this.cargarHistorial(p.id);
  }

  private async cargarHistorial(productoId: string) {
    this.historialCargando.set(true);
    this.historial.set(await this.inv.getHistorialProducto(productoId));
    this.historialCargando.set(false);
  }
```

- [ ] **Step 4: Add restock open/close/confirm methods**

In `src/app/pages/admin/productos/productos-list.component.ts`, right after `toggleActivo` (after line 91), add:

```ts
  abrirRestock(p: ProductoEvento, event: Event) {
    event.stopPropagation();
    this.restockTarget.set(p);
    this.restockCantidad = null;
    this.restockNota = '';
    this.restockError.set(null);
    this.restockOpen.set(true);
  }

  cerrarRestock() { this.restockOpen.set(false); }

  async confirmarRestock() {
    const p = this.restockTarget();
    if (!p) return;
    const cantidad = this.restockCantidad;
    if (!cantidad || cantidad <= 0) {
      this.restockError.set('Ingresa una cantidad mayor a 0.');
      return;
    }
    this.restockLoading.set(true);
    this.restockError.set(null);
    const { error } = await this.inv.restockProducto(p.id, cantidad, this.restockNota.trim() || undefined);
    this.restockLoading.set(false);
    if (error) { this.restockError.set(error); return; }
    this.cerrarRestock();
    this.flash(`+${cantidad} unidades agregadas a "${p.nombre}".`);
    if (this.drawerProduct()?.id === p.id) this.cargarHistorial(p.id);
  }
```

- [ ] **Step 5: Add historial display helpers**

In `src/app/pages/admin/productos/productos-list.component.ts`, after the existing `toneForCat` method (after line 137), add:

```ts
  historialLabel(tipo: MovimientoProducto['tipo']): string {
    return { creacion: 'Creación', restock: 'Restock', ajuste: 'Ajuste', venta: 'Venta' }[tipo];
  }

  historialBadgeClass(tipo: MovimientoProducto['tipo']): string {
    return { creacion: 'rio', restock: 'ok', ajuste: 'warn', venta: 'lila' }[tipo];
  }

  fmtFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
```

- [ ] **Step 6: Type-check**

Run: `npx ng build --configuration development`
Expected: build succeeds, no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/admin/productos/productos-list.component.ts
git commit -m "feat(productos): lógica de restock y carga de historial en el componente"
```

---

### Task 4: Template — restock icon/dialog and historial section

**Files:**
- Modify: `src/app/pages/admin/productos/productos-list.component.html`

**Interfaces:**
- Consumes: signals/methods produced by Task 3 (`restockOpen`, `restockTarget`, `restockCantidad`, `restockNota`, `restockLoading`, `restockError`, `abrirRestock`, `cerrarRestock`, `confirmarRestock`, `historial`, `historialCargando`, `historialLabel`, `historialBadgeClass`, `fmtFecha`).

- [ ] **Step 1: Add the restock icon button to the actions column**

In `src/app/pages/admin/productos/productos-list.component.html`, after the "Duplicar" button (after line 115, before the `<!-- Ocultar / Mostrar -->` comment on line 116), add:

```html
          <!-- Restock -->
          <button class="icon-act" title="Restock" (click)="abrirRestock(p, $event)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
          </button>
```

- [ ] **Step 2: Add the historial section to the detail drawer**

In `src/app/pages/admin/productos/productos-list.component.html`, the `.kv-list` inside `.drawer-b` currently ends at line 167 (`</div>`) right before `</div>` closing `.drawer-b` (line 168) and `<div class="drawer-f">` (line 169). Replace lines 159-168:

```html
    <div class="drawer-b">
      <div class="kv-list">
        <div class="kv"><span class="k">Categoría</span><span class="v">{{ labelCategoria(drawerProduct()!.categoria) }}</span></div>
        <div class="kv"><span class="k">Personaje</span><span class="v">{{ drawerProduct()!.personaje || '—' }}</span></div>
        <div class="kv"><span class="k">Precio</span><span class="v">{{ fmtCOP(drawerProduct()!.precio) }}</span></div>
        <div class="kv"><span class="k">Stock inicial</span><span class="v">{{ drawerProduct()!.stock_inicial }}</span></div>
        <div class="kv"><span class="k">Stock actual</span><span class="v">{{ drawerProduct()!.stock_actual }}</span></div>
        <div class="kv"><span class="k">Estado</span><span class="v">{{ drawerProduct()!.activo ? 'Activo' : 'Inactivo' }}</span></div>
      </div>
    </div>
```

with:

```html
    <div class="drawer-b">
      <div class="kv-list">
        <div class="kv"><span class="k">Categoría</span><span class="v">{{ labelCategoria(drawerProduct()!.categoria) }}</span></div>
        <div class="kv"><span class="k">Personaje</span><span class="v">{{ drawerProduct()!.personaje || '—' }}</span></div>
        <div class="kv"><span class="k">Precio</span><span class="v">{{ fmtCOP(drawerProduct()!.precio) }}</span></div>
        <div class="kv"><span class="k">Stock inicial</span><span class="v">{{ drawerProduct()!.stock_inicial }}</span></div>
        <div class="kv"><span class="k">Stock actual</span><span class="v">{{ drawerProduct()!.stock_actual }}</span></div>
        <div class="kv"><span class="k">Estado</span><span class="v">{{ drawerProduct()!.activo ? 'Activo' : 'Inactivo' }}</span></div>
      </div>

      <h3 style="font-family:var(--display);font-size:16px;margin:var(--s-5) 0 var(--s-2)">Historial</h3>
      @if (historialCargando()) {
        <p style="color:var(--carbon-50);font-size:13px;padding:8px 0">Cargando historial…</p>
      } @else if (historial().length === 0) {
        <p style="color:var(--carbon-50);font-size:13px;padding:8px 0">Sin movimientos registrados.</p>
      } @else {
        <div class="kv-list">
          @for (m of historial(); track m.fecha + m.tipo + m.cantidad) {
            <div class="kv">
              <span class="k" style="display:flex;align-items:center;gap:8px;text-transform:none;font-family:var(--sans);font-size:12.5px">
                <span [class]="'badge ' + historialBadgeClass(m.tipo)">{{ historialLabel(m.tipo) }}</span>
                {{ fmtFecha(m.fecha) }}
              </span>
              <span class="v" [style.color]="m.cantidad >= 0 ? 'var(--selva)' : 'var(--terra)'">
                {{ m.cantidad >= 0 ? '+' : '' }}{{ m.cantidad }}
              </span>
            </div>
          }
        </div>
      }
    </div>
```

- [ ] **Step 3: Add the restock confirmation dialog**

In `src/app/pages/admin/productos/productos-list.component.html`, after the "Dialog: Finalizar evento" block closes (after line 221, before the final newline/EOF), add:

```html

<!-- Dialog: Restock -->
@if (restockOpen()) {
  <div class="drawer-back on" (click)="cerrarRestock()"></div>
  <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:202;background:var(--paper);border:1px solid var(--carbon-08);border-radius:var(--r-lg);padding:var(--s-6);width:440px;max-width:90vw;box-shadow:0 20px 60px rgba(21,31,40,0.25)">
    <h3 style="font-family:var(--display);font-size:22px;letter-spacing:-0.01em;margin-bottom:var(--s-2)">Restock</h3>
    <p style="color:var(--carbon-70);font-size:13.5px;margin-bottom:var(--s-4)">
      Agregar unidades a <strong>{{ restockTarget()?.nombre }}</strong>. Stock actual: {{ restockTarget()?.stock_actual }}.
    </p>
    <div class="field" style="margin-bottom:var(--s-3)">
      <label style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--carbon-70);font-weight:500">Cantidad a agregar</label>
      <input class="input" type="number" min="1" [(ngModel)]="restockCantidad" placeholder="Ej: 20" style="margin-top:6px" />
    </div>
    <div class="field" style="margin-bottom:var(--s-4)">
      <label style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--carbon-70);font-weight:500">Nota (opcional)</label>
      <input class="input" type="text" [(ngModel)]="restockNota" placeholder="Ej: Reposición proveedor X" style="margin-top:6px" />
    </div>
    @if (restockError()) {
      <p style="color:var(--terra);font-size:13px;margin-bottom:var(--s-3)">{{ restockError() }}</p>
    }
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn-sm ghost" (click)="cerrarRestock()">Cancelar</button>
      <button class="btn-sm solid" [disabled]="restockLoading()" (click)="confirmarRestock()">
        {{ restockLoading() ? 'Guardando…' : 'Confirmar restock' }}
      </button>
    </div>
  </div>
}
```

- [ ] **Step 4: Type-check**

Run: `npx ng build --configuration development`
Expected: build succeeds, no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/productos/productos-list.component.html
git commit -m "feat(productos): UI de restock y sección de historial en el drawer"
```

---

### Task 5: Manual end-to-end verification in the browser

**Files:** none (verification only).

**Interfaces:** none — this task exercises Tasks 1-4 together.

- [ ] **Step 1: Start the dev server**

Run: `npx ng serve --port 4399` (or any free port)
Expected: compiles successfully, server listening on the chosen port.

- [ ] **Step 2: Log into the admin and open Productos**

Navigate to `http://localhost:4399/admin`, log in with the admin password flow, go to "Productos".
Expected: the products table loads with the existing columns plus the new restock icon (a "+" inside a circle) in the Acciones column, after the duplicate icon and before the show/hide icon.

- [ ] **Step 3: Restock a product**

Click the restock icon on any product row. In the dialog, enter a quantity (e.g. `5`) and an optional note, click "Confirmar restock".
Expected: dialog closes, a toast reading "+5 unidades agregadas a "<nombre>"." appears, and the row's "Stock actual" column updates to reflect the new total immediately (table reloads via `cargarTodos()` inside `restockProducto`).

- [ ] **Step 4: Check validation**

Click the restock icon again, leave the quantity field empty, click "Confirmar restock".
Expected: inline error "Ingresa una cantidad mayor a 0." appears, dialog stays open, no request is sent.

- [ ] **Step 5: Check the historial in the drawer**

Click the "Ver detalle" (eye) icon on the same product you restocked in Step 3.
Expected: drawer opens, shows the existing Categoría/Personaje/Precio/Stock/Estado rows, then a "Historial" section below with at least two rows: a "Creación" badge (blue/`rio`) with the original `stock_inicial` quantity, and a "Restock" badge (green/`ok`) with `+5` and the note you entered, sorted most-recent first. If that product has any prior sales in `ventas_evento`, a "Venta" badge (purple/`lila`) row should also appear with a negative quantity.

- [ ] **Step 6: Stop the dev server**

Stop the `ng serve` process started in Step 1.

- [ ] **Step 7: Final report**

Summarize in the conversation: build status, the 3 commits created (Tasks 1, 2, 3+4), and confirmation that Steps 3-5 above behaved as expected. Do not mark the plan complete if any expectation in Steps 3-5 did not hold — return to the relevant task instead.
