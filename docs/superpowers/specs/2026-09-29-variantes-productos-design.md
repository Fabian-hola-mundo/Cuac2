# Variantes de producto (talla, color, tamaño…) — Diseño

Fecha: 2026-09-29 · Estado: aprobado en conversación, pendiente de revisión escrita

## Objetivo

Que el admin pueda definir, por producto, opciones libres (nombre y valores a su gusto: Talla, Color, Tamaño…) y que cada combinación resultante tenga su propio stock y, opcionalmente, su propio precio. El cliente elige la combinación en la ficha; el carrito, el checkout, el cobro con Bold, el descuento de stock, los reportes y el POS respetan la combinación.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Stock / precio | Stock **por combinación**; precio **opcional** por combinación (vacío = precio del producto). |
| Opciones | Las define el admin. No hay personalización con texto libre del cliente. |
| POS | También pide la variante. |
| Fotos | Foto opcional por **valor** de opción, elegida entre las fotos que ya tiene el producto. |
| Modelo | Tablas de variantes solo para productos que las usan; productos simples no cambian. |
| Reserva de stock | Al crear el pedido se aparta el stock **15 minutos**. Se avisa al cliente. Recargar la página **no** libera la reserva; se libera al vencer, al rechazarse/cancelarse el pago o si el cliente toca «Cancelar y liberar». |

## Fuera de alcance

- Descuentos por variante (los códigos siguen aplicando por producto/categoría → a todas sus variantes).
- Personalización con texto del cliente (bordados, nombres).
- Vista de pedidos del admin conectada a Supabase (hoy es mock; proyecto aparte).

## 1. Base de datos — `supabase/migrations/026_variantes.sql`

Antes de escribirla: leer el esquema real vía Management API (hay columnas de `productos_evento` y `ventas_evento` creadas desde el dashboard que no están en migraciones).

### Tablas nuevas

**`producto_opciones`**
- `id uuid pk default gen_random_uuid()`
- `producto_id uuid not null references productos_evento(id) on delete cascade`
- `nombre text not null` (ej. «Talla»), `unique (producto_id, nombre)`
- `posicion int not null default 0`
- `valores jsonb not null default '[]'` — array ordenado de `{ "valor": text, "foto_url": text|null }`
- Máximo 3 opciones por producto: validado en el admin y con un trigger `before insert` que rechaza la cuarta.

**`producto_variantes`**
- `id uuid pk default gen_random_uuid()`
- `producto_id uuid not null references productos_evento(id) on delete cascade`
- `opciones jsonb not null` — ej. `{"Talla":"M","Color":"Negro"}`; `unique (producto_id, opciones)`
- `precio int null` (null = precio del producto), `check (precio is null or precio > 0)`
- `stock_actual int not null default 0 check (stock_actual >= 0)`
- `activo boolean not null default true`
- `posicion int not null default 0`
- `creado_en timestamptz not null default now()`
- Una combinación con ventas no se borra: se desactiva.

### Stock total del producto

Trigger `after insert/update/delete` en `producto_variantes` → `productos_evento.stock_actual = coalesce(sum(stock_actual) filter (where activo), 0)` del producto afectado. Así la tienda, los badges y los reportes que leen `stock_actual` siguen funcionando.

### Columnas nuevas

- `pedido_items.variante_id uuid null references producto_variantes(id) on delete set null`
- `pedido_items.variante_label text null` — snapshot («Talla M · Negro»)
- `ventas_evento.variante_id uuid null references producto_variantes(id) on delete set null`
- `producto_movimientos.variante_id uuid null references producto_variantes(id) on delete set null`

### Funciones

- `registrar_venta_web(p_referencia)`: agrupa por `(producto_id, variante_id)`; si hay variante descuenta de `producto_variantes` (`greatest(0, …)`), si no del producto como hoy; inserta `ventas_evento` con `variante_id`. Sigue siendo idempotente con `stock_descontado`.
- `decrementar_stock_seguro(p_producto_id, p_cantidad, p_variante_id uuid default null)`
- `registrar_restock(…, p_variante_id uuid default null)`
- `registrar_ajuste(p_producto_id, p_nuevo_stock, p_nota, p_variante_id uuid default null)`
- Sin `p_variante_id` se comportan exactamente como hoy (compatibilidad con el POS actual).
- Con variante, validan que la variante pertenezca al producto. Registran `producto_movimientos` con `variante_id`.
- Movimiento de `creacion` por variante al insertar una variante con stock > 0.
- `obtener_pedido(p_token)`: devuelve también `variante_label` por ítem.
- Mismo patrón que migraciones recientes: `begin/commit`, `security definer`, `set search_path = public`, `revoke all … from public, anon`, grants explícitos.

### RLS

- Lectura pública de `producto_opciones` y de `producto_variantes` activas cuando el producto está `activo`.
- Admin todo con `is_admin()`.
- Operador POS: lectura de variantes (como ya lee productos).

## 2. Admin

### Formulario de producto (`src/app/pages/admin/productos/producto-form.component.*`)

- Interruptor «Este producto tiene variantes». Apagado = formulario actual sin cambios.
- Opciones (hasta 3): nombre libre + valores como chips (Enter para agregar, arrastrar para reordenar). Cada valor: selector de foto opcional entre la portada y la galería del producto.
- Tabla de combinaciones autogenerada (producto cartesiano de los valores). Columnas: combinación, precio (placeholder = precio del producto), stock, activa. Acciones «aplicar stock a todas» y «aplicar precio a todas».
- Al crear: el stock de cada fila se guarda como stock inicial de la variante (movimiento `creacion`).
- Al editar: el stock no se edita en la tabla; se usa reabastecer/ajustar por fila (queda en el historial).
- Cambios de opciones en un producto existente: las combinaciones que siguen existiendo (mismo JSON de opciones) conservan id, stock e historial; las que desaparecen se desactivan; las nuevas se crean con stock 0 (editable vía ajuste). Antes de guardar, aviso con el conteo de combinaciones que se desactivan.
- Renombrar un valor u opción = combinaciones nuevas + desactivación de las viejas (se avisa). No se intenta «renombrar en sitio».

### Lista de productos (`productos-list.component.*`)

- Badge «N variantes» y stock total.
- Drawer de stock/historial por combinación, con reabastecer/ajustar por fila.
- Duplicar producto copia opciones y variantes con stock 0.

### Reporte de ventas (`ventas-general.component.*`)

- Muestra la combinación junto al producto cuando la venta tiene `variante_id`.

## 3. Tienda y carrito

### Modelo/servicio (`inventario.service.ts`)

- Tipos `ProductoOpcion`, `ProductoVariante`; `getProductoPublico(id)` trae opciones y variantes activas.
- `cargarCatalogo()` añade el embed `producto_variantes(precio, stock_actual, activo)`; en cliente se derivan `tieneVariantes`, precio mínimo y máximo para la tarjeta.

### Lógica pura (archivo nuevo, testeable) — `src/app/core/utils/variantes.ts`

- `generarCombinaciones(opciones)` → lista de `Record<string,string>`.
- `claveCombinacion(opciones)` → string estable (claves ordenadas según `posicion`).
- `etiquetaVariante(opciones, orden)` → «M · Negro».
- `valoresDisponibles(variantes, seleccionParcial, opcion)` → qué valores tienen stock dado lo ya elegido.
- `varianteDeSeleccion(variantes, seleccion)` → variante o null.

### Ficha (`tienda/producto/producto-detail.component.*`)

- Un selector por opción (pastillas; miniatura si el valor tiene foto).
- Elegir un valor con foto → la galería salta a esa foto.
- Precio de la combinación; sin selección completa: «Desde $X» (mínimo de variantes activas con stock o, si todas agotadas, mínimo de activas).
- Valores sin stock tachados/deshabilitados según la selección parcial.
- Disponibilidad («Pocas unidades», «Agotado») según la variante elegida.
- «Agregar» deshabilitado hasta completar la selección; su texto indica qué falta («Elige talla»).
- JSON-LD: `AggregateOffer` con `lowPrice`/`highPrice` cuando hay variantes.

### Tarjetas (`tienda.component`, `cuaquiverso.component`, `personaje-page.component`)

- Producto con variantes: el «+» navega a la ficha. Precio «Desde $X» si hay precios distintos.

### Carrito (`services/cart.service.ts`, `cart-modal`)

- `CartItem` gana `varianteId?: string`, `varianteLabel?: string`; clave de línea = `id + '|' + (varianteId ?? '')`. `add/updateQty/remove` operan por clave de línea.
- `stock` y `price` de la línea son los de la variante.
- Storage `cuaquiverso.cart.v2`; al leer, si existe `v1` se migra (líneas sin variante) y se borra.
- Carrito, checkout (`checkout.component.html`) y confirmación muestran «Nombre · M · Negro». La confirmación hace `track` por `producto_id + variante_label`/índice, no por nombre.

## 4. Checkout, pago y stock

### `supabase/functions/crear-pedido`

- Ítems: `{ id, variante_id?, cantidad, … }`.
- Carga variantes de los productos del pedido. Reglas:
  - Producto con variantes activas y línea sin `variante_id` → 400.
  - `variante_id` inexistente, inactiva o de otro producto → 400.
  - Precio = `variante.precio ?? producto.precio` (de la BD).
  - Stock validado por variante (sumando líneas iguales) o por producto si no hay variante → 409 con mensaje «Solo quedan N de Nombre · M · Negro».
  - `variante_label` lo arma el servidor desde `opciones` + orden de `producto_opciones`.
- Inserta `pedido_items.variante_id` y `variante_label`.
- Checkout cliente (`checkout.service.ts`) envía `variante_id`.

### Descuentos

- Sin cambios de regla: aplican por producto/categoría a todas sus variantes. `validar-descuento` usa el precio de línea que ya recibe.

### Aprobación del pago

- `bold-webhook`: sin cambios (ya llama `registrar_venta_web`).
- **`verificar-pago`: al marcar `aprobado`, llama `rpc('registrar_venta_web', { p_referencia })`.** Corrige el hueco actual (en producción los pedidos se cierran por esta vía y no descontaban stock).

### Presentación del pedido

- `obtener_pedido` y la confirmación muestran `variante_label`.
- `notify-pedido`: selecciona `variante_label` y la muestra en cada línea.

## 4b. Reserva de stock durante el pago (15 min)

### Datos (misma migración 026)

**`stock_reservas`**
- `id uuid pk`, `pedido_id uuid not null references pedidos(id) on delete cascade`
- `producto_id uuid not null references productos_evento(id) on delete cascade`
- `variante_id uuid null references producto_variantes(id) on delete cascade`
- `cantidad int not null check (cantidad > 0)`
- `expira_en timestamptz not null` (creación + 15 min)
- Índices por `(producto_id, variante_id)` y `expira_en`. Sin acceso público (RLS: solo admin lee).
- `pedidos.reserva_expira_en timestamptz null` (para mostrar el contador).

Una reserva está **vigente** si `expira_en > now()` y su pedido está `pendiente`. Las vencidas no cuentan en ningún cálculo; no se necesita cron para que dejen de contar.

### Funciones

- **`reservar_stock_pedido(p_pedido_id uuid, p_items jsonb)`** — `security definer`, solo `service_role`. En una transacción:
  1. Borra reservas vencidas (limpieza oportunista).
  2. `select … for update` sobre las filas de `productos_evento` / `producto_variantes` involucradas (orden estable por id para evitar deadlocks).
  3. `disponible = stock_actual − reservas vigentes` por producto (sin variantes) o por variante.
  4. Si alguna línea no alcanza → `raise` con código y datos (`producto_id`, `variante_id`, `disponible`) para que `crear-pedido` devuelva 409 «Solo quedan N de …».
  5. Inserta las reservas y fija `pedidos.reserva_expira_en`.
- **`liberar_reservas_pedido(p_pedido_id uuid)`** — borra las reservas del pedido.
- **`stock_disponible(p_producto_ids uuid[] default null)`** — `security definer`, pública (anon), solo lectura: `returns table(producto_id, variante_id, disponible)` para productos activos y variantes activas. Es lo que muestra la tienda.
- **`cancelar_pedido_pendiente(p_token uuid)`** — pública (anon), por `confirmacion_token`: si el pedido está `pendiente`, lo pasa a `cancelado` y libera sus reservas. Si no está pendiente, no hace nada.
- **`registrar_venta_web`**: además de descontar, borra las reservas del pedido. Si en el momento de aprobar el stock físico no alcanza (reserva vencida y unidad vendida a otro), descuenta hasta 0 y marca `pedidos.sobreventa = true` (columna nueva `boolean default false`).

### Flujo

- `crear-pedido`: inserta el pedido → `reservar_stock_pedido`. Si la reserva falla, borra el pedido y sus ítems (rollback manual, como ya hace hoy) y responde 409. La validación de stock previa de la sección 4 queda reemplazada por esta (la de variante válida/activa se mantiene).
- `bold-webhook` y `verificar-pago`: `aprobado` → `registrar_venta_web` (descuenta + libera). `rechazado`/`cancelado` → `liberar_reservas_pedido`.
- Si Bold aprueba un pedido ya cancelado o con reserva vencida: se registra la venta igual (el dinero entró) y, si falta stock, se marca `sobreventa`.

### Cliente

- **Checkout, antes de pagar:** aviso «Al continuar apartamos tus productos por 15 minutos para que completes el pago».
- Tras `crear-pedido`, el navegador guarda `{ token, referencia, expiraEn }` en `localStorage` (`cuaquiverso.pedido-pendiente`). Sobrevive a recargas.
- **Si el cliente vuelve al checkout o a la confirmación con ese pedido pendiente y vigente:** banner con contador «Tu reserva vence en 12:34», botón **«Continuar pago»** y botón **«Cancelar y liberar»** (`cancelar_pedido_pendiente`). Recargar no cambia nada; el contador se calcula desde `expiraEn`.
- «Continuar pago» reabre el checkout de Bold para el **mismo** pedido. Lo firma una acción nueva de `crear-pedido` (o función `reanudar-pago`) a partir del token, solo si el pedido está pendiente y la reserva vigente. **Verificar en implementación** que Bold acepte reintentar con la misma referencia; si no, «Continuar pago» cancela el pendiente y crea un pedido nuevo con el mismo carrito.
- **Al vencer:** el banner cambia a «Tu reserva venció. Tus productos siguen en el carrito» y se limpia la clave de `localStorage`. El carrito no se borra.
- La confirmación, si el pedido está pendiente, muestra el mismo contador (`obtener_pedido` devuelve `reserva_expira_en`).
- Tienda (tarjetas, ficha, selector de variantes, tope del carrito) usa `stock_disponible` en vez de `stock_actual`.

### POS

- Sigue vendiendo del stock físico (`decrementar_stock_seguro` no mira reservas). Muestra un aviso «N reservada(s) en web» junto al producto/variante cuando hay reservas vigentes (lectura vía `stock_disponible` comparado con `stock_actual`).

### Correo al equipo

- `notify-pedido` muestra «⚠ Sobreventa: revisar stock» cuando `pedidos.sobreventa = true`.

## 5. POS (`pos/index.html`)

- Carga variantes activas junto a productos (realtime también sobre `producto_variantes`).
- Tocar un producto con variantes abre una hoja con botones por combinación («M · Negro · 4 disp.»); sin stock = deshabilitado.
- Venta: `ventas_evento` con `variante_id` + `decrementar_stock_seguro(producto, cantidad, variante)`.
- Cola offline guarda `variante_id`; entradas antiguas sin variante se sincronizan como hoy.
- Productos sin variantes: sin cambios.

## Pruebas y verificación

- **SQL** (transacción con rollback contra el proyecto): trigger de suma; `registrar_venta_web` por variante e idempotente; productos simples sin cambios; funciones con y sin `p_variante_id`; `reservar_stock_pedido` rechaza cuando no alcanza, dos reservas concurrentes por la última unidad (solo una gana), reservas vencidas no cuentan, `registrar_venta_web` libera reservas y marca `sobreventa`, `cancelar_pedido_pendiente` solo actúa sobre pendientes.
- **Reserva en vivo:** crear pedido → la tienda muestra una unidad menos; recargar el checkout mantiene el contador; «Cancelar y liberar» devuelve la unidad.
- **Unitarias** (lógica pura): `generarCombinaciones`, `claveCombinacion`, `valoresDisponibles`, `varianteDeSeleccion`, clave de línea y migración v1→v2 del carrito.
- **En vivo** con Chrome headless en este equipo: crear producto con variantes en el admin; elegir combinación en la ficha (foto y precio cambian); dos variantes en el carrito; checkout rechaza variante sin stock.

## Despliegue

- Migración 026 vía Management API.
- Funciones `crear-pedido`, `verificar-pago`, `bold-webhook`, `notify-pedido` (y `reanudar-pago` si se crea) con `--no-verify-jwt`.
- Hosting: solo cuando el usuario lo pida.
