# Códigos de Descuento — Spec

**Fecha:** 2026-06-30  
**Proyecto:** cuac-design (Cuaquiverso tienda)  
**Alcance:** Panel admin (gestión) + Checkout del cliente (aplicar código)

---

## 1. Resumen

Implementar un sistema completo de códigos de descuento con dos superficies:

1. **Admin** — pestaña "Descuentos" dentro de la vista Pedidos del dashboard, con CRUD completo de códigos.
2. **Checkout** — campo con botón "Aplicar" en `/cuaquiverso/checkout` que valida el código en tiempo real y ajusta el total.

Backend: Supabase (tabla `codigos_descuento` + actualización de `pedidos`) + dos Edge Functions (`validar-descuento` nueva, `crear-pedido` actualizada).

---

## 2. Modelo de datos

### Tabla: `codigos_descuento`

```sql
create table codigos_descuento (
  id              uuid primary key default gen_random_uuid(),
  codigo          text unique not null,          -- ej. 'CUAC20', siempre mayúsculas
  tipo            text not null                  -- 'porcentaje' | 'fijo'
                  check (tipo in ('porcentaje', 'fijo')),
  valor           numeric not null,              -- 20 → 20%, 5000 → $5.000
  minimo_orden    numeric not null default 0,    -- monto mínimo del carrito
  limite_usos     integer,                       -- null = ilimitado
  usos_actuales   integer not null default 0,
  productos_ids   text[],                        -- null = todos los productos
  categorias_ids  text[],                        -- null = todas las categorías
  activo          boolean not null default true,
  expira_en       timestamptz,                   -- null = no expira
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
```

### Cambios en tabla: `pedidos`

```sql
alter table pedidos
  add column codigo_descuento text,              -- código aplicado, null si ninguno
  add column descuento_monto  numeric not null default 0;
```

---

## 3. Edge Functions

### `validar-descuento` (nueva)

**Input:**
```ts
{
  codigo:   string,
  subtotal: number,
  items:    { id: string; precio: number; cantidad: number }[]  // id = SKU del producto
}
```

La Edge Function hace un `select id, categoria from productos where id = any($item_ids)` para resolver categorías. Así `CartItem` no necesita cambios — el checkout pasa los items tal cual.

**Output (éxito):**
```ts
{
  valido:           true,
  tipo:             'porcentaje' | 'fijo',
  valor:            number,
  monto_descuento:  number,   // cantidad exacta a descontar en COP
}
```

**Output (error):**
```ts
{
  valido:   false,
  mensaje:  string   // "Código inválido" | "Código expirado" | "Monto mínimo $X" | "Límite de usos alcanzado" | "No aplica para estos productos"
}
```

**Validaciones en orden:**
1. Código existe en `codigos_descuento`
2. `activo = true`
3. `expira_en` es null o está en el futuro
4. `usos_actuales < limite_usos` (o `limite_usos` es null)
5. `subtotal >= minimo_orden`
6. Si `categorias_ids` no es null: al menos un item del carrito pertenece a esas categorías
7. Si `productos_ids` no es null: al menos un item del carrito está en esa lista

Cálculo de `monto_descuento`:
- `tipo = 'porcentaje'`: aplica solo a los items elegibles → `suma_items_elegibles * valor / 100`
- `tipo = 'fijo'`: `valor` directo, no puede superar el subtotal

### `crear-pedido` (actualización)

Acepta dos nuevos campos opcionales en el body:
```ts
{
  // ...campos existentes...
  codigo_descuento?: string,
  descuento_monto?:  number
}
```

Si viene `codigo_descuento`:
1. Re-valida el código (misma lógica que `validar-descuento`) para evitar race conditions.
2. Decrementa `usos_actuales` de forma atómica: `update codigos_descuento set usos_actuales = usos_actuales + 1 where codigo = $1 and (limite_usos is null or usos_actuales < limite_usos) returning id` — si no retorna filas, el pedido falla con "El código ya no está disponible".
3. Guarda `codigo_descuento` y `descuento_monto` en el registro del pedido.
4. El `total` del pedido = `subtotal - descuento_monto + costo_envio`.

---

## 4. Angular — Servicios nuevos y modificados

### `DescuentoService` (nuevo)
**Ruta:** `src/app/pages/cuaquiverso/services/descuento.service.ts`

Signals:
- `codigoAplicado = signal<string | null>(null)`
- `montoDescuento = signal(0)`
- `tipoDescuento = signal<'porcentaje' | 'fijo' | null>(null)`
- `valorDescuento = signal(0)`
- `validando = signal(false)`
- `error = signal<string | null>(null)`

Métodos:
- `async aplicar(codigo: string, items: CartItem[], subtotal: number): Promise<void>` — llama a `validar-descuento`, actualiza signals.
- `limpiar(): void` — resetea todos los signals a sus valores iniciales.

### `CartService`
Sin cambios. El checkout computa el total final directamente: `cart.total() - descuento.montoDescuento()`.

### `CheckoutService` (modificación)
`crearPedido()` acepta un nuevo parámetro opcional `codigoDescuento?: { codigo: string; monto: number }` y lo incluye en el body de la Edge Function.

---

## 5. Admin UI

### Localización
Dentro de `AdminHomeComponent`, la vista `pedidos` gana dos pestañas de nivel superior:

```
[ Pedidos ]  [ Descuentos ]
```

Implementadas con un signal `pedidosSubTab = signal<'pedidos' | 'descuentos'>('pedidos')` en `AdminHomeComponent`.

### Lista de descuentos
Tabla con columnas: **Código** · **Tipo** · **Valor** · **Mínimo** · **Usos** · **Expira** · **Estado** (badge activo/inactivo) · **Acciones** (icono editar, toggle activo, icono eliminar con confirmación inline).

Encabezado: título "Descuentos" + botón "+ Nuevo código".

### Drawer de creación/edición
Mismo patrón visual que el editor de productos (panel lateral deslizante). Campos:

| Campo | Control | Notas |
|---|---|---|
| Código | `input text` | auto-uppercase, sin espacios |
| Tipo | `radio/select` | Porcentaje / Monto fijo |
| Valor | `input number` | sufijo % o $ según tipo |
| Mínimo de orden | `input number` | opcional, default 0 |
| Límite de usos | `input number` | opcional, vacío = ilimitado |
| Categorías | `multiselect` | basado en `CATEGORIES` del mock/Supabase |
| Productos | `multiselect buscable` | busca en `PRODUCTS` |
| Expira en | `input date` | opcional |
| Activo | `toggle` | default true |

Botones: **Guardar** / **Cancelar** / **Eliminar** (solo en edición, con confirmación `¿Eliminar este código? Esta acción no se puede deshacer.`).

### Panel de uso por código
Al expandir una fila (click en la fila): mini-lista con los últimos 5 pedidos que usaron ese código — columnas: referencia, fecha, monto descontado.

---

## 6. Checkout UI

### Ubicación
Después de la lista de ítems del carrito y antes del resumen de totales, en `checkout.component.html`.

### Componente: sección colapsable
```
¿Tienes un código de descuento?  [▾]
```
Al expandir:
```
[ __________________ ]  [ Aplicar ]
```

### Estados visuales

**Vacío:** input + botón "Aplicar" (botón deshabilitado si el input está vacío).

**Validando:** botón muestra spinner, input deshabilitado.

**Aplicado:** el input se reemplaza por una pill:
```
✓  CUAC20  ×
```
El × llama a `descuento.limpiar()`.

**Error:** texto rojo debajo del input con el `mensaje` retornado por la Edge Function.

### Resumen de totales actualizado
```
Subtotal              $151.000
Descuento  CUAC20      −$30.200
──────────────────────────────
Total                 $120.800
```
La línea de descuento solo aparece si hay un código aplicado.

### Integración con `pagar()`
```ts
await this.checkout.crearPedido(
  form,
  items,
  subtotal,
  this.descuento.codigoAplicado()
    ? { codigo: this.descuento.codigoAplicado()!, monto: this.descuento.montoDescuento() }
    : undefined
);
```

---

## 7. Flujo end-to-end

```
Cliente escribe código → click "Aplicar"
  → DescuentoService.aplicar()
    → Edge Function validar-descuento
      → OK: signals actualizados, total re-calculado en UI
      → Error: mensaje mostrado bajo el input

Cliente hace click "Pagar"
  → CheckoutService.crearPedido(..., { codigo, monto })
    → Edge Function crear-pedido
      → Re-valida + decrementa usos_actuales atómicamente
      → Crea pedido con codigo_descuento + descuento_monto
      → Retorna wompi_url con total correcto
        → window.location.href = wompi_url
```

---

## 8. Archivos a crear / modificar

### Nuevos
- `src/app/pages/cuaquiverso/services/descuento.service.ts`
- `supabase/functions/validar-descuento/index.ts`
- Migración SQL: `supabase/migrations/YYYYMMDD_codigos_descuento.sql`

### Modificados
- `src/app/pages/cuaquiverso/checkout/checkout.component.ts` — inyectar `DescuentoService`, campo código, lógica `pagar()`
- `src/app/pages/cuaquiverso/checkout/checkout.component.html` — sección de descuento + resumen de totales actualizado
- `src/app/pages/admin/admin-home.component.ts` — signal `pedidosSubTab`, signals/métodos CRUD de descuentos, llamadas a Supabase
- `src/app/pages/admin/admin-home.component.html` — pestañas Pedidos/Descuentos, tabla de códigos, drawer de creación/edición
- `supabase/functions/crear-pedido/index.ts` — aceptar `codigo_descuento` + decremento atómico de `usos_actuales`

---

## 9. Fuera de alcance

- Descuentos automáticos (sin código, por volumen o cliente VIP)
- Combinación de múltiples códigos en un mismo pedido
- Reporte/analytics de descuentos en el dashboard principal
- Envío de códigos por email desde el admin
