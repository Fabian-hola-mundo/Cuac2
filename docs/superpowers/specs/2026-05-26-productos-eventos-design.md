# Spec: Fusión Productos + Inventario y sección Eventos

**Fecha**: 2026-05-26
**Área**: Admin `/admin`
**Estado**: Aprobado para implementación

---

## Contexto

El admin actual tiene dos secciones desconectadas:

- **Productos** (en `admin-home`, view signal): catálogo mock estático, sin persistencia real, con form de cajón rico (personaje, tallas, colores, imágenes).
- **Inventario** (`/admin/inventario/*`): datos reales de Supabase, evento hardcodeado como `'sofa-2026'`, sin acciones por fila, form simple.

El objetivo es unificarlas en una sección **Productos** operacional con datos reales, y convertir la sección **Inventario** en una sección **Eventos** de analítica read-only con ciclo de vida propio.

---

## Modelo de datos

### Tabla nueva: `eventos`

```sql
CREATE TABLE eventos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_fin    timestamptz,
  estado       text NOT NULL DEFAULT 'activo' -- 'activo' | 'finalizado'
);
```

Restricción de negocio: solo puede existir un evento con `estado = 'activo'` a la vez (validado en la app, no como constraint de DB por ahora).

### Tabla existente: `productos_evento`

Se mantiene con su esquema actual. En esta iteración, "catálogo global" se implementa como mostrar **todos** los registros de `productos_evento` sin filtrar por `evento_id` (se elimina el `.eq('evento_id', EVENTO_ACTIVO)` actual). El campo `evento_id` registra en qué evento se creó el producto originalmente.

Al crear un producto nuevo desde la sección Productos, `evento_id` se setea al ID del evento activo actual (si existe) o queda en `null` si no hay evento activo. Esto mantiene compatibilidad con el POS sin cambiar el esquema.

### Tabla existente: `ventas_evento`

Se mantiene. El campo `vendido_en` es el timestamp que permite filtrar ventas por rango de fechas de un evento.

Para el canal `'web'` (tienda online), se añade el campo `canal text DEFAULT 'evento'` a `ventas_evento` en una migración:

```sql
ALTER TABLE ventas_evento ADD COLUMN canal text DEFAULT 'evento';
```

---

## Sección: Productos

### Ubicación en sidebar

Bajo **Tienda**, ítem "Productos". Reemplaza el view `productos` actual de `admin-home` (que era mock estático). La sección "Inventario" bajo "Evento" desaparece del sidebar.

### Rutas

```
/admin/productos              → ProductosListComponent
/admin/productos/ventas       → VentasGeneralComponent
/admin/productos/nuevo        → ProductoFormComponent (crear)
/admin/productos/:id/editar   → ProductoFormComponent (editar)
```

### `ProductosListComponent`

Reemplaza `InventarioListComponent`. Datos reales desde Supabase (`productos_evento`).

**Header**: título "Productos", subtitle con count total, dos botones — "Ver ventas" (→ `/admin/productos/ventas`) y "+ Nuevo producto" (→ `/admin/productos/nuevo`).

**Filtros**: chips de categoría (igual que inventario-list actual) + campo de búsqueda por nombre.

**Tabla de productos**:

| Columna | Detalle |
|---|---|
| Nombre + thumbnail con initial | color según categoría |
| Categoría | label legible |
| Precio COP | formateado |
| Stock inicial | número |
| Stock actual | con badges warn (< 3) y err (= 0) |
| Estado | badge activo/inactivo |
| Acciones | 4 iconos: ver, editar, duplicar, ocultar |

**Acciones por fila**:
- **Ver** (ojo): abre un drawer lateral (`position: fixed`) con el detalle completo del producto — nombre, categoría, personaje, precio, stock, estado. Read-only.
- **Editar** (lápiz): navega a `/admin/productos/:id/editar`.
- **Duplicar** (copiar): crea un nuevo registro en Supabase con todos los campos copiados, añade sufijo `" (copia)"` al nombre, `stock_actual = stock_inicial`. Muestra toast de confirmación.
- **Ocultar/Mostrar** (ojo tachado / ojo): toggle del campo `activo`. Actualiza en Supabase inmediatamente. Muestra toast.

**Estado vacío**: mensaje con CTA a "Nuevo producto".

### `ProductoFormComponent`

Reemplaza y enriquece `InventarioFormComponent`. Misma lógica de create/edit vía `ActivatedRoute`.

**Campos**:

| Campo | Tipo | Requerido |
|---|---|---|
| Nombre | text | Sí |
| Categoría | select | Sí |
| Precio COP | number | Sí |
| Stock inicial | number | Sí (solo create) |
| Personaje | select (CHARACTERS de admin-home) | No |
| Activo en POS | toggle | Sí |

El stock inicial no se puede editar en modo edit (igual que ahora). El personaje es opcional para mantener compatibilidad con productos sin personaje (ej. accesorios genéricos).

**Migración de DB requerida**:
```sql
ALTER TABLE productos_evento ADD COLUMN IF NOT EXISTS personaje text;
```

### `VentasGeneralComponent`

Reemplaza y expande `InventarioVentasComponent`.

**Filtros**: rango de fechas (desde/hasta) + selector de canal (`Todos` / `Eventos` / `Tienda web`) + botón "Filtrar".

**Panel izquierdo — tabla de detalle**:

| Columna | Detalle |
|---|---|
| Fecha/hora | formateada |
| Producto | nombre del producto |
| Cantidad | número |
| Canal | badge: `Evento` (azul) / `Web` (verde) |
| Dispositivo | si canal = evento |
| Sync | badge ok/warn (solo evento) |

**Panel derecho — resumen por producto**: igual que inventario-ventas actual (nombre + total unidades).

**KPIs en el header**: total de registros, total de unidades, total en COP (cuando `ventas_evento` incluya campo `precio_unitario` — si no existe aún, se omite).

---

## Sección: Eventos

### Ubicación en sidebar

Bajo **Evento**, ítem "Eventos" (reemplaza "Inventario"). La URL base cambia de `/admin/inventario` a `/admin/eventos`.

### Rutas

```
/admin/eventos              → EventosListComponent
/admin/eventos/:id          → EventoDetailComponent (read-only)
```

### `EventosListComponent`

**Header**: título "Eventos", botón "+ Nuevo evento".

**"+ Nuevo evento"**: abre un drawer/dialog pequeño con un solo campo de texto — nombre del evento. Al confirmar:
1. Verifica que no haya evento activo. Si hay uno, muestra error: "Hay un evento activo: [nombre]. Finalízalo antes de crear uno nuevo."
2. Inserta en tabla `eventos` con `fecha_inicio = now()`, `estado = 'activo'`.
3. Cierra el drawer, recarga la lista, muestra toast.

**Tabla de eventos**:

| Columna | Detalle |
|---|---|
| Nombre | texto |
| Estado | chip `En curso` (verde) / `Finalizado` (gris) |
| Fecha inicio | fecha formateada |
| Fecha fin | fecha formateada o "—" si activo |
| Duración | días transcurridos o total si finalizado |
| Total vendido | suma de `ventas_evento.cantidad` para ventas en el rango `fecha_inicio–fecha_fin` del evento |

Hacer clic en una fila navega a `/admin/eventos/:id`.

### `EventoDetailComponent` (read-only)

**Header**:
- Nombre del evento, breadcrumb
- Fechas: `14 may 2026 → 16 may 2026` o `14 may 2026 → en curso`
- Si `estado = 'activo'`: botón **"Finalizar evento"** con confirm dialog ("¿Confirmar cierre del evento [nombre]? Esta acción no se puede deshacer."). Al confirmar: `UPDATE eventos SET estado='finalizado', fecha_fin=now()`.

**KPIs** (4 tarjetas en grid):
- Total vendido COP (si hay precios disponibles en ventas)
- Unidades vendidas totales
- Productos distintos vendidos
- Días del evento

**Top productos** (panel):
- Tabla: nombre, categoría, unidades vendidas, ordenado desc por unidades.
- Calculado filtrando `ventas_evento` por `fecha_inicio ≤ vendido_en ≤ fecha_fin`.

**Ventas por día** (panel):
- Tabla: fecha, unidades del día, monto del día (si disponible).
- Filas ordenadas por fecha asc.
- Permite ver picos y días sin actividad.

---

## Cambios en `AdminShellComponent`

### Sidebar

- Ítem "Productos" bajo Tienda: `(click)` navega a `/admin/productos` (ya no es un view signal de admin-home).
- Ítem "Inventario" → renombrar a "Eventos", `(click)` navega a `/admin/eventos`.
- Crumbs actualizados para las nuevas rutas.

### `AdminStateService` / `ViewId`

Al hacer clic en "Productos" del sidebar se navega a `/admin/productos` (ruta real), no se cambia el view signal. El ViewId `'productos'` permanece en el tipo pero su vista en `admin-home` queda vacía/no renderizada.

### `AdminHomeComponent`

La sección `view() === 'productos'` de admin-home se marca como deprecated pero no se elimina en esta iteración para no romper el dashboard si referencia datos de productos.

---

## Servicios nuevos/modificados

### `EventosService` (nuevo)

```typescript
// Métodos:
getEventos(): Promise<Evento[]>
getEventoActivo(): Promise<Evento | null>
crearEvento(nombre: string): Promise<{ error: string | null }>
finalizarEvento(id: string): Promise<{ error: string | null }>
getEventoById(id: string): Promise<Evento | null>
getVentasEvento(eventoId: string): Promise<VentaEvento[]>  // filtra por rango fecha del evento
```

### `InventarioService` (modificado)

- Se renombra a `ProductosService` o se mantiene el nombre y se añaden métodos.
- Nuevo método: `duplicarProducto(id: string): Promise<{ error: string | null }>`
- Nuevo método: `toggleActivo(id: string, activo: boolean): Promise<{ error: string | null }>`
- Método `cargarProductos()` se desvincula del `EVENTO_ACTIVO` hardcodeado — carga todos los productos o filtra por un parámetro opcional.

---

## Archivos afectados

**Nuevos**:
- `src/app/pages/admin/productos/productos-list.component.{ts,html,scss}`
- `src/app/pages/admin/productos/producto-form.component.{ts,html,scss}`
- `src/app/pages/admin/productos/ventas-general.component.{ts,html,scss}`
- `src/app/pages/admin/eventos/eventos-list.component.{ts,html,scss}`
- `src/app/pages/admin/eventos/evento-detail.component.{ts,html,scss}`
- `src/app/core/services/eventos.service.ts`

**Modificados**:
- `src/app/app.routes.ts` — nuevas rutas, rutas `/inventario/*` reemplazadas
- `src/app/pages/admin/admin-shell.component.{ts,html}` — nav, crumbs, goProductos(), goEventos()
- `src/app/core/services/inventario.service.ts` — nuevos métodos duplicar/toggleActivo

**Deprecados (no eliminados en esta iteración)**:
- `src/app/pages/admin/inventario/inventario-list.component.*`
- `src/app/pages/admin/inventario/inventario-form.component.*`
- `src/app/pages/admin/inventario/inventario-ventas.component.*`

---

## Migraciones de DB requeridas

```sql
-- 1. Tabla eventos
CREATE TABLE IF NOT EXISTS eventos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_fin    timestamptz,
  estado       text NOT NULL DEFAULT 'activo'
);

-- 2. Campo personaje en productos
ALTER TABLE productos_evento ADD COLUMN IF NOT EXISTS personaje text;

-- 3. Canal en ventas
ALTER TABLE ventas_evento ADD COLUMN IF NOT EXISTS canal text DEFAULT 'evento';
```

---

## Fuera de scope (esta iteración)

- Integración con tienda web real (canal `'web'` en ventas queda preparado pero sin datos)
- Gráfico de barras SVG para ventas por día (se usa tabla por ahora)
- Asignación explícita de productos a eventos (cada producto cargado en el POS ya queda vinculado por su `evento_id`)
- Eliminación de productos (solo ocultar)
- Historial de cambios de stock
