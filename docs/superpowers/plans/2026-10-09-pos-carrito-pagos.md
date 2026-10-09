# POS: búsqueda rápida, carrito y medio de pago — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el POS venda por carrito con medio de pago (QR / Datáfono / Efectivo), que encontrar productos tome segundos, que todos los POS del evento estén sincronizados en vivo y que el admin tenga cuadre de caja.

**Architecture:** Una migración (`037`) agrega tres columnas a `ventas_evento`, la RPC atómica e idempotente `registrar_transaccion_pos`, la RPC `mas_vendidos_evento` y mete `ventas_evento` en Realtime. La lógica pura del POS sale de `public/pos/index.html` a `public/pos/pos-logic.js` (módulo ES, probado con vitest desde `src/`). El admin agrupa transacciones y calcula el cuadre en funciones puras (`cuadre.ts`) que consume `evento-detail`.

**Tech Stack:** Angular 21 (signals, standalone, `@angular/build:unit-test` con vitest), Supabase (Postgres, PostgREST, Realtime), POS en HTML plano + módulo ES, service worker.

**Spec:** `docs/superpowers/specs/2026-10-08-pos-carrito-pagos-design.md`

## Global Constraints

- Proyecto Supabase: `ytqcwrjxlnlsjgnjxiiw`. En esta sesión el MCP de Supabase (`execute_sql`) sí responde; si falla, usar `node scripts/supabase-sql.mjs` con `SUPABASE_ACCESS_TOKEN` (nunca guardar el token en archivos).
- **Aplicar la migración a producción es irreversible y afecta la tienda en vivo: pedir confirmación explícita al usuario antes.** Las pruebas SQL corren siempre dentro de `begin … rollback`.
- Convención de migraciones: `NNN_snake_case.sql`, `begin; … commit;`, funciones `security definer set search_path = public`, `revoke all … from public`, `revoke execute … from anon`, `grant execute … to authenticated, service_role`. Número: **037** (036 ya es `pedidos_envio`).
- Medios de pago, valores exactos en BD: `'qr'`, `'datafono'`, `'efectivo'`. Etiquetas en UI: «QR», «Datáfono», «Efectivo».
- Observación: ≤ 280 caracteres. Más vendidos: límite 8. Debounce de Realtime: 2000 ms.
- Claves de `localStorage`: `pos_offline_queue_v2`, `pos_carrito`, `pos_mas_vendidos`, `pos_contador_evento`. La vieja `pos_offline_queue` se migra y se borra; `pos_session_tally` deja de usarse.
- Ventas web (`canal = 'web'`) nunca entran en más vendidos, contador ni cuadre.
- Pruebas unitarias: `npx ng test --watch=false --include='<ruta del spec>'`. El builder solo descubre specs dentro de `src/`.
- Textos de UI en español, con el tono del POS actual.
- Rama: trabajar en un worktree propio (`superpowers:using-git-worktrees`) sobre una rama `feat/pos-carrito` creada desde `feat/bold-checkout` (ahí están los commits del POS en `/pos`). No tocar los cambios sin commit de `src/app/pages/admin/productos/` que hay en el checkout principal.

## Review Focus

1. **Doble toque en «Registrar»** — debe quedar una sola venta. El `transaccion_id` se crea una vez por cobro (al abrir la hoja, un poco antes de lo que dice la spec, para cubrir también el doble toque) y el botón se deshabilita mientras envía; un reintento con el mismo id da `'duplicada'`. Test en Task 1 (segunda llamada = `'duplicada'`) y verificación en Task 3 Step 6, punto 2 (doble clic → una sola transacción).
2. **Producto con `precio` null** (la columna lo permite) — se puede vender; la línea guarda `precio_unitario` null, cuenta $0 en el total del POS y el admin usa el respaldo. Tests en Task 2 (`armarTransaccion`, `totalCarrito`) y Task 6 (`montoLinea`).
3. **Tocar muchas veces un producto con poco stock** — el carrito nunca supera el stock de ese producto o combinación. Test en Task 2 (`agregarAlCarrito` con stock 2 tres veces → 2).
4. **Búsqueda con tildes, mayúsculas y espacios** («  PIÑA », «pina») y por categoría — encuentra el producto. Test en Task 2 (`coincideBusqueda`).
5. **Cola vieja con un producto que ya no está en el catálogo** — la venta se migra igual con `precio_unitario` null; no se pierde. Test en Task 2 (`migrarColaVieja`).

---

## File Structure

- `supabase/migrations/037_pos_transacciones.sql` — columnas, `registrar_transaccion_pos`, `mas_vendidos_evento`, Realtime.
- `supabase/tests/037_pos_transacciones.test.sql` — pruebas SQL con `assert`.
- `public/pos/pos-logic.js` — funciones puras del POS (búsqueda, orden, carrito, cobro, cola). Sin DOM ni Supabase.
- `public/pos/pos-logic.d.ts` — tipos para que el spec TS lo importe en modo estricto.
- `src/app/pos/pos-logic.spec.ts` — pruebas del módulo anterior.
- `public/pos/index.html` — UI y cableado (Tasks 3–5).
- `public/pos/sw.js` — shell con `pos-logic.js` y caché de fotos.
- `src/app/pages/admin/eventos/cuadre.ts` + `cuadre.spec.ts` — agrupación por transacción y cuadre.
- `src/app/core/services/inventario.service.ts` (tipo `VentaEvento`), `src/app/core/services/eventos.service.ts`, `src/app/pages/admin/eventos/evento-detail.component.{ts,html,scss}`.

---

### Task 1: Migración 037 y pruebas SQL

**Files:**
- Create: `supabase/migrations/037_pos_transacciones.sql`
- Create: `supabase/tests/037_pos_transacciones.test.sql`

**Interfaces:**
- Produces:
  - Columnas `ventas_evento.transaccion_id uuid`, `metodo_pago text` (check en `'qr','datafono','efectivo'`), `precio_unitario integer` (check `>= 0`), índice `ventas_evento_transaccion_id_idx`.
  - `registrar_transaccion_pos(p_transaccion_id uuid, p_metodo_pago text, p_evento_id text, p_dispositivo text, p_dispositivo_id uuid, p_comentario text, p_vendido_en timestamptz, p_lineas jsonb) returns text` → `'registrada' | 'duplicada'`. `p_lineas`: `[{"producto_id","variante_id"|null,"cantidad","precio_unitario"|null}]`.
  - `mas_vendidos_evento(p_evento_id text, p_limite int default 8) returns table(producto_id uuid, unidades bigint)`.
  - `ventas_evento` en la publicación `supabase_realtime`.

- [ ] **Step 1: Escribir las pruebas SQL**

Mismo encabezado que `supabase/tests/026_variantes.test.sql` (actuar como admin con `set_config('request.jwt.claims', …)`). Crear dos productos de prueba (`'TEST pin'` simple con stock 5 y precio 8000; `'TEST camiseta'` con variantes vía `guardar_variantes`, variante M con stock 3) y un `evento_id` de prueba `'TEST-evento'`. Asserts:

```sql
-- registrada: 2 líneas, stock descontado
v_r := public.registrar_transaccion_pos(v_t, 'efectivo', 'TEST-evento', 'Caja test', null, 'Regalo', now(),
  jsonb_build_array(
    jsonb_build_object('producto_id', v_pin, 'variante_id', null, 'cantidad', 2, 'precio_unitario', 8000),
    jsonb_build_object('producto_id', v_cam, 'variante_id', v_m,  'cantidad', 1, 'precio_unitario', 45000)));
assert v_r = 'registrada';
assert (select count(*) from ventas_evento where transaccion_id = v_t) = 2;
assert (select stock_actual from productos_evento where id = v_pin) = 3;
assert (select stock_actual from producto_variantes where id = v_m) = 2;
assert (select bool_and(metodo_pago = 'efectivo' and comentario = 'Regalo' and canal is null) from ventas_evento where transaccion_id = v_t);
assert (select precio_unitario from ventas_evento where transaccion_id = v_t and producto_id = v_pin) = 8000;

-- duplicada: nada cambia
assert public.registrar_transaccion_pos(v_t, 'efectivo', 'TEST-evento', 'Caja test', null, null, now(), <mismas líneas>) = 'duplicada';
assert (select count(*) from ventas_evento where transaccion_id = v_t) = 2;
assert (select stock_actual from productos_evento where id = v_pin) = 3;

-- stock insuficiente no rechaza: queda en 0
-- (pin con cantidad 10) → 'registrada', stock_actual = 0

-- atómica: segunda línea inválida (cantidad 0) → excepción y no queda la primera
begin
  perform public.registrar_transaccion_pos(v_t2, 'qr', 'TEST-evento', 'Caja test', null, null, now(),
    jsonb_build_array(jsonb_build_object('producto_id', v_pin, 'variante_id', null, 'cantidad', 1, 'precio_unitario', 8000),
                      jsonb_build_object('producto_id', v_pin, 'variante_id', null, 'cantidad', 0, 'precio_unitario', 8000)));
  assert false, 'debía fallar';
exception when others then null;
end;
assert (select count(*) from ventas_evento where transaccion_id = v_t2) = 0;

-- variante ajena, metodo_pago inválido ('nequi'), p_lineas vacío, comentario de 281 chars → excepción
-- metodo_pago null (cola vieja migrada) → 'registrada'

-- mas_vendidos_evento: ordena por unidades desc, respeta el límite, excluye canal 'web'
-- (insertar una fila web directa con evento_id 'TEST-evento' y cantidad 99 → no aparece)

-- 'Venta-regular' funciona igual que un evento con id
```

Al final, en un bloque aparte, actuar como anónimo (`set_config('request.jwt.claims', json_build_object('role','anon')::text, true)`) y comprobar que `registrar_transaccion_pos` y `mas_vendidos_evento` lanzan `'No autorizado'`.

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Enviar por `execute_sql` el texto `begin;` + pruebas + `rollback;` (o `node scripts/supabase-sql.mjs supabase/tests/037_pos_transacciones.test.sql --test supabase/migrations/037_pos_transacciones.sql` con la migración vacía).
Esperado: error `function public.registrar_transaccion_pos(...) does not exist`.

- [ ] **Step 3: Escribir la migración**

Sigue la spec §1 al pie de la letra. Detalles que la spec deja abiertos:
- Validaciones con `raise exception` en español (`'Medio de pago inválido'`, `'La venta no tiene productos'`, `'La cantidad debe ser mayor a 0'`, `'Observación demasiado larga'`).
- Bloqueo: `perform pg_advisory_xact_lock(hashtext(p_transaccion_id::text));` antes del chequeo de existencia.
- Descuento de stock: misma lógica que el cuerpo de `decrementar_stock_seguro` en `026_variantes.sql` (incluido `perform 1 … for update` del producto cuando hay variante). No llamar a `decrementar_stock_seguro` (repetiría el chequeo de permisos, pero sobre todo conviene que el cuerpo quede visible aquí).
- Insert con `sincronizado = true`, `canal = null`, `dispositivo_id = p_dispositivo_id`.
- `mas_vendidos_evento` en `language plpgsql stable security definer`: chequeo de permisos con `raise exception 'No autorizado'` y luego `return query`.
- Realtime: copiar el bloque `do $$ … $$` de `031_realtime_admin.sql` con el arreglo `array['ventas_evento']`.

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

Mismo comando que el Step 2, ahora con la migración. Esperado: sin errores (los `assert` no disparan), termina en `rollback`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/037_pos_transacciones.sql supabase/tests/037_pos_transacciones.test.sql
git commit -m "feat(pos): transacciones con medio de pago, registro atómico e idempotente"
```

- [ ] **Step 6: Aplicar a producción (con confirmación)**

Pedir al usuario confirmación explícita. Con su sí: `apply_migration` (MCP, nombre `037_pos_transacciones`) o `node scripts/supabase-sql.mjs supabase/migrations/037_pos_transacciones.sql`. Verificar con `execute_sql` que existen las tres columnas y que `select tablename from pg_publication_tables where pubname = 'supabase_realtime'` incluye `ventas_evento`.

---

### Task 2: Lógica pura del POS (`pos-logic.js`)

**Files:**
- Create: `public/pos/pos-logic.js`
- Create: `public/pos/pos-logic.d.ts`
- Test: `src/app/pos/pos-logic.spec.ts` (importa `'../../../public/pos/pos-logic.js'`)

**Interfaces:**
- Produces (todas exportadas, puras; los objetos de entrada no se mutan, se devuelven nuevos):
  - `normalizarTexto(s: string): string` — minúsculas, sin diacríticos (`NFD` + quitar `\p{M}`), espacios colapsados y recortados.
  - `coincideBusqueda(producto: {nombre: string, categoria: string|null}, consulta: string): boolean` — consulta vacía → `true`; todas las palabras de la consulta deben aparecer en `nombre + ' ' + categoria` normalizados.
  - `ordenarCatalogo(productos: Producto[], masVendidos: {producto_id: string, unidades: number}[], limite = 8): {producto: Producto, rango: number|null}[]` — primero los más vendidos con `stock_actual > 0` (rango 1…n, máximo `limite`), luego el resto en el orden recibido (ya viene por categoría y nombre).
  - `agregarAlCarrito(carrito: Linea[], producto: Producto, variante: Variante|null): Linea[]` — suma 1 a la línea con mismo `producto_id` + `variante_id` o crea una; tope `(variante ?? producto).stock_actual`.
  - `cambiarCantidad(carrito: Linea[], clave: string, delta: number): Linea[]` — clave `producto_id + '|' + (variante_id ?? '')`; respeta el tope; a 0 se elimina la línea.
  - `totalCarrito(carrito: Linea[]): number` — `Σ cantidad × (precio_unitario ?? 0)`.
  - `unidadesCarrito(carrito: Linea[]): number`.
  - `Linea = {clave, producto_id, variante_id: string|null, nombre, etiqueta_variante: string|null, cantidad, precio_unitario: number|null, stock_max}`. `precio_unitario` se fija al agregar: `variante?.precio ?? producto.precio ?? null`.
  - `restaurarCarrito(guardado: Linea[], productos: Producto[], variantesPorProducto: Record<string, Variante[]>): {carrito: Linea[], descartadas: number}` — descarta líneas cuyo producto o variante ya no está o está agotado; recorta la cantidad al stock actual.
  - `atajosBilletes(total: number): number[]` — el primer múltiplo de 10 000, de 20 000 y de 50 000 **estrictamente mayor** que el total, sin repetir, ordenados (el total exacto ya es el botón «Exacto»).
  - `calcularVueltas(total: number, recibido: number|null): number|null` — `null` si `recibido` es null o menor que el total.
  - `nuevoCobro(): {transaccion_id: string}` — `crypto.randomUUID()`.
  - `armarTransaccion(carrito: Linea[], ctx: {transaccion_id, metodo_pago, evento_id, dispositivo, dispositivo_id, comentario, vendido_en}): Transaccion` — comentario recortado (`trim`), vacío → null, máximo 280; `lineas` = `{producto_id, variante_id, cantidad, precio_unitario}`.
  - `migrarColaVieja(cola: VentaVieja[], productos: Producto[], variantesPorProducto, uuid: () => string): Transaccion[]` — una transacción por venta, `metodo_pago: null`, precio del catálogo local (`variante.precio ?? producto.precio`) o null si no está; conserva `evento_id` (por defecto `'Venta-regular'`), `vendido_en`, `dispositivo`, `dispositivo_id`, `comentario`.
  - `sumarPendientes(masVendidos: {producto_id, unidades}[], cola: Transaccion[]): {producto_id, unidades}[]` — suma las unidades de la cola y reordena desc.
  - `resumenPendientes(cola: Transaccion[]): {ventas: number, total: number}`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`src/app/pos/pos-logic.spec.ts`, con un `describe` por función. Casos con valores exactos:

```ts
expect(normalizarTexto('  PIÑA   Colada ')).toBe('pina colada');
expect(coincideBusqueda({ nombre: 'Sticker Piña', categoria: 'Stickers' }, 'pina')).toBe(true);
expect(coincideBusqueda({ nombre: 'Pin Pato astronauta', categoria: 'Pines' }, 'astro pato')).toBe(true);
expect(coincideBusqueda({ nombre: 'Tote', categoria: 'Bolsos' }, 'bols')).toBe(true);
expect(coincideBusqueda({ nombre: 'Tote', categoria: null }, 'pin')).toBe(false);

// ordenarCatalogo: el agotado no sube aunque sea el más vendido; límite 2
const r = ordenarCatalogo([a, b, c, agotado], [{producto_id: agotado.id, unidades: 9}, {producto_id: c.id, unidades: 5}, {producto_id: b.id, unidades: 3}], 2);
expect(r.map(x => [x.producto.id, x.rango])).toEqual([[c.id, 1], [b.id, 2], [a.id, null], [agotado.id, null]]);

// agregarAlCarrito con stock 2, tres toques → cantidad 2
// variante con precio 55000 en producto de 45000 → precio_unitario 55000
// producto con precio null → precio_unitario null; totalCarrito cuenta 0
// cambiarCantidad(…, -1) desde 1 → línea eliminada
expect(atajosBilletes(66000)).toEqual([70000, 80000, 100000]);
expect(atajosBilletes(20000)).toEqual([30000, 40000, 50000]);   // 20000 es «Exacto», no se repite
expect(calcularVueltas(66000, 100000)).toBe(34000);
expect(calcularVueltas(66000, 50000)).toBeNull();
expect(calcularVueltas(66000, null)).toBeNull();

// armarTransaccion: comentario '   ' → null; comentario de 300 chars → 280
// nuevoCobro devuelve ids distintos en dos llamadas

// migrarColaVieja: producto ausente del catálogo → precio_unitario null y la venta no se pierde;
//   evento_id ausente → 'Venta-regular'; metodo_pago null
// restaurarCarrito: producto ausente → descartadas 1; stock bajó a 1 con cantidad 3 → cantidad 1
// sumarPendientes: suma y reordena; producto solo en la cola aparece
```

Sobre `atajosBilletes(20000)`: 20 000 ya es «Exacto», así que de 10 000 y 20 000 se toma el siguiente múltiplo (30 000 y 40 000) y de 50 000 queda 50 000.

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx ng test --watch=false --include='src/app/pos/pos-logic.spec.ts'`
Esperado: FAIL, no encuentra el módulo `public/pos/pos-logic.js`.

- [ ] **Step 3: Implementar `pos-logic.js` y `pos-logic.d.ts`**

JS plano con JSDoc, sin dependencias. El `.d.ts` declara exactamente las firmas de arriba (tipos `Producto`, `Variante`, `Linea`, `Transaccion`, `VentaVieja`).

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx ng test --watch=false --include='src/app/pos/pos-logic.spec.ts'`
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/pos/pos-logic.js public/pos/pos-logic.d.ts src/app/pos/pos-logic.spec.ts
git commit -m "feat(pos): lógica pura de búsqueda, carrito, cobro y cola"
```

---

### Task 3: POS — carrito, hoja de cobro y registro por transacción

Al terminar esta tarea el POS vende por carrito con medio de pago, con la cuadrícula actual. El rediseño del catálogo es la Task 4.

**Files:**
- Modify: `public/pos/index.html` (hoja `#sale-modal` → hoja de combinación + hoja de cobro; `confirmSale`, `syncOfflineQueue`, `getOfflineQueue`/`saveOfflineQueue`, tally)
- Modify: `public/pos/sw.js` (agregar `'/pos/pos-logic.js'` a `SHELL`, subir `CACHE` a `'pos-v3'`)

**Interfaces:**
- Consumes: todo lo de Task 2; RPC `registrar_transaccion_pos` de Task 1.
- Produces (para Task 4 y 5): estado global `carrito: Linea[]`, `cobro: {transaccion_id} | null`; funciones `window.tocarProducto(productoId)`, `renderCarritoBar()`, `persistirCarrito()`; evento interno `onVentaRegistrada(transaccion)` (lo usa Task 5 para refrescar contador y más vendidos); cola en `pos_offline_queue_v2`.

- [ ] **Step 1: Importar el módulo**

En el `<script type="module">`: `import { … } from './pos-logic.js';`. Verificar en el navegador que el POS sigue cargando el catálogo (abrir `npx ng serve` → `http://localhost:4200/pos/`, iniciar sesión con una cuenta de operador).

- [ ] **Step 2: Tocar = agregar al carrito**

`openSaleModal` se sustituye por `tocarProducto(id)`: sin variantes → `agregarAlCarrito` + `flashCard` + contador `×N` en la tarjeta; con variantes → hoja de combinación (reutiliza el markup de `#modal-variants` y el aviso de reservas web) y al elegir agrega y cierra. Barra del carrito fija abajo (`N productos · $total · Cobrar →`), visible solo con líneas. `persistirCarrito()` guarda en `pos_carrito` en cada cambio; al cargar el catálogo, `restaurarCarrito` + toast si `descartadas > 0` («N productos del carrito ya no están disponibles»).

- [ ] **Step 3: Hoja de cobro**

Markup y comportamiento de la spec §3 (maqueta aprobada: `.superpowers/brainstorm/1416-1791520449/content/cobro.html`). Al abrir: `cobro = nuevoCobro()`. Medio de pago con selección única; botón deshabilitado con el texto «Elige el medio de pago» hasta elegir; luego «Registrar $total · Medio». Efectivo: input `inputmode="numeric"`, botones `Exacto` + `atajosBilletes(total)`, vueltas con `calcularVueltas`. «+ Agregar observación» con `maxlength="280"`. Cerrar sin registrar conserva carrito y `cobro`. Si cambia el carrito con la hoja abierta (− / + / 🗑), el `transaccion_id` se conserva (todavía no se envió nada).

- [ ] **Step 4: Registrar**

`registrarCobro()`: deshabilita el botón («Registrando…») → `armarTransaccion(carrito, {…cobro, metodo_pago, evento_id: eventoActivo?.id ?? 'Venta-regular', dispositivo: getDeviceName(), dispositivo_id: getDeviceId(), comentario, vendido_en: new Date().toISOString()})`. Con internet: `sb.rpc('registrar_transaccion_pos', {...})`; `'registrada'` o `'duplicada'` → descuento optimista del stock local, toast «Venta registrada · $total · Medio», `onVentaRegistrada(t)`. Error de red o sin conexión → a la cola v2 + toast actual de guardado local. Error de validación devuelto por la RPC (código `P0001`) → no se encola, toast de error con el mensaje y el carrito se queda para corregir. En los dos primeros casos: vaciar carrito, `cobro = null`, borrar `pos_carrito`, cerrar hoja.

- [ ] **Step 5: Cola v2 y migración de la cola vieja**

`syncOfflineQueue` recorre `pos_offline_queue_v2` llamando a la RPC con el mismo id; `'registrada'`/`'duplicada'` salen de la cola; errores se quedan (y si es `P0001`, se loguea en consola y se avisa con toast de error, sin descartar). Al arrancar (después de tener catálogo local): si existe `pos_offline_queue`, `migrarColaVieja(…, () => crypto.randomUUID())`, añadir a la v2 y borrar la clave vieja. El chip de pendientes cuenta transacciones. Eliminar el `insert` directo y la llamada a `decrementar_stock_seguro`. El tally por dispositivo queda como está hasta Task 5 (allí se sustituye).

- [ ] **Step 6: Verificación manual**

Con `ng serve` y el SW desactivado en DevTools (Application → «Bypass for network»):
1. Carrito de 2 productos (uno con talla) pagado en Efectivo con recibido 100 000 → vueltas correctas; en BD (`execute_sql`) 2 filas con el mismo `transaccion_id`, `metodo_pago = 'efectivo'` y `precio_unitario`.
2. Doble clic rápido en «Registrar» → una sola transacción en BD.
3. DevTools → Offline: 2 carritos → chip «2 pendientes»; Online → se sincronizan una vez cada uno.
4. Poner a mano en `localStorage.pos_offline_queue` una venta vieja (`[{producto_id, cantidad:1, vendido_en, evento_id:'Venta-regular'}]`), recargar → aparece en la BD con `metodo_pago` null y la clave vieja desaparece.
5. Recargar con el carrito lleno → el carrito sigue ahí.

Borrar después las ventas de prueba (con confirmación del usuario si están en producción).

- [ ] **Step 7: Commit**

```bash
git add public/pos/index.html public/pos/sw.js
git commit -m "feat(pos): carrito con medio de pago, vueltas y registro atómico"
```

---

### Task 4: POS — catálogo «vender primero»

**Files:**
- Modify: `public/pos/index.html` (header, buscador, chips, cuadrícula, tarjetas, `loadProducts`, catálogo local)
- Modify: `public/pos/sw.js` (caché de fotos)

**Interfaces:**
- Consumes: `coincideBusqueda`, `ordenarCatalogo` (Task 2); `tocarProducto`, `carrito` (Task 3).
- Produces (para Task 5): variable `masVendidos: {producto_id, unidades}[]` (inicialmente `[]`) y `aplicarOrdenSiCarritoVacio()` que recalcula el orden 🔥 solo si `carrito.length === 0`; `renderProducts()` lee el orden ya calculado y el texto del buscador.

- [ ] **Step 1: Zona fija arriba**

Según la spec §2 y la maqueta `catalogo-v2.html`: una línea (evento, punto de conexión, contador; al tocar despliega dispositivo y pendientes), buscador (`type="search"`, `enterkeyhint="search"`, ✕ para limpiar) y fila de chips `Todo` · `🔥 Más vendidos` (oculto si `masVendidos` está vacío) · categorías (de los productos activos, orden alfabético). `position: sticky; top: 0`.

- [ ] **Step 2: Filtrado y orden**

`renderProducts()`: con texto → `coincideBusqueda` sobre todos y sin marcas 🔥 ni chips visibles; sin texto → orden de `ordenarCatalogo(products, masVendidos)` calculado por `aplicarOrdenSiCarritoVacio()`, filtrado por el chip activo (`🔥` = solo con rango). Escribir en el buscador re-renderiza en cada `input` (son 42 productos; sin debounce). Tras `onVentaRegistrada`, limpiar el buscador y volver a `Todo`.

- [ ] **Step 3: Tarjetas compactas con foto**

Agregar `fotos` al `select` de `loadProducts` y a `guardarCatalogoLocal`/`cargarCatalogoLocal`. Tarjeta: foto (`fotos[0]`, `loading="lazy"`, `object-fit: cover`, alto ~64 px) o el bloque de color actual con el nombre; nombre, precio, stock; marca `🔥N` arriba a la izquierda, `×N` del carrito arriba a la derecha. Si las URLs son de Supabase Storage público, pedir miniatura con `/render/image/public/…?width=200&quality=60`; si la transformación no está habilitada en el proyecto (probar una URL), usar la original. Objetivo: 8 tarjetas visibles sin desplazar en un viewport de 390×844.

- [ ] **Step 4: Fotos sin internet**

`sw.js`: para `GET` a `*.supabase.co/storage/v1/` (object o render), estrategia caché primero con caché aparte `'pos-fotos-v1'` (no borrarla en `activate`); respuesta de red ok → guardar copia. No interceptar otras peticiones a Supabase.

- [ ] **Step 5: Verificación manual**

En DevTools con dispositivo 390×844: 8 tarjetas visibles al abrir; «pina» y «PIÑA» encuentran el mismo producto; chip de categoría filtra; un producto con foto la muestra; Offline + recarga → las fotos ya vistas siguen; tocar sigue agregando al carrito.

- [ ] **Step 6: Commit**

```bash
git add public/pos/index.html public/pos/sw.js
git commit -m "feat(pos): buscador, categorías, fotos y catálogo compacto"
```

---

### Task 5: POS — sincronización en vivo, más vendidos y contador del evento

**Files:**
- Modify: `public/pos/index.html`

**Interfaces:**
- Consumes: `mas_vendidos_evento` y Realtime de `ventas_evento` (Task 1); `sumarPendientes`, `resumenPendientes` (Task 2); `onVentaRegistrada` (Task 3); `masVendidos`, `aplicarOrdenSiCarritoVacio` (Task 4).

- [ ] **Step 1: Más vendidos**

`cargarMasVendidos()`: `sb.rpc('mas_vendidos_evento', {p_evento_id: eventoId(), p_limite: 8})` → guarda en `pos_mas_vendidos` (con `evento_id`) → `masVendidos = sumarPendientes(resultado, cola)` → `aplicarOrdenSiCarritoVacio()`. Sin red: usar lo guardado (solo si es del mismo evento) + `sumarPendientes`. Llamar al mostrar el catálogo y en `onVentaRegistrada`. Cuando el carrito pasa a vacío (registro o vaciado), llamar a `aplicarOrdenSiCarritoVacio()`.

- [ ] **Step 2: Contador del evento**

`cargarContadorEvento()`: `select('transaccion_id, id, cantidad, precio_unitario, productos_evento(precio)')` de `ventas_evento` con `evento_id = eventoId()` y `canal` null (`.is('canal', null)`); ventas = transacciones distintas (filas sin `transaccion_id` cuentan una cada una); total = `Σ cantidad × (precio_unitario ?? productos_evento.precio ?? 0)`. Guardar en `pos_contador_evento`; mostrar `base + resumenPendientes(cola)`. Sustituye a `getTally/addTally/renderTally` y a `pos_session_tally` (eliminarlos).

- [ ] **Step 3: Realtime**

En `subscribeRealtime`, agregar `.on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'ventas_evento', filter: 'evento_id=eq.' + eventoId()}, programarRefresco)`. `programarRefresco` hace debounce de 2000 ms y llama a `cargarContadorEvento()` y `cargarMasVendidos()`. El stock ya llega por las suscripciones existentes.

- [ ] **Step 4: Verificación manual con dos POS**

Dos navegadores (uno en incógnito) con sesión de operador en el mismo evento:
1. Venta en A → en B, en ≤ 3 s, cambian stock y contador; si B tiene el carrito vacío, los 🔥 se reordenan.
2. B con un producto en el carrito: venta en A → el orden de B no cambia hasta vaciar su carrito; el stock sí.
3. B en Offline vende 1 → su contador suma la pendiente; al volver Online, A la recibe.

- [ ] **Step 5: Commit**

```bash
git add public/pos/index.html
git commit -m "feat(pos): todos los POS del evento sincronizados en vivo"
```

---

### Task 6: Admin — lógica del cuadre (`cuadre.ts`)

**Files:**
- Create: `src/app/pages/admin/eventos/cuadre.ts`
- Test: `src/app/pages/admin/eventos/cuadre.spec.ts`
- Modify: `src/app/core/services/inventario.service.ts:71-84` (tipo `VentaEvento`)

**Interfaces:**
- Produces:
  - En `VentaEvento`: `transaccion_id?: string | null; metodo_pago?: 'qr' | 'datafono' | 'efectivo' | null; precio_unitario?: number | null; dispositivo_id?: string | null;` y `canal: 'evento' | 'web' | null`.
  - `type MetodoCuadre = 'efectivo' | 'qr' | 'datafono' | 'sin_registrar'`.
  - `montoLinea(v: VentaEvento): number` — `cantidad × (precio_unitario ?? productos_evento?.precio ?? 0)`.
  - `diaLocal(iso: string): string` — `YYYY-MM-DD` en `America/Bogota` (`Intl.DateTimeFormat('en-CA', {timeZone: 'America/Bogota'})`).
  - `claveCaja(v: VentaEvento): string` — `dispositivo_id ?? 'nombre:' + (dispositivo ?? 'Sin caja')`.
  - `interface TransaccionAdmin { id: string; vendido_en: string; caja: string; cajaNombre: string; metodo: MetodoCuadre; lineas: {nombre: string; variante: string | null; cantidad: number}[]; comentario: string | null; total: number }`.
  - `agruparTransacciones(ventas: VentaEvento[]): TransaccionAdmin[]` — excluye `canal === 'web'`; agrupa por `transaccion_id` (filas sin él, una transacción cada una con `id = fila.id`); orden desc por `vendido_en`; `variante` = valores de `producto_variantes.opciones` unidos con ` / `.
  - `filtrar(tx: TransaccionAdmin[], f: {caja: string | null; dia: string | null}): TransaccionAdmin[]`.
  - `cuadre(tx: TransaccionAdmin[]): Record<MetodoCuadre, {total: number; ventas: number}>` — siempre las cuatro claves.
  - `cajas(tx: TransaccionAdmin[]): {clave: string; nombre: string}[]` y `dias(tx): string[]` para los selectores.

- [ ] **Step 1: Escribir las pruebas que fallan**

Fixture: 2 filas de la transacción `T1` (efectivo, `precio_unitario` 8000×2 y 45000×1, caja `d1`), 1 fila `T2` (qr, 5000×3, caja `d2`), 1 fila vieja sin transacción ni precio (`productos_evento.precio` 4000, cantidad 1, `metodo_pago` null), 1 fila `canal: 'web'` (cantidad 99). Asserts:

```ts
const tx = agruparTransacciones(ventas);
expect(tx).toHaveLength(3);                                   // web excluida
expect(tx.find(t => t.id === 'T1')!.total).toBe(61000);
expect(tx.find(t => t.id === 'T1')!.lineas).toHaveLength(2);
expect(cuadre(tx)).toEqual({
  efectivo: { total: 61000, ventas: 1 }, qr: { total: 15000, ventas: 1 },
  datafono: { total: 0, ventas: 0 }, sin_registrar: { total: 4000, ventas: 1 } });
expect(montoLinea({ ...filaVieja, productos_evento: { nombre: 'x', categoria: 'y' } })).toBe(0);  // sin precio
expect(diaLocal('2026-10-12T03:30:00Z')).toBe('2026-10-11');   // 10:30 pm en Bogotá
expect(filtrar(tx, { caja: 'd2', dia: null }).map(t => t.id)).toEqual(['T2']);
// precio_unitario guardado gana sobre el precio actual del producto
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx ng test --watch=false --include='src/app/pages/admin/eventos/cuadre.spec.ts'`
Esperado: FAIL, no existe `./cuadre`.

- [ ] **Step 3: Implementar `cuadre.ts` y ampliar `VentaEvento`**

- [ ] **Step 4: Correr y verificar que pasan**

Mismo comando. Esperado: PASS. Correr también `npx ng test --watch=false` completo para ver que el cambio de tipo no rompe otros specs.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/eventos/cuadre.ts src/app/pages/admin/eventos/cuadre.spec.ts src/app/core/services/inventario.service.ts
git commit -m "feat(admin): cuadre de caja por medio de pago, caja y día"
```

---

### Task 7: Admin — paneles «Cuadre de caja» y «Ventas» en vivo

**Files:**
- Modify: `src/app/core/services/eventos.service.ts:83-93` (`getVentasEvento`)
- Modify: `src/app/pages/admin/eventos/evento-detail.component.{ts,html,scss}`

**Interfaces:**
- Consumes: todo lo de Task 6.

- [ ] **Step 1: Traer las columnas nuevas**

`getVentasEvento` → `.select('*, productos_evento(nombre, categoria, precio), producto_variantes(opciones)')` (`*` ya incluye las columnas nuevas). Mismo filtro por fechas.

- [ ] **Step 2: Estado y computeds**

En el componente: `transacciones = computed(() => agruparTransacciones(this.ventas()))`, señales `filtroCaja = signal<string | null>(null)`, `filtroDia = signal<string | null>(null)`, `visibles = signal(50)`; `filtradas`, `cuadreActual`, `listaCajas`, `listaDias` como computeds. Corregir `totalCOP` para usar `montoLinea` (así los indicadores existentes también respetan el precio congelado).

- [ ] **Step 3: Plantilla**

Debajo de `.kpi-strip`, panel «Cuadre de caja» con los dos `<select>` y las cuatro casillas (Efectivo, QR, Datáfono, Sin registrar: total con `fmtCOP` y «N ventas»; la de Sin registrar con el texto «versión anterior del POS»). Después, panel «Ventas» con la tabla Hora / Caja / Productos (+ observación en cursiva) / Pago (etiqueta de color) / Total, las primeras `visibles()` filas y el botón «Ver más» (+50). Estado vacío: «Sin ventas del POS en este evento.». Usar clases existentes (`panel`, `panel-h`, `tbl`, `kpi-item` con `data-tone`); colores por medio: efectivo `selva`, QR `rio`, datáfono `sol`, sin registrar neutro. Referencia visual: `.superpowers/brainstorm/1416-1791520449/content/admin.html`.

- [ ] **Step 4: En vivo**

En `ngOnInit`, después de cargar: canal `supabase.channel('evento-ventas-' + id).on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'ventas_evento'}, …)` con debounce de 2000 ms que vuelve a llamar a `getVentasEvento`. Quitar el canal en `ngOnDestroy`. Seguir el patrón de suscripción que ya usa el admin (buscar `channel(` en `src/app/core/services`) y el `inject` de Supabase del servicio.

- [ ] **Step 5: Verificar**

Run: `npx ng build` → sin errores. Luego `npx ng serve`, abrir `/admin/eventos/<id del evento de prueba>`: el cuadre coincide con las ventas de prueba de Task 3; cambiar filtros de caja y día cambia casillas y lista; registrar una venta desde el POS → aparece en ≤ 3 s sin recargar.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/services/eventos.service.ts src/app/pages/admin/eventos/evento-detail.component.ts src/app/pages/admin/eventos/evento-detail.component.html src/app/pages/admin/eventos/evento-detail.component.scss
git commit -m "feat(admin): cuadre de caja y ventas por transacción en vivo"
```

---

### Task 8: Verificación final

- [ ] **Step 1:** `npx ng test --watch=false` → todo PASS. `npx ng build` → sin errores.
- [ ] **Step 2:** Recorrer la verificación manual de la spec §7 completa (dos POS, modo avión con 3 carritos, admin en vivo, cola vieja simulada) sobre el build (`npx ng serve` o el preview de Firebase), esta vez con el service worker activo para comprobar que el POS abre sin internet y carga `pos-logic.js` desde caché.
- [ ] **Step 3:** Borrar las ventas de prueba de producción, con confirmación del usuario, y devolver el stock que descontaron (`registrar_restock` o ajuste manual).
- [ ] **Step 4:** Informar al usuario: qué se verificó, qué no, y que el despliegue a `cuacdesign.com/pos/` queda pendiente de su visto bueno.
