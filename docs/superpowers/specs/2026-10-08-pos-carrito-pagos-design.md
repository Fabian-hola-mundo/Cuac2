# POS: búsqueda rápida, carrito y medio de pago — Diseño

Fecha: 2026-10-08 · Estado: aprobado en conversación, pendiente de revisión escrita

## Objetivo

En momentos de mucha gente, registrar una venta en el POS (`public/pos/index.html`, publicado en `cuacdesign.com/pos/`) tarda demasiado: no hay buscador, hay que bajar por las 42 tarjetas para encontrar un producto y cada producto de una misma compra se registra por separado. Además no queda registrado cómo pagó el cliente.

Se busca que:

- **Vender sea lo primero que se ve** y encontrar un producto tome segundos (buscador, categorías, más vendidos, fotos).
- Una compra con varios productos se registre como **una sola venta (carrito)**.
- Cada venta guarde su **medio de pago**: QR, Datáfono o Efectivo (con calculadora de vueltas).
- **Todos los POS del evento estén sincronizados** en vivo.
- El admin tenga un **cuadre de caja** por medio de pago, caja y día.
- Todo siga funcionando **sin internet**.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Compra con varios productos | Carrito: se agregan productos y se cobra una vez. |
| Encontrar productos | Buscador de texto + chips de categoría + más vendidos + fotos. |
| Más vendidos | Automáticos: unidades vendidas en el evento activo, sumando todos los dispositivos. Van primero en la cuadrícula con marca 🔥1, 🔥2… (no hay fila aparte). |
| Agregar al carrito | Un toque agrega 1 unidad. Productos con combinaciones abren una hoja pequeña solo para elegir la combinación. |
| Cantidad | Tocar de nuevo suma; en la hoja de cobro, − / + por línea. |
| Medio de pago | Obligatorio, uno por venta: `qr`, `datafono`, `efectivo`. Sin pagos divididos. |
| Efectivo | Campo «Recibido» opcional con atajos y vueltas en grande. El recibido **no** se guarda. |
| Observación | Una por venta, opcional, ≤ 280 caracteres. Reemplaza la nota por producto actual. |
| Modelo de datos | Enfoque A: columnas nuevas en `ventas_evento` + RPC atómica e idempotente. Sin tabla nueva. |
| Precio | Se guarda el precio unitario que vio el POS al cobrar. |
| Sincronización | `ventas_evento` entra a la publicación Realtime; todos los POS y el admin se actualizan en vivo. |
| Contador del encabezado | Pasa a ser del evento completo (todas las cajas), no del dispositivo. |
| Admin | Cuadre de caja por medio de pago (filtros caja y día) + lista de ventas agrupadas por transacción. Solo ventas del POS. |

## Fuera de alcance

- Pagos divididos entre varios medios.
- Guardar el monto recibido en efectivo.
- Descuentos o precios editables en el POS.
- Favoritos marcados a mano.
- Lector de código de barras.
- Cambiar cómo se registran las ventas web (siguen con las columnas nuevas en `null`).

## 1. Base de datos — `supabase/migrations/037_pos_transacciones.sql`

Esquema real de `ventas_evento` verificado el 2026-10-08: `id, producto_id, cantidad, dispositivo, vendido_en, sincronizado, canal, evento_id (text, not null), variante_id, dispositivo_id, comentario`. Las ventas del POS dejan `canal` en `null`; las web usan `'web'`.

### Columnas nuevas en `ventas_evento` (todas `null` por defecto)

| Columna | Tipo | Regla |
|---|---|---|
| `transaccion_id` | `uuid` | Índice. Agrupa las líneas de un carrito. |
| `metodo_pago` | `text` | `check (metodo_pago in ('qr','datafono','efectivo'))`. |
| `precio_unitario` | `integer` | `check (precio_unitario is null or precio_unitario >= 0)`. |

Filas existentes y ventas web quedan con las tres en `null`.

### RPC `registrar_transaccion_pos`

```
registrar_transaccion_pos(
  p_transaccion_id uuid,
  p_metodo_pago    text,          -- null solo para ventas migradas de la cola vieja
  p_evento_id      text,
  p_dispositivo    text,
  p_dispositivo_id uuid,
  p_comentario     text,
  p_vendido_en     timestamptz,
  p_lineas         jsonb          -- [{producto_id, variante_id|null, cantidad, precio_unitario}]
) returns text                     -- 'registrada' | 'duplicada'
security definer, search_path = public
```

En una sola transacción:

1. Autoriza: `is_admin() or is_pos_operator()`; si no, `raise exception 'No autorizado'`.
2. Valida: `p_lineas` no vacío; cada `cantidad > 0`; `precio_unitario >= 0`; `p_metodo_pago` en la lista o `null`; comentario ≤ 280.
3. `pg_advisory_xact_lock(hashtext(p_transaccion_id::text))` para serializar reintentos simultáneos.
4. Si ya existe alguna fila con ese `transaccion_id` → `return 'duplicada'` sin cambiar nada.
5. Por cada línea: si trae variante, valida con `variante_de_producto`; inserta la fila en `ventas_evento` (con `sincronizado = true`, `canal = null`) y descuenta el stock con la misma lógica que `decrementar_stock_seguro` (bloqueo del producto y `greatest(0, stock - cantidad)`). No se rechaza por stock insuficiente: la venta física ya ocurrió.
6. `return 'registrada'`.

Cualquier error aborta todo: nunca queda un carrito a medias.

Permisos: `revoke all from public`, `revoke execute from anon`, `grant execute to authenticated, service_role`, igual que `decrementar_stock_seguro`.

### RPC `mas_vendidos_evento`

```
mas_vendidos_evento(p_evento_id text, p_limite int default 8)
returns table (producto_id uuid, unidades bigint)
```

Suma `cantidad` de `ventas_evento` donde `evento_id = p_evento_id` y `canal is distinct from 'web'`, agrupada por producto, de mayor a menor, con el límite indicado. Mismos permisos (admin u operador POS).

### Realtime

Agregar `public.ventas_evento` a la publicación `supabase_realtime` con el mismo bloque idempotente de `031_realtime_admin.sql`. Realtime aplica RLS: solo admin y operadores POS reciben filas (políticas de `017_seguridad_hardening.sql`).

## 2. POS — catálogo («vender primero»)

### Diseño de la pantalla

- **Zona fija arriba**, que no se desplaza:
  - Una línea con el nombre del evento, el punto de conexión y el contador del evento (`N ventas · $total`). Al tocarla se despliegan el nombre del dispositivo y las ventas pendientes de sincronizar.
  - El buscador.
  - Una fila deslizable de chips: `Todo`, `🔥 Más vendidos` y las categorías.
- **Cuadrícula de 2 columnas** con tarjetas compactas: foto o color, nombre, precio y stock. Deben verse unas 8 tarjetas sin bajar en un teléfono normal.
- **Barra del carrito** fija abajo («N productos · $total · Cobrar →»). Solo aparece si hay algo en el carrito.

### Orden de la cuadrícula

1. Los más vendidos del evento (hasta 8, sin incluir agotados), con la marca 🔥1…🔥8.
2. El resto en orden estable: categoría y luego nombre, como hoy.

El orden de los 🔥 **solo se recalcula cuando el carrito está vacío**, para que ninguna tarjeta se mueva mientras se arma una venta. El stock y el contador sí se actualizan siempre.

### Buscador

- Filtra mientras se escribe, buscando en el nombre y la categoría.
- No distingue tildes ni mayúsculas (normalización con `NFD` y quitando diacríticos).
- Mientras hay texto, se ocultan las marcas 🔥 y los chips.
- La ✕ lo limpia. También se limpia solo después de registrar una venta.

### Agregar

- Un toque en una tarjeta sin combinaciones suma 1 unidad al carrito, sin superar el stock. La tarjeta destella y muestra el contador `×N`.
- En una tarjeta con combinaciones se abre una hoja pequeña con los botones de combinación (con el stock y el aviso de reservas web que existen hoy). Al elegir una, se agrega y la hoja se cierra.
- Las tarjetas agotadas siguen deshabilitadas, como hoy.

### Fotos

- Se usa la primera foto del producto (`fotos[0]`) si existe; si no, la tarjeta de color con el nombre, como hoy.
- Se usa la miniatura más pequeña disponible.
- `public/pos/sw.js` guarda las imágenes de Supabase Storage en una caché aparte (primero la caché y, si no está, la red), para que se vean sin internet después de haberlas visto una vez. Hay que traer `fotos` en el `select` de `loadProducts` y en el catálogo guardado localmente.

## 3. POS — hoja de cobro

Se abre con «Cobrar →».

- **Líneas:** nombre, combinación, precio unitario, controles − / + (con tope en el stock de esa combinación o producto) y subtotal. Cuando la cantidad es 1, el − se convierte en 🗑 para quitar la línea.
- **Total.**
- **Medio de pago:** tres botones (QR, Datáfono, Efectivo), con selección única. Mientras no se elija, el botón principal dice «Elige el medio de pago» y está deshabilitado.
- **Efectivo:** aparece el campo «Recibido» (teclado numérico) con atajos `Exacto` y los billetes redondeados hacia arriba (próximos múltiplos de 10.000, 20.000 y 50.000 por encima del total, sin repetir). Las vueltas (`recibido − total`) se muestran en grande cuando `recibido ≥ total`. El campo es opcional.
- **Observación:** «+ Agregar observación» abre un campo de hasta 280 caracteres.
- **Botón principal:** «Registrar $total · Medio».
- Al registrar, se cierra la hoja, se vacía el carrito y se limpia el buscador.
- Cerrar la hoja sin registrar (deslizando hacia abajo o con «Seguir agregando») conserva el carrito.

## 4. POS — registro, cola sin conexión y sincronización

### Registrar

1. Generar `transaccion_id = crypto.randomUUID()` al tocar «Registrar».
2. Armar la transacción: `{transaccion_id, metodo_pago, evento_id, dispositivo, dispositivo_id, comentario, vendido_en, lineas[{producto_id, variante_id, cantidad, precio_unitario}]}`. El `precio_unitario` es `variante.precio ?? producto.precio` al momento de cobrar.
3. Con internet, llamar a `registrar_transaccion_pos`. Tanto `'registrada'` como `'duplicada'` cuentan como éxito: se actualiza el stock local de forma optimista y se muestra un toast.
4. Si hay error o no hay internet, la transacción entera se agrega a la cola sin conexión y se muestra un toast avisando que quedó guardada localmente.

### Cola sin conexión

- Nueva clave `pos_offline_queue_v2` con un arreglo de transacciones.
- `syncOfflineQueue` envía cada transacción con la misma RPC y el mismo id. Las que responden `'registrada'` o `'duplicada'` salen de la cola; las que fallan se quedan para el siguiente intento.
- **Migración de la cola vieja:** al arrancar, si `pos_offline_queue` (la clave actual) tiene ventas, cada una se convierte en una transacción de una línea con un `transaccion_id` nuevo, `metodo_pago = null`, su `precio_unitario` tomado del catálogo local si existe (si no, `null`) y su `comentario`. Se pasan a la cola v2 y se borra la clave vieja.
- El chip de pendientes cuenta transacciones.
- Se eliminan del flujo del POS el `insert` directo y la llamada a `decrementar_stock_seguro`. La función se queda en la base de datos por compatibilidad.

### Carrito guardado

El carrito se guarda en `localStorage` (`pos_carrito`) cada vez que cambia y se restaura al abrir. Al restaurarlo, las líneas cuyo producto ya no esté en el catálogo se descartan con un aviso.

### Sincronización entre POS

- Se mantiene la suscripción actual a `productos_evento` y `producto_variantes` para el stock.
- Se agrega una suscripción a `INSERT` en `ventas_evento` filtrada por `evento_id` del evento activo. Con cada evento recibido se actualiza el contador del evento y se vuelven a pedir los más vendidos (con un *debounce* de unos 2 s para no saturar en momentos de mucha venta). El orden 🔥 se aplica cuando el carrito está vacío.
- **Contador del evento:** se calcula al cargar con una consulta de agregado (número de transacciones distintas y suma de `cantidad × precio_unitario`, usando el precio del producto si `precio_unitario` es null) y se actualiza con Realtime. Sin internet, muestra el último valor guardado más las transacciones pendientes de este dispositivo.
- **Más vendidos sin internet:** se usa el último resultado guardado (`pos_mas_vendidos`) más las unidades de las transacciones pendientes.
- Con el evento `Venta-regular` (sin evento activo) aplica lo mismo, filtrando por ese `evento_id`.

## 5. Admin — detalle del evento (`/admin/eventos/:id`)

Archivos: `evento-detail.component.{ts,html,scss}` y `eventos.service.ts`.

- `getVentasEvento` trae además `transaccion_id, metodo_pago, precio_unitario, dispositivo, dispositivo_id, comentario` y `producto_variantes(opciones)`.
- **Panel «Cuadre de caja»** (nuevo, debajo de los indicadores actuales):
  - Cuatro casillas: Efectivo, QR, Datáfono y Sin registrar (`metodo_pago` null). Cada una muestra el total en COP y el número de ventas.
  - Solo cuenta ventas con `canal` distinto de `'web'`.
  - El monto de cada línea es `cantidad × (precio_unitario ?? precio actual del producto)`.
  - Una venta es un `transaccion_id`; las filas viejas sin transacción cuentan como una venta cada una.
  - Filtros: caja (`dispositivo_id`, mostrando el nombre del dispositivo; por defecto «Todas las cajas») y día (por defecto «Todos los días»).
- **Panel «Ventas»** (nuevo): una fila por transacción, de la más reciente a la más antigua, con hora, caja, productos (`Nombre (combinación) ×N` separados por ` · `), observación, etiqueta del medio de pago y total. Usa los mismos filtros del cuadre. Muestra las primeras 50 y un botón «Ver más».
- **En vivo:** suscripción a `INSERT` en `ventas_evento` mientras la página está abierta; vuelve a calcular sin recargar.
- Los indicadores, el top de productos y las ventas por día que ya existen se mantienen. Su lógica de agrupación se puede llevar a funciones puras junto con la nueva.

La lógica de agrupación (transacciones y cuadre) va en funciones puras en un archivo propio, por ejemplo `src/app/pages/admin/eventos/cuadre.ts`, para poder probarla sin el componente.

## 6. Manejo de errores

| Caso | Comportamiento |
|---|---|
| Se cae la red durante el envío | Va a la cola; el reintento con el mismo id es seguro. |
| La respuesta se pierde después de guardar | El reintento responde `'duplicada'` y se toma como éxito. |
| El producto se desactiva con el carrito abierto | La venta se registra igual. Al restaurar un carrito guardado, la línea se descarta con aviso. |
| Otro POS vendió el último en stock | Se registra igual y el stock queda en 0, como hoy. |
| La RPC rechaza la transacción por validación (no por red) | Se queda en la cola, se muestra un toast de error y se registra en consola. No se descarta en silencio. |
| Recarga a mitad del cobro | El carrito se restaura desde `localStorage`. |

## 7. Pruebas

- **SQL** (contra una rama de Supabase o en local):
  - Una transacción de 2 líneas inserta 2 filas y descuenta el stock de ambas.
  - Repetir el mismo id responde `'duplicada'` sin cambiar el stock.
  - Una línea inválida (cantidad 0 o variante que no pertenece al producto) no deja nada guardado.
  - El usuario anónimo recibe `No autorizado`.
  - `mas_vendidos_evento` ordena bien y excluye las ventas web.
- **Unitarias (admin):** funciones de `cuadre.ts`:
  - agrupación por transacción,
  - filas viejas sin transacción,
  - totales por medio de pago,
  - respaldo al precio actual cuando no hay precio guardado,
  - exclusión de ventas web,
  - filtros por caja y día.
- **POS:** extraer a un módulo que se pueda probar (si el archivo único lo permite) las funciones puras de normalización de búsqueda, orden de la cuadrícula, migración de la cola vieja y atajos de billetes. Si no, probarlas a mano en la verificación.
- **Verificación manual:** dos navegadores con sesión de POS en el mismo evento.
  - Una venta en uno actualiza el stock, el contador y los 🔥 en el otro.
  - En modo avión: vender 3 carritos, volver a conectar y comprobar que se sincronizan una sola vez cada uno.
  - El admin muestra el cuadre en vivo.
  - Abrir el POS con una cola vieja simulada y comprobar que se migra.
