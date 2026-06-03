# Checkout Cuaquiverso — Spec de diseño

**Fecha:** 2026-06-03
**Estado:** Aprobado por el usuario, listo para implementar

---

## Resumen

Flujo de compra completo para la tienda Cuaquiverso. El usuario llena sus datos y dirección en una página, hace clic en un botón de Wompi que lo redirige al hosted checkout, y regresa a una pantalla de confirmación. Los pedidos se guardan en Supabase antes del redirect y se actualizan mediante webhook cuando Wompi confirma el pago.

---

## Rutas

| Ruta | Componente | Descripción |
|---|---|---|
| `/cuaquiverso/checkout` | `CheckoutComponent` | Formulario de datos + envío + botón Wompi |
| `/cuaquiverso/checkout/confirmacion` | `ConfirmacionComponent` | Pantalla post-redirect de Wompi |

Ambas rutas son lazy-loaded y se agregan a `app.routes.ts` como hermanas de las rutas existentes de Cuaquiverso.

---

## Arquitectura

### Flujo completo

```
CartService (items) 
  → /cuaquiverso/checkout
    → usuario llena formulario
    → clic "Pagar con Wompi"
    → CheckoutService.crearPedido()
      → POST supabase/functions/crear-pedido
        → inserta pedidos + pedido_items (estado: pendiente)
        → genera firma de integridad (HMAC-SHA256)
        → devuelve { referencia, wompi_url }
    → window.location.href = wompi_url
  → Wompi hosted checkout
  → Wompi redirige a /cuaquiverso/checkout/confirmacion?ref=CQV-xxx
    → ConfirmacionComponent carga pedido desde Supabase por referencia
    → CartService.clear() — vacía el carrito
    → muestra resumen completo + pasos de seguimiento
  
(Async) Wompi webhook
  → POST supabase/functions/wompi-webhook
    → valida firma del evento
    → actualiza pedidos.estado a "aprobado" | "rechazado"
```

### Componentes Angular nuevos

```
src/app/pages/cuaquiverso/
  checkout/
    checkout.component.ts
    checkout.component.html
    checkout.component.scss
    confirmacion/
      confirmacion.component.ts
      confirmacion.component.html
      confirmacion.component.scss
  services/
    checkout.service.ts   (nuevo — además del cart.service.ts existente)
```

### Supabase Edge Functions nuevas

```
supabase/functions/
  crear-pedido/index.ts
  wompi-webhook/index.ts
```

---

## Datos y modelos

### Tabla `pedidos`

```sql
CREATE TABLE cuaquiverso.pedidos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia   TEXT UNIQUE NOT NULL,       -- CQV-YYYYMMDD-NNNN
  estado       TEXT NOT NULL DEFAULT 'pendiente',
                                           -- pendiente | aprobado | rechazado | cancelado
  nombre       TEXT NOT NULL,
  apellido     TEXT NOT NULL,
  email        TEXT NOT NULL,
  celular      TEXT NOT NULL,
  tipo_doc     TEXT NOT NULL,              -- CC | CE | NIT | PA
  num_doc      TEXT NOT NULL,
  departamento TEXT NOT NULL,
  ciudad       TEXT NOT NULL,
  direccion    TEXT NOT NULL,
  barrio       TEXT,
  codigo_postal TEXT,
  nota         TEXT,
  subtotal     INTEGER NOT NULL,           -- COP, sin centavos (ej: 211000)
  envio        INTEGER NOT NULL DEFAULT 0, -- 0 si gratis, null si contra entrega
  total        INTEGER NOT NULL,           -- igual a subtotal (Wompi solo cobra productos)
  wompi_transaction_id TEXT,
  creado_en    TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla `pedido_items`

```sql
CREATE TABLE cuaquiverso.pedido_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id   UUID NOT NULL REFERENCES cuaquiverso.pedidos(id) ON DELETE CASCADE,
  producto_id TEXT,                        -- ID del producto en InventarioService
  nombre      TEXT NOT NULL,
  sub         TEXT NOT NULL,
  precio      INTEGER NOT NULL,            -- precio unitario en COP
  cantidad    INTEGER NOT NULL DEFAULT 1,
  color       TEXT
);
```

### Interfaces TypeScript

```typescript
// checkout.service.ts
export interface CheckoutForm {
  nombre:       string;
  apellido:     string;
  email:        string;
  celular:      string;
  tipoDoc:      'CC' | 'CE' | 'NIT' | 'PA';
  numDoc:       string;
  departamento: string;
  ciudad:       string;
  direccion:    string;
  barrio:       string;
  codigoPostal: string;
  nota:         string;
}

export interface PedidoCreado {
  referencia: string;
  wompi_url:  string;
}

export interface PedidoDetalle {
  id:           string;
  referencia:   string;
  estado:       string;
  nombre:       string;
  apellido:     string;
  email:        string;
  ciudad:       string;
  direccion:    string;
  barrio:       string | null;
  subtotal:     number;
  total:        number;
  creado_en:    string;
  items:        PedidoItem[];
}

export interface PedidoItem {
  nombre:   string;
  sub:      string;
  precio:   number;
  cantidad: number;
  color:    string;
}
```

---

## CheckoutService

Servicio root-level que actúa como puente entre el formulario, la edge function y la pantalla de confirmación.

```typescript
@Injectable({ providedIn: 'root' })
export class CheckoutService {
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  // Llama a la edge function, retorna wompi_url o lanza error
  async crearPedido(
    form: CheckoutForm,
    items: CartItem[]
  ): Promise<PedidoCreado>

  // Carga el pedido por referencia para la pantalla de confirmación
  async obtenerPedido(referencia: string): Promise<PedidoDetalle | null>
}
```

El servicio usa el cliente de Supabase ya configurado en el proyecto (`SupabaseService` o equivalente). Para `crearPedido` invoca la edge function `crear-pedido`; para `obtenerPedido` hace una query directa a `pedidos` con join a `pedido_items`.

---

## Edge function: `crear-pedido`

**Método:** POST
**Body:**
```json
{
  "form": { ...CheckoutForm },
  "items": [ { "id", "nombre", "sub", "precio", "cantidad", "color" } ],
  "subtotal": 211000
}
```

**Lógica:**
1. Valida presencia de campos requeridos (nombre, email, celular, dirección, al menos 1 item).
2. Genera `referencia`: `CQV-YYYYMMDD-` + 4 dígitos aleatorios, verifica unicidad en DB.
3. Inserta fila en `pedidos` con `estado = 'pendiente'`.
4. Inserta filas en `pedido_items`.
5. Construye URL de Wompi:
   - `amount_in_cents = subtotal * 100`
   - `redirect_url = https://cuacdesign.com/cuaquiverso/checkout/confirmacion`
   - Campos de cliente pre-rellenados (email, nombre, doc, celular)
   - `signature:integrity` = hex(SHA-256(`referencia` + `amount_in_cents` + `"COP"` + `WOMPI_INTEGRITY_SECRET`))
6. Devuelve `{ referencia, wompi_url }`.

**Variables de entorno requeridas:**
- `WOMPI_PUBLIC_KEY` — llave pública de Wompi
- `WOMPI_INTEGRITY_SECRET` — secreto de integridad (nunca sale del servidor)

**Errores manejados:**
- `400` — campos faltantes o carrito vacío
- `409` — colisión de referencia (reintenta con nueva referencia)
- `500` — error de DB

---

## Edge function: `wompi-webhook`

**Método:** POST (llamado por Wompi)

**Lógica:**
1. Extrae `checksum` del header `x-event-checksum`.
2. Valida: `SHA-256(evento_body + WOMPI_EVENTS_SECRET)` debe coincidir.
3. Si evento es `transaction.updated` y `status = APPROVED`: actualiza `pedidos.estado = 'aprobado'`, guarda `wompi_transaction_id`.
4. Si `status = DECLINED` o `VOIDED`: actualiza `estado = 'rechazado'`.
5. Devuelve `200` siempre (Wompi reintenta si no recibe 200).

**Variables de entorno requeridas:**
- `WOMPI_EVENTS_SECRET` — secreto de eventos del webhook

---

## CheckoutComponent (Paso 1)

### Layout
Dos columnas en desktop (≥1024px), una columna en móvil:
- **Izquierda:** sección "Datos personales" + sección "Dirección de envío"
- **Derecha:** resumen del carrito (sticky) + botón Wompi

### Formulario — campos

**Datos personales:**
- Nombre / Apellido (grid 2 col)
- Email / Celular (grid 2 col)
- Tipo de documento / Número de documento (grid 1+2)

**Dirección de envío:**
- Departamento (select) / Ciudad (input)
- Dirección completa (full width)
- Barrio / Código postal (grid 2 col)
- Calculador de envío (ver abajo)
- Nota del pedido (opcional, full width)

### Calculador de envío

Un `select` de ciudades principales con tarifa aproximada. La tarifa es informativa — el cliente paga al courier.

Tabla de tarifas aproximadas (mínimo–máximo COP):

| Ciudad / Zona | Aprox. |
|---|---|
| Bogotá D.C. | $8.000 – $12.000 |
| Medellín, Cali, Barranquilla, Cartagena, Bucaramanga | $12.000 – $16.000 |
| Pereira, Manizales, Armenia, Ibagué, Cúcuta, Villavicencio | $14.000 – $18.000 |
| Neiva, Montería, Santa Marta, Popayán, Pasto | $16.000 – $22.000 |
| Otras ciudades y municipios | $18.000 – $28.000 |

Banner de envío (cambia según subtotal del carrito):
- `subtotal >= 150000` → banner verde "Envío gratis" (Cuaquiverso cubre el flete)
- `subtotal < 150000` → banner naranja "Envío contra entrega — pagas ~$X al recibir"

### Resumen lateral
- Lista de items del `CartService` con swatch de color + nombre + precio × cantidad
- Subtotal
- Envío: "GRATIS" (tag verde) o "Contra entrega ~$X"
- Total = subtotal (Wompi solo cobra productos)
- Botón "Pagar con Wompi" (ember, llamada a `checkout.crearPedido()`)

### Validación
- Validación reactiva con `ReactiveFormsModule` de Angular
- Todos los campos de datos personales son requeridos
- Email: formato válido
- Celular: mínimo 10 dígitos
- Dirección: requerida
- Ciudad: requerida
- El botón Wompi se deshabilita mientras `loading()` es true

### Comportamiento del botón Wompi
1. Muestra spinner, `loading.set(true)`
2. Llama `checkoutService.crearPedido(form, cart.items())`
3. Si éxito: `window.location.href = wompi_url`
4. Si error: `error.set(mensaje)`, banner de error bajo el botón, `loading.set(false)`

### Guard de carrito vacío
Si `cart.count() === 0` al llegar al checkout, redirige a `/cuaquiverso/tienda`.

---

## ConfirmacionComponent (Post-Wompi)

### Carga inicial
1. Lee `ref` de `ActivatedRoute.snapshot.queryParams`
2. Si no hay `ref`: redirige a `/cuaquiverso`
3. Llama `checkoutService.obtenerPedido(ref)` → carga pedido desde Supabase
4. Llama `cart.clear()` — vacía el carrito
5. Mientras carga: estado skeleton/loading

### Layout
- **Hero oscuro (carbon):** ícono de check verde, título "Tu pedido está en camino", referencia del pedido, badge de pago Wompi
- **Grid inferior 2 col (desktop):**
  - Izquierda: lista de productos + tarjeta de dirección con nota de envío contra entrega
  - Derecha: resumen de pago + tarjeta de "¿Qué sigue?" (4 pasos de seguimiento)

### Estados de error
- Pedido no encontrado: mensaje "No encontramos este pedido" + link a `/cuaquiverso/tienda`
- Error de red: reintento automático 1 vez, luego mensaje con link de contacto

### Referencia del pedido
Formato `CQV-YYYYMMDD-NNNN`. Se muestra en monospace en el hero, permite al cliente contactar soporte.

---

## CartService — método `clear()` nuevo

Agregar a `cart.service.ts`:
```typescript
clear() {
  this._items.set([]);
}
```

Llamado por `ConfirmacionComponent` al cargar exitosamente el pedido.

---

## Diseño visual

Sigue el sistema de tokens de Cuaquiverso (cream background, carbon, ember #EC3813). Se reutilizan los estilos existentes del topbar, `.icon-btn`, `.badge` de los 3 componentes ya existentes.

- Topbar: igual al de Tienda/Universo con nav "Tienda / Universo" y carrito
- Formulario: tarjetas blancas sobre cream, bordes `rgba(21,31,40,0.07)`
- Botón Wompi: `#EC3813` con texto "Pagar con Wompi"
- Hero confirmación: `#151F28` (carbon) con texto cream — marca visualmente el éxito
- Barra de progreso: "Paso 1 de 2" / "✓ Paso 1 · ✓ Paso 2" en el topbar

---

## Routing — cambios a `app.routes.ts`

```typescript
{
  path: 'cuaquiverso/checkout',
  loadComponent: () => import('./pages/cuaquiverso/checkout/checkout.component')
    .then(m => m.CheckoutComponent)
},
{
  path: 'cuaquiverso/checkout/confirmacion',
  loadComponent: () => import('./pages/cuaquiverso/checkout/confirmacion/confirmacion.component')
    .then(m => m.ConfirmacionComponent)
}
```

Agregar antes del wildcard de error 404.

---

## CartModal — botón "Ir a pagar"

El botón "Ir a pagar" del `CartModalComponent` existente actualmente apunta a `/cuaquiverso/tienda`. Cambiar destino a `/cuaquiverso/checkout`.

---

## Fuera de alcance

- Sistema de cupones / descuentos
- Cuentas de usuario / historial de pedidos
- Selección de transportista o tiempo de entrega
- Notificaciones push / SMS
- Panel de administración de pedidos (existe en `/admin` separado)
