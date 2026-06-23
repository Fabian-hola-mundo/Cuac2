# Restock + historial de movimientos de producto

## Contexto

En `/admin/productos`, el admin necesita: (1) una forma rápida de sumar stock a un producto sin pasar por el formulario completo de edición, y (2) poder ver de dónde salió el `stock_actual` de un producto (creación, restocks, ventas) sin tener que cruzar tablas a mano.

Hoy `productos_evento.stock_actual` solo se mueve por dos caminos: alta del producto (`stock_inicial`) y ventas (`ventas_evento` + RPC `decrementar_stock_seguro`). No existe ningún registro de restocks ni una vista unificada de movimientos.

## Alcance

- Acción "Restock" en la columna de Acciones de la tabla de productos.
- Tabla nueva `producto_movimientos` para creación y restock (las ventas siguen viviendo solo en `ventas_evento`, sin duplicar).
- Sección "Historial" en el drawer de detalle de producto, combinando `producto_movimientos` + `ventas_evento`.

Fuera de alcance (YAGNI por ahora): UI para "ajuste manual" (el esquema lo soporta vía `tipo: 'ajuste'` pero no se expone todavía), edición/borrado de movimientos, exportar historial, paginación del historial (la cantidad de movimientos por producto es baja).

## Modelo de datos

Nueva migración `supabase/migrations/010_producto_movimientos.sql`:

```sql
CREATE TABLE producto_movimientos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id  uuid NOT NULL REFERENCES productos_evento(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN ('creacion','restock','ajuste')),
  cantidad     integer NOT NULL,
  nota         text,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_producto_movimientos_producto ON producto_movimientos(producto_id, creado_en DESC);
```

**Trigger de creación.** Un trigger `AFTER INSERT ON productos_evento` inserta automáticamente una fila `tipo = 'creacion'` con `cantidad = stock_inicial`. Esto evita que el historial dependa de que el código de la app recuerde insertar el evento de alta, y cubre productos creados por cualquier vía (UI, script, RPC futura).

**RPC de restock.** `registrar_restock(p_producto_id uuid, p_cantidad integer, p_nota text)`:
- Valida `p_cantidad > 0`.
- `UPDATE productos_evento SET stock_actual = stock_actual + p_cantidad WHERE id = p_producto_id`.
- `INSERT INTO producto_movimientos (producto_id, tipo, cantidad, nota) VALUES (p_producto_id, 'restock', p_cantidad, p_nota)`.
- Ambas operaciones en una sola función `SECURITY DEFINER` (igual patrón que `decrementar_stock_seguro`) para que sea atómica y evitar carreras con ventas concurrentes.

Las ventas **no** se tocan: siguen insertándose en `ventas_evento` por el flujo actual. El historial las lee de ahí, no las duplica.

## Servicio (`inventario.service.ts`)

Dos métodos nuevos:

```ts
restockProducto(productoId: string, cantidad: number, nota?: string): Promise<{ error: any }>
// llama a supabase.rpc('registrar_restock', { p_producto_id, p_cantidad, p_nota })

getHistorialProducto(productoId: string): Promise<MovimientoProducto[]>
// lee producto_movimientos (tipo, cantidad, nota, creado_en) y ventas_evento
// (cantidad, vendido_en, canal) para ese producto_id, las mapea a una forma común
// y devuelve combinado + ordenado por fecha desc en el cliente
```

Forma común para la UI:

```ts
interface MovimientoProducto {
  tipo: 'creacion' | 'restock' | 'ajuste' | 'venta';
  cantidad: number;       // positivo = entrada, negativo = salida (venta se mapea a -cantidad)
  nota: string | null;    // null para ventas
  fecha: string;          // ISO
}
```

## UI — acción Restock

En `productos-list.component.html`, junto a los íconos existentes (ver/editar/duplicar/toggle) en la columna Acciones: un ícono nuevo (`.icon-act`, ej. un "+" o ícono de caja) con `(click)="abrirRestock(producto)"`.

Modal de confirmación (mismo patrón visual que "Finalizar evento": backdrop `.drawer-back`, caja centrada fixed):
- Input numérico "Cantidad a agregar" (`min="1"`, requerido).
- Input de texto opcional "Nota" (ej. "Reposición proveedor X").
- Botones Cancelar / Confirmar restock.
- Estado `loading()` deshabilita el botón mientras se llama al RPC.
- Error se muestra igual que en el patrón existente (`@if (error())`).
- Al confirmar: llama `restockProducto()`, cierra modal, refresca la fila (stock_actual actualizado) y dispara el toast existente ("Stock actualizado").

## UI — Historial en el drawer

Dentro del drawer de detalle (ícono de ojo existente), debajo de los datos actuales del producto: nueva sección "Historial".

- Al abrir el drawer, se llama `getHistorialProducto(producto.id)` y se guarda en un signal local del componente.
- Lista simple (no tabla), un row por movimiento: fecha formateada, badge de tipo (Creación / Restock / Venta — colores reutilizando las clases de badge ya existentes en el admin), cantidad con signo (+N / −N), nota si existe.
- Si no hay movimientos (no debería pasar nunca por el trigger de creación, pero por robustez): mensaje "Sin movimientos registrados".

## Testing

- Migración: aplicar localmente y verificar que insertar un producto dispara el trigger y crea la fila `'creacion'`.
- RPC `registrar_restock`: probar que suma stock correctamente y crea el movimiento; probar que rechaza `cantidad <= 0`.
- `getHistorialProducto`: test que combina y ordena movimientos + ventas mockeadas.
- UI: verificar manualmente en el navegador que el modal de restock actualiza la tabla y que el historial se ve correcto en el drawer.
