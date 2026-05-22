# Spec: Sistema de Inventario para Eventos + App POS
**Fecha:** 2026-05-22  
**Proyecto:** cuac-design (Angular 21)  
**Primer evento:** sofa-2026

---

## 1. Contexto y objetivo

Cuaquiverso necesita un sistema para gestionar y vender merch físico en eventos presenciales. El sistema tiene dos partes:

1. **Panel admin** (`/admin/inventario`) — gestión de productos y visualización de ventas
2. **App POS** (`pos/index.html`) — punto de venta móvil, funciona offline

Ambas partes comparten el mismo backend en Supabase.

---

## 2. Supabase

### 2.1 Proyecto

- **Nombre:** `cuaquiverso-pos`
- **Región:** sa-east-1 (São Paulo, menor latencia desde Colombia)
- **Proyecto nuevo:** sí — ninguno de los existentes corresponde

### 2.2 Tablas

```sql
-- Productos del evento
CREATE TABLE productos_evento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id     text NOT NULL,                    -- ej: 'sofa-2026'
  nombre        text NOT NULL,
  categoria     text,                             -- tote|llavero|gorra|pañoleta|sticker|amigurumi|charm
  precio        integer,                          -- COP, sin decimales
  stock_inicial integer NOT NULL DEFAULT 0,
  stock_actual  integer NOT NULL DEFAULT 0,
  activo        boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Ventas registradas desde el POS
CREATE TABLE ventas_evento (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id  uuid NOT NULL REFERENCES productos_evento(id),
  cantidad     integer NOT NULL,
  dispositivo  text,                              -- 'celular-nathali'
  vendido_en   timestamptz NOT NULL DEFAULT now(),
  sincronizado boolean NOT NULL DEFAULT true      -- false = registrado offline
);

-- Índices
CREATE INDEX idx_productos_evento_id ON productos_evento(evento_id);
CREATE INDEX idx_ventas_producto_id  ON ventas_evento(producto_id);
CREATE INDEX idx_ventas_vendido_en   ON ventas_evento(vendido_en);

-- Función para decrementar stock de forma atómica (evita condiciones de carrera
-- cuando dos dispositivos venden el mismo producto simultáneamente)
CREATE OR REPLACE FUNCTION decrementar_stock_seguro(p_producto_id uuid, p_cantidad integer)
RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
  UPDATE productos_evento
  SET stock_actual = GREATEST(0, stock_actual - p_cantidad)
  WHERE id = p_producto_id;
$$;
```

### 2.3 Row Level Security

```sql
-- Habilitar RLS
ALTER TABLE productos_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_evento    ENABLE ROW LEVEL SECURITY;

-- Acceso total solo al usuario autenticado designcuac@gmail.com
CREATE POLICY "admin_all_productos" ON productos_evento
  FOR ALL USING (auth.email() = 'designcuac@gmail.com');

CREATE POLICY "admin_all_ventas" ON ventas_evento
  FOR ALL USING (auth.email() = 'designcuac@gmail.com');
```

### 2.4 Realtime

Habilitar Realtime en la tabla `productos_evento` para que el POS reciba updates de stock en tiempo real cuando otro dispositivo registra una venta.

### 2.5 Auth

| Método | Usuario | Uso |
|---|---|---|
| Google OAuth | `designcuac@gmail.com` | Admin panel (redirect flow) |
| Email + password | `designcuac@gmail.com` | POS app (sin redirect, guarda sesión en localStorage) |

**Configuración Google OAuth:**
- Requiere credenciales OAuth 2.0 en Google Cloud Console
- Redirect URI: `https://<proyecto>.supabase.co/auth/v1/callback`
- Client ID + Secret se configuran en Supabase Auth → Providers → Google

---

## 3. Arquitectura Angular (Admin)

### 3.1 Refactor: Shell + Home

El `AdminComponent` actual (monolito con ViewId) se separa en dos piezas:

```
AdminShellComponent   ← layout: sidebar, topbar, auth gate, toast, <router-outlet>
AdminHomeComponent    ← monolito actual renombrado (ViewId intacto, sin tocar)
```

**Regla:** `AdminHomeComponent` no se modifica funcionalmente. Solo se le retira el sidebar/topbar que pasa al shell.

### 3.2 Rutas

```ts
// app.routes.ts
{
  path: 'admin',
  component: AdminShellComponent,
  children: [
    { path: '',                   component: AdminHomeComponent },
    { path: 'inventario',         component: InventarioListComponent },
    { path: 'inventario/nuevo',   component: InventarioFormComponent },
    { path: 'inventario/:id/editar', component: InventarioFormComponent },
    { path: 'inventario/ventas',  component: InventarioVentasComponent },
  ]
}
```

### 3.3 Auth Guard

`AdminShellComponent` verifica sesión activa en `ngOnInit`:
- Sin sesión → muestra pantalla de login con botón Google OAuth
- Con sesión y email === `designcuac@gmail.com` → renderiza el shell
- Con sesión pero email diferente → pantalla de acceso denegado

### 3.4 Servicios nuevos

**`src/app/core/services/supabase.service.ts`**
- Cliente Supabase singleton (URL + anon key desde `environment.ts`)
- Expone `session$` signal/observable
- Métodos: `signInWithGoogle()`, `signInWithPassword()`, `signOut()`, `getSession()`

**`src/app/core/services/inventario.service.ts`**
- `getProductos(eventoId)` → Signal con lista reactiva
- `getProducto(id)` → Promise
- `createProducto(data)` → Promise; stock_actual = stock_inicial
- `updateProducto(id, data)` → Promise; nunca modifica stock_actual
- `getVentas(eventoId, desde?, hasta?)` → Promise con join a productos

**`src/environments/environment.ts`**
```ts
export const environment = {
  supabaseUrl: 'https://<proyecto>.supabase.co',
  supabaseKey: '<anon-key>',   // anon key — segura en browser con RLS activo
};
```

### 3.5 Vistas de inventario

#### `/admin/inventario` — Lista de productos

- Tabla: nombre, categoría, precio (formateado COP), stock inicial, stock actual, chip activo/inactivo
- Filtro por categoría (select con las 7 categorías + "Todas")
- Botón "Nuevo producto" → navega a `/admin/inventario/nuevo`
- Fila clickeable → `/admin/inventario/:id/editar`
- Usa el mismo sistema de tokens visuales del admin existente (colores, chips)

#### `/admin/inventario/nuevo` y `/:id/editar` — Formulario

- Reactive Form con validaciones:
  - `nombre`: required
  - `precio`: required, min 1
  - `stock_inicial`: required, min 0
  - `categoria`: required
  - `activo`: boolean toggle
- **Modo nuevo:** al guardar, `stock_actual = stock_inicial`
- **Modo editar:** `stock_actual` no aparece en el form (se gestiona desde el POS)
- Botón "Guardar" + botón "Cancelar" → vuelve a la lista

#### `/admin/inventario/ventas` — Log de ventas

- Tabla: fecha/hora, nombre del producto, categoría, cantidad, dispositivo
- Filtro por rango de fechas (date inputs)
- Resumen al pie: total unidades vendidas por producto en el período seleccionado
- Datos obtenidos via join `ventas_evento → productos_evento`

---

## 4. App POS (`pos/index.html`)

### 4.1 Tecnología

HTML + CSS + JS vanilla. Sin framework, sin build step. Se abre en cualquier navegador móvil apuntando a `pos/index.html` (o desplegado como sitio estático).

Dependencias via CDN:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

### 4.2 Estructura de archivos

```
pos/
├── index.html      ← app completa: HTML + <style> + <script type="module">
└── manifest.json   ← PWA manifest (nombre, icono, display: standalone)
```

### 4.3 Estado en localStorage

```js
pos_device_name   // 'celular-nathali'
pos_supabase_session  // sesión serializada de Supabase Auth
pos_offline_queue     // array JSON de ventas pendientes de sincronizar
```

### 4.4 Pantallas

**Pantalla 0 — Nombre de dispositivo** (solo primera vez)
- Input de texto libre
- Botón "Confirmar"
- Guarda en `pos_device_name` → no vuelve a aparecer

**Pantalla 1 — Login**
- Input email (pre-relleno: `designcuac@gmail.com`)
- Input password
- Botón "Entrar" → `supabase.auth.signInWithPassword()`
- Sesión guardada → no vuelve a aparecer mientras sea válida

**Pantalla 2 — Catálogo** (pantalla principal)

Header fijo:
```
[● Conectado | ○ Sin conexión — N pendientes]   sofa-2026   celular-nat
```

Grid de cards (2 columnas en móvil):
```
┌─────────────────┐
│   TOTE BAGS     │
│   $28.000       │
│   Stock: 5      │
│   [  −  1  ]   │  ← botón grande, 56px alto mínimo
└─────────────────┘
```

Estados visuales:
- Stock normal: texto blanco
- Stock bajo (< 3): badge naranja "Poco stock"
- Agotado (0): card opaca, sin botón `−1`

**Acción — Registrar venta:**
1. Tap en `−1` → modal de confirmación con input de cantidad (default: 1)
2. Confirmar:
   - Online: INSERT `ventas_evento` + RPC `decrementar_stock_seguro(producto_id, cantidad)`
   - Offline: push a `pos_offline_queue` con `sincronizado: false`
3. Toast verde "Venta registrada" 2 seg (o "Guardada offline")

### 4.5 Modo offline

```js
window.addEventListener('online', procesarCola);

async function procesarCola() {
  const cola = JSON.parse(localStorage.getItem('pos_offline_queue') ?? '[]');
  let sincronizadas = 0;
  for (const venta of cola) {
    await supabase.from('ventas_evento').insert({ ...venta, sincronizado: true });
    await supabase.rpc('decrementar_stock_seguro', {
      p_producto_id: venta.producto_id,
      p_cantidad: venta.cantidad
    });
    sincronizadas++;
  }
  localStorage.removeItem('pos_offline_queue');
  mostrarToast(`${sincronizadas} ventas sincronizadas`);
}
```

### 4.6 Realtime

```js
supabase.channel('stock-live')
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'productos_evento'
  }, payload => actualizarCardStock(payload.new))
  .subscribe();
```

### 4.7 Diseño visual

- Fondo: `#0f1117` (oscuro, legible en exteriores)
- Texto: `#f0f0f0`
- Accent: `#E8623D` (terra, consistente con Cuaquiverso)
- Cards: `#1a1f2e`, border-radius 12px, padding 16px
- Botones de acción: mínimo 56px de alto, fuente 18px
- Sin animaciones complejas — prioridad en respuesta táctil

---

## 5. Orden de implementación

1. **Crear proyecto Supabase** `cuaquiverso-pos` via MCP
2. **Crear tablas + RLS** via migración SQL
3. **Configurar Auth** (Google OAuth + email/password para mismo usuario)
4. **Instalar `@supabase/supabase-js`** en el proyecto Angular
5. **Crear `environment.ts`** con URL + anon key del nuevo proyecto
6. **Crear `SupabaseService`**
7. **Crear `InventarioService`**
8. **Refactor admin**: crear `AdminShellComponent`, renombrar home
9. **Actualizar `app.routes.ts`** con child routes
10. **Construir `InventarioListComponent`**
11. **Construir `InventarioFormComponent`**
12. **Construir `InventarioVentasComponent`**
13. **Construir `pos/index.html`** (POS standalone)
14. **Verificar** flujo completo: login → crear producto → POS vende → admin ve venta

---

## 6. Decisiones y restricciones

| Decisión | Razón |
|---|---|
| Anon key en browser (no service key) | Service key bypasea RLS — nunca va al cliente |
| Mismo usuario para admin y POS | Simplifica RLS; distinción es de interfaz, no de permisos |
| Google OAuth para admin, password para POS | POS no puede hacer redirect flow en contexto de feria |
| Vanilla JS para POS | Sin build step, abre en cualquier móvil, rápido de desplegar |
| Enfoque B (shell + home) para admin | Cero riesgo de regresión en las vistas existentes |
| Realtime solo en `productos_evento` | Suficiente para sincronizar stock entre dispositivos |
| evento_id hardcodeado como 'sofa-2026' en POS | Se actualiza por evento; no necesita UI de configuración aún |
