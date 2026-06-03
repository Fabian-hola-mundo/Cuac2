# Checkout Cuaquiverso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el flujo de compra completo para Cuaquiverso: formulario de datos/envío → redirect a Wompi → pantalla de confirmación, con persistencia de pedidos en Supabase.

**Architecture:** Dos rutas Angular lazy-loaded (`/cuaquiverso/checkout` y `/cuaquiverso/checkout/confirmacion`). El pedido se crea en Supabase via edge function `crear-pedido` antes del redirect a Wompi; el webhook `wompi-webhook` actualiza el estado cuando Wompi confirma el pago. El estado del carrito vive en `CartService` (ya existente); `CheckoutService` (nuevo) maneja la comunicación con las edge functions y Supabase.

**Tech Stack:** Angular 21, signals, ReactiveFormsModule, Supabase JS v2, Deno edge functions, Wompi hosted checkout (redirect), Web Crypto API (SHA-256 para integridad).

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `supabase/migrations/005_pedidos.sql` | Crear | Tablas `pedidos` + `pedido_items`, RLS |
| `src/app/pages/cuaquiverso/services/cart.service.ts` | Modificar | Agregar método `clear()` |
| `src/app/pages/cuaquiverso/cart-modal/cart-modal.component.html` | Modificar | Link "Ir a pagar" → `/cuaquiverso/checkout` |
| `src/app/pages/cuaquiverso/services/checkout.service.ts` | Crear | Interfaces + llamada edge function + query Supabase |
| `supabase/functions/crear-pedido/index.ts` | Crear | Inserta pedido, genera URL Wompi con firma |
| `supabase/functions/wompi-webhook/index.ts` | Crear | Valida evento Wompi, actualiza estado del pedido |
| `src/app/pages/cuaquiverso/checkout/checkout.component.scss` | Crear | Estilos del formulario |
| `src/app/pages/cuaquiverso/checkout/checkout.component.html` | Crear | Template: form + resumen lateral |
| `src/app/pages/cuaquiverso/checkout/checkout.component.ts` | Crear | Lógica del formulario reactivo + botón Wompi |
| `src/app/pages/cuaquiverso/checkout/confirmacion/confirmacion.component.scss` | Crear | Estilos de la pantalla de confirmación |
| `src/app/pages/cuaquiverso/checkout/confirmacion/confirmacion.component.html` | Crear | Template: hero + resumen del pedido |
| `src/app/pages/cuaquiverso/checkout/confirmacion/confirmacion.component.ts` | Crear | Carga pedido por referencia, limpia carrito |
| `src/app/app.routes.ts` | Modificar | Agregar rutas checkout y confirmacion |

---

## Task 1: Migración SQL — tablas pedidos + pedido_items

**Files:**
- Crear: `supabase/migrations/005_pedidos.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/005_pedidos.sql

CREATE TABLE pedidos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia    text        UNIQUE NOT NULL,
  estado        text        NOT NULL DEFAULT 'pendiente',
  nombre        text        NOT NULL,
  apellido      text        NOT NULL,
  email         text        NOT NULL,
  celular       text        NOT NULL,
  tipo_doc      text        NOT NULL,
  num_doc       text        NOT NULL,
  departamento  text        NOT NULL,
  ciudad        text        NOT NULL,
  direccion     text        NOT NULL,
  barrio        text,
  codigo_postal text,
  nota          text,
  subtotal      integer     NOT NULL,
  total         integer     NOT NULL,
  wompi_transaction_id text,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pedido_items (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id  uuid    NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  nombre     text    NOT NULL,
  sub        text    NOT NULL,
  precio     integer NOT NULL,
  cantidad   integer NOT NULL DEFAULT 1,
  color      text
);

-- RLS
ALTER TABLE pedidos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;

-- La edge function usa service_role (bypassa RLS) para INSERT.
-- El cliente anon necesita SELECT para la pantalla de confirmación.
CREATE POLICY "anon puede leer pedidos"      ON pedidos      FOR SELECT TO anon USING (true);
CREATE POLICY "anon puede leer pedido_items" ON pedido_items FOR SELECT TO anon USING (true);
```

- [ ] **Step 2: Aplicar la migración**

```bash
npx supabase db push
```

Verificar en el dashboard de Supabase que existen las tablas `pedidos` y `pedido_items`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_pedidos.sql
git commit -m "feat(db): tablas pedidos y pedido_items para checkout"
```

---

## Task 2: CartService — agregar clear() + CartModal update

**Files:**
- Modificar: `src/app/pages/cuaquiverso/services/cart.service.ts`
- Modificar: `src/app/pages/cuaquiverso/cart-modal/cart-modal.component.html`

- [ ] **Step 1: Agregar clear() a CartService**

Abrir `src/app/pages/cuaquiverso/services/cart.service.ts` y agregar después del método `remove()`:

```typescript
  clear() {
    this._items.set([]);
    this.isOpen.set(false);
  }
```

- [ ] **Step 2: Actualizar el link "Ir a pagar" en CartModal**

En `src/app/pages/cuaquiverso/cart-modal/cart-modal.component.html`, cambiar la línea:

```html
      <a class="btn-checkout" href="/cuaquiverso/tienda">
```

por:

```html
      <a class="btn-checkout" href="/cuaquiverso/checkout">
```

- [ ] **Step 3: Verificar build**

```bash
npx ng build --configuration=development 2>&1 | tail -5
```

Resultado esperado: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/cuaquiverso/services/cart.service.ts \
        src/app/pages/cuaquiverso/cart-modal/cart-modal.component.html
git commit -m "feat(cart): agregar clear() y apuntar modal a /checkout"
```

---

## Task 3: CheckoutService — interfaces y servicio Angular

**Files:**
- Crear: `src/app/pages/cuaquiverso/services/checkout.service.ts`

- [ ] **Step 1: Crear el servicio**

```typescript
// src/app/pages/cuaquiverso/services/checkout.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CartItem } from './cart.service';

export interface CheckoutForm {
  nombre:       string;
  apellido:     string;
  email:        string;
  celular:      string;
  tipoDoc:      string;
  numDoc:       string;
  departamento: string;
  ciudad:       string;
  direccion:    string;
  barrio:       string;
  codigoPostal: string;
  nota:         string;
}

export interface PedidoItem {
  nombre:   string;
  sub:      string;
  precio:   number;
  cantidad: number;
  color:    string;
}

export interface PedidoDetalle {
  id:          string;
  referencia:  string;
  estado:      string;
  nombre:      string;
  apellido:    string;
  email:       string;
  ciudad:      string;
  direccion:   string;
  barrio:      string | null;
  subtotal:    number;
  total:       number;
  creado_en:   string;
  pedido_items: PedidoItem[];
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private supabase = inject(SupabaseService);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  async crearPedido(
    form: CheckoutForm,
    items: CartItem[],
    subtotal: number,
  ): Promise<{ referencia: string; wompi_url: string }> {
    const { data, error } = await this.supabase.db.functions.invoke('crear-pedido', {
      body: {
        form,
        items: items.map(i => ({
          nombre:   i.name,
          sub:      i.sub,
          precio:   i.price,
          cantidad: i.qty,
          color:    i.color,
        })),
        subtotal,
      },
    });

    if (error) throw new Error(error.message);
    if (!data?.wompi_url) throw new Error('Respuesta inválida del servidor');
    return data as { referencia: string; wompi_url: string };
  }

  async obtenerPedido(referencia: string): Promise<PedidoDetalle | null> {
    const { data, error } = await this.supabase.db
      .from('pedidos')
      .select(`
        id, referencia, estado, nombre, apellido, email,
        ciudad, direccion, barrio, subtotal, total, creado_en,
        pedido_items ( nombre, sub, precio, cantidad, color )
      `)
      .eq('referencia', referencia)
      .single();

    if (error || !data) return null;
    return data as PedidoDetalle;
  }
}
```

- [ ] **Step 2: Verificar build**

```bash
npx ng build --configuration=development 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/cuaquiverso/services/checkout.service.ts
git commit -m "feat(checkout): CheckoutService con crearPedido y obtenerPedido"
```

---

## Task 4: Edge function — crear-pedido

**Files:**
- Crear: `supabase/functions/crear-pedido/index.ts`

- [ ] **Step 1: Crear la edge function**

```typescript
// supabase/functions/crear-pedido/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function isStr(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0 }
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function sha256hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function generarReferencia(): string {
  const now    = new Date()
  const fecha  = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
  const sufijo = String(Math.floor(Math.random() * 9000 + 1000))
  return `CQV-${fecha}-${sufijo}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const { form, items, subtotal } = body

    // Validación básica
    if (
      !isStr(form?.nombre) || !isStr(form?.apellido) ||
      !isStr(form?.email)  || !isStr(form?.celular)  ||
      !isStr(form?.tipoDoc) || !isStr(form?.numDoc)  ||
      !isStr(form?.departamento) || !isStr(form?.ciudad) ||
      !isStr(form?.direccion) ||
      !Array.isArray(items) || items.length === 0 ||
      typeof subtotal !== 'number' || subtotal <= 0
    ) {
      return json({ ok: false, error: 'Faltan campos requeridos' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Generar referencia única (reintento si hay colisión)
    let referencia = generarReferencia()
    const { data: existing } = await supabase
      .from('pedidos').select('id').eq('referencia', referencia).maybeSingle()
    if (existing) referencia = generarReferencia() // segundo intento

    // Insertar pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        referencia,
        nombre:       form.nombre.trim(),
        apellido:     form.apellido.trim(),
        email:        form.email.trim().toLowerCase(),
        celular:      form.celular.trim(),
        tipo_doc:     form.tipoDoc,
        num_doc:      form.numDoc.trim(),
        departamento: form.departamento.trim(),
        ciudad:       form.ciudad.trim(),
        direccion:    form.direccion.trim(),
        barrio:       form.barrio?.trim() || null,
        codigo_postal:form.codigoPostal?.trim() || null,
        nota:         form.nota?.trim() || null,
        subtotal,
        total: subtotal,
        estado: 'pendiente',
      })
      .select('id')
      .single()

    if (pedidoError || !pedido) {
      console.error(pedidoError)
      return json({ ok: false, error: 'Error al crear el pedido' }, 500)
    }

    // Insertar items
    const { error: itemsError } = await supabase
      .from('pedido_items')
      .insert(items.map((i: any) => ({
        pedido_id: pedido.id,
        nombre:    i.nombre,
        sub:       i.sub,
        precio:    i.precio,
        cantidad:  i.cantidad,
        color:     i.color,
      })))

    if (itemsError) {
      console.error(itemsError)
      return json({ ok: false, error: 'Error al guardar los productos' }, 500)
    }

    // Construir URL de Wompi
    const publicKey      = Deno.env.get('WOMPI_PUBLIC_KEY')!
    const integritySecret= Deno.env.get('WOMPI_INTEGRITY_SECRET')!
    const appUrl         = Deno.env.get('APP_URL') ?? 'https://cuacdesign.com'
    const amountCentavos = subtotal * 100
    const currency       = 'COP'
    const redirectUrl    = `${appUrl}/cuaquiverso/checkout/confirmacion`

    const integrity = await sha256hex(`${referencia}${amountCentavos}${currency}${integritySecret}`)

    const params = new URLSearchParams({
      'public-key':                publicKey,
      'currency':                  currency,
      'amount-in-cents':           String(amountCentavos),
      'reference':                 referencia,
      'redirect-url':              redirectUrl,
      'customer-data:email':       form.email.trim().toLowerCase(),
      'customer-data:full-name':   `${form.nombre.trim()} ${form.apellido.trim()}`,
      'customer-data:phone-number':form.celular.replace(/\D/g, ''),
      'customer-data:legal-id':    form.numDoc.trim(),
      'customer-data:legal-id-type': form.tipoDoc,
      'signature:integrity':       integrity,
    })

    const wompi_url = `https://checkout.wompi.co/p/?${params.toString()}`

    return json({ ok: true, referencia, wompi_url })

  } catch (err) {
    console.error(err)
    return json({ ok: false, error: 'Error interno del servidor' }, 500)
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/crear-pedido/index.ts
git commit -m "feat(edge): crear-pedido — genera pedido en Supabase y URL de Wompi"
```

---

## Task 5: Edge function — wompi-webhook

**Files:**
- Crear: `supabase/functions/wompi-webhook/index.ts`

- [ ] **Step 1: Crear la edge function**

```typescript
// supabase/functions/wompi-webhook/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-event-checksum',
}

async function sha256hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const bodyText = await req.text()
  const checksum = req.headers.get('x-event-checksum') ?? ''
  const eventsSecret = Deno.env.get('WOMPI_EVENTS_SECRET') ?? ''

  // Validar checksum del evento
  const expected = await sha256hex(bodyText + eventsSecret)
  if (expected !== checksum) {
    return new Response('Checksum inválido', { status: 401, headers: CORS })
  }

  let event: any
  try { event = JSON.parse(bodyText) } catch {
    return new Response('JSON inválido', { status: 400, headers: CORS })
  }

  if (event?.event !== 'transaction.updated') {
    return new Response('ok', { status: 200, headers: CORS })
  }

  const transaction = event?.data?.transaction
  if (!transaction) return new Response('ok', { status: 200, headers: CORS })

  const { reference, status, id: wompi_transaction_id } = transaction

  const nuevoEstado: Record<string, string> = {
    APPROVED: 'aprobado',
    DECLINED: 'rechazado',
    VOIDED:   'rechazado',
    ERROR:    'rechazado',
  }

  const estado = nuevoEstado[status]
  if (!estado) return new Response('ok', { status: 200, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { error } = await supabase
    .from('pedidos')
    .update({ estado, wompi_transaction_id })
    .eq('referencia', reference)

  if (error) {
    console.error('Error actualizando pedido:', error)
    return new Response('Error interno', { status: 500, headers: CORS })
  }

  return new Response('ok', { status: 200, headers: CORS })
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/wompi-webhook/index.ts
git commit -m "feat(edge): wompi-webhook — valida evento y actualiza estado del pedido"
```

---

## Task 6: CheckoutComponent — SCSS

**Files:**
- Crear: `src/app/pages/cuaquiverso/checkout/checkout.component.scss`

- [ ] **Step 1: Crear los estilos**

```scss
// src/app/pages/cuaquiverso/checkout/checkout.component.scss
:host {
  --cream:     #ECEFF3;
  --cream-2:   #DDE3EA;
  --carbon-12: rgba(21,31,40,0.12);
  --carbon-08: rgba(21,31,40,0.08);
  --carbon-06: rgba(21,31,40,0.06);
  --carbon-50: rgba(21,31,40,0.50);
  --carbon-40: rgba(21,31,40,0.40);

  display: block;
  background: var(--cream);
  color: var(--carbon);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

// ─── Topbar (heredado del topbar cuaquiverso) ─────────────────────────────────
.topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 70;
  backdrop-filter: blur(14px) saturate(1.2);
  background: rgba(236,239,243,0.82);
  border-bottom: 1px solid var(--carbon-08);
}

.topbar-inner {
  max-width: 1320px; margin: 0 auto; height: 64px;
  padding: 0 var(--s-7);
  display: flex; align-items: center; justify-content: space-between; gap: var(--s-6);
}

.brand {
  font-family: var(--display); font-size: 18px; font-weight: 400;
  text-decoration: none; color: var(--carbon);
  em { color: var(--ember); font-style: normal; }
}

.progress-steps {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 600;
}
.ps-step {
  display: flex; align-items: center; gap: 6px;
  color: var(--carbon-40);
  &.is-active { color: var(--carbon); }
  &.is-done   { color: #1F8A5B; }
}
.ps-num {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--carbon-08);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
  .is-active & { background: var(--carbon); color: var(--cream); }
  .is-done   & { background: #1F8A5B;       color: #fff; }
}
.ps-div { width: 28px; height: 1px; background: var(--carbon-12); }

.secure-label { font-size: 12px; color: var(--carbon-40); }

// ─── Layout ──────────────────────────────────────────────────────────────────
.checkout-wrap {
  max-width: 1080px; margin: 0 auto;
  padding: 100px var(--s-7) var(--s-9);
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 32px;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    padding: 88px var(--s-5) var(--s-7);
  }
}

// ─── Form column ─────────────────────────────────────────────────────────────
.page-title {
  font-family: var(--display); font-size: 26px; font-weight: 400;
  letter-spacing: -0.02em; margin-bottom: 4px;
}
.page-sub {
  font-size: 14px; color: var(--carbon-50); margin-bottom: 28px;
}

.form-card {
  background: #fff;
  border: 1px solid var(--carbon-06);
  border-radius: 14px;
  padding: 28px;
  margin-bottom: 16px;
}

.card-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--carbon-40);
  margin-bottom: 20px;
}

.form-grid     { display: grid; grid-template-columns: 1fr 1fr;     gap: 14px; }
.form-grid-3   { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 14px; }
.form-full     { grid-column: 1 / -1; }

.field {
  display: flex; flex-direction: column; gap: 5px;

  label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--carbon-40);
  }

  input, select {
    padding: 10px 12px;
    border: 1.5px solid var(--carbon-12);
    border-radius: 8px;
    font-size: 14px; font-family: var(--sans);
    background: #f9fafb; color: var(--carbon);
    transition: border-color .15s, background .15s;
    outline: none;

    &:focus { border-color: var(--carbon); background: #fff; }
  }

  &.has-error input, &.has-error select { border-color: var(--ember); }

  .err-msg {
    font-size: 11px; color: var(--ember); font-weight: 600;
  }
}

// ─── Shipping estimator ───────────────────────────────────────────────────────
.shipping-estimator {
  margin-top: 18px;
  display: flex; flex-direction: column; gap: 8px;
}
.est-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--carbon-40);
}
.est-result {
  padding: 10px 14px; border-radius: 8px; font-size: 13px;
  line-height: 1.5;
  strong { font-weight: 700; }
}

.ship-banner {
  margin-top: 14px; border-radius: 9px; padding: 12px 16px;
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 13px; line-height: 1.5;
}
.ship-banner strong { font-weight: 700; display: block; }
.ship-free { background: #D7EBDD; color: #1F5C39; border: 1px solid #A8D8B7; }
.ship-cod  { background: #FBE0D5; color: #7A2A10; border: 1px solid #F5B08E; }

// ─── Summary column ───────────────────────────────────────────────────────────
.summary-col { position: sticky; top: 88px; }

.summary-card {
  background: var(--carbon);
  border-radius: 14px;
  padding: 24px;
  color: var(--cream);
}

.sum-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: rgba(236,239,243,.4);
  margin-bottom: 18px;
}

.sum-items {
  border-bottom: 1px solid rgba(236,239,243,.1);
  padding-bottom: 16px; margin-bottom: 16px;
}

.sum-item {
  display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
  &:last-child { margin-bottom: 0; }
}
.sum-swatch {
  width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0; opacity: .8;
}
.sum-info { flex: 1; min-width: 0; }
.sum-name { font-size: 13px; font-weight: 600; }
.sum-sub  { font-size: 11px; color: rgba(236,239,243,.45); margin-top: 2px; }
.sum-price{ font-size: 13px; font-weight: 600; white-space: nowrap; }

.sum-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; color: rgba(236,239,243,.6); margin-bottom: 8px;
}
.sum-row.total {
  color: var(--cream); font-size: 18px; font-weight: 700;
  letter-spacing: -0.02em; padding-top: 8px;
  border-top: 1px solid rgba(236,239,243,.1);
}
.free-tag {
  background: #1F8A5B; color: #fff;
  font-size: 10px; font-weight: 700; padding: 2px 7px;
  border-radius: 999px; letter-spacing: .04em;
}

// ─── Wompi button ─────────────────────────────────────────────────────────────
.btn-wompi {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; margin-top: 20px; padding: 15px 20px;
  background: var(--ember); color: #fff;
  border: none; border-radius: 10px;
  font-family: var(--sans); font-size: 15px; font-weight: 700;
  letter-spacing: -0.01em; cursor: pointer;
  transition: background .15s, transform .12s;

  &:hover:not(:disabled) { background: #d43010; transform: translateY(-1px); }
  &:disabled { opacity: .6; cursor: not-allowed; }

  .wompi-badge {
    background: #fff; color: var(--ember);
    font-size: 10px; font-weight: 800; letter-spacing: .05em;
    padding: 2px 6px; border-radius: 4px;
  }
}
.btn-wompi-note {
  text-align: center; font-size: 11px;
  color: rgba(236,239,243,.35); margin-top: 10px; line-height: 1.5;
}

.error-banner {
  margin-top: 12px; padding: 10px 14px;
  background: rgba(236,56,19,.12);
  border: 1px solid rgba(236,56,19,.3);
  border-radius: 8px; font-size: 13px; color: var(--ember);
}

.empty-cart {
  padding: var(--s-8) var(--s-7); text-align: center;
  h2 { font-family: var(--display); font-size: 22px; margin-bottom: 8px; }
  p  { color: var(--carbon-50); margin-bottom: 20px; }
}
.btn-back {
  display: inline-block; padding: 12px 24px;
  background: var(--carbon); color: var(--cream);
  border-radius: 10px; font-weight: 700; text-decoration: none;
  font-size: 14px;
}
```

- [ ] **Step 2: Verificar que el archivo existe y no tiene errores de sintaxis**

```bash
npx ng build --configuration=development 2>&1 | grep -E "error|Error" | head -5
```

No debe haber errores de SCSS.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/cuaquiverso/checkout/checkout.component.scss
git commit -m "feat(checkout): estilos del formulario de checkout"
```

---

## Task 7: CheckoutComponent — HTML

**Files:**
- Crear: `src/app/pages/cuaquiverso/checkout/checkout.component.html`

- [ ] **Step 1: Crear el template**

```html
<!-- src/app/pages/cuaquiverso/checkout/checkout.component.html -->

@if (cart.count() === 0) {
  <div class="empty-cart">
    <h2>Tu carrito está vacío</h2>
    <p>Agrega productos antes de continuar con la compra.</p>
    <a class="btn-back" href="/cuaquiverso/tienda">Ir a la tienda →</a>
  </div>
} @else {

<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="/cuaquiverso">Cuaqui<em>verso</em></a>
    <div class="progress-steps">
      <div class="ps-step is-active">
        <div class="ps-num">1</div>
        <span>Datos y envío</span>
      </div>
      <div class="ps-div"></div>
      <div class="ps-step">
        <div class="ps-num">2</div>
        <span>Confirmar</span>
      </div>
    </div>
    <span class="secure-label">Compra segura 🔒</span>
  </div>
</header>

<div class="checkout-wrap">

  <!-- ── Columna formulario ─────────────────────────────────────────────── -->
  <div class="form-col">
    <h1 class="page-title">¿A dónde te lo enviamos?</h1>
    <p class="page-sub">Completa tus datos para continuar al pago.</p>

    <form [formGroup]="form" (ngSubmit)="pagar()">

      <!-- Datos personales -->
      <div class="form-card">
        <div class="card-title">Datos personales</div>
        <div class="form-grid">
          <div class="field" [class.has-error]="touched('nombre')">
            <label for="nombre">Nombre</label>
            <input id="nombre" type="text" formControlName="nombre" placeholder="Tu nombre" />
            @if (touched('nombre')) { <span class="err-msg">Requerido</span> }
          </div>
          <div class="field" [class.has-error]="touched('apellido')">
            <label for="apellido">Apellido</label>
            <input id="apellido" type="text" formControlName="apellido" placeholder="Tu apellido" />
            @if (touched('apellido')) { <span class="err-msg">Requerido</span> }
          </div>
          <div class="field" [class.has-error]="touched('email')">
            <label for="email">Correo electrónico</label>
            <input id="email" type="email" formControlName="email" placeholder="tu@correo.co" />
            @if (touched('email')) { <span class="err-msg">Correo inválido</span> }
          </div>
          <div class="field" [class.has-error]="touched('celular')">
            <label for="celular">Celular</label>
            <input id="celular" type="tel" formControlName="celular" placeholder="+57 300 000 0000" />
            @if (touched('celular')) { <span class="err-msg">Mínimo 10 dígitos</span> }
          </div>
        </div>
        <div class="form-grid-3" style="margin-top:14px">
          <div class="field" [class.has-error]="touched('tipoDoc')">
            <label for="tipoDoc">Tipo de doc.</label>
            <select id="tipoDoc" formControlName="tipoDoc">
              <option value="CC">Cédula (CC)</option>
              <option value="CE">Cédula extranjería</option>
              <option value="NIT">NIT</option>
              <option value="PA">Pasaporte</option>
            </select>
          </div>
          <div class="field form-full" [class.has-error]="touched('numDoc')">
            <label for="numDoc">Número de documento</label>
            <input id="numDoc" type="text" formControlName="numDoc" placeholder="1234567890" />
            @if (touched('numDoc')) { <span class="err-msg">Requerido</span> }
          </div>
        </div>
      </div>

      <!-- Dirección de envío -->
      <div class="form-card">
        <div class="card-title">Dirección de envío</div>
        <div class="form-grid">
          <div class="field" [class.has-error]="touched('departamento')">
            <label for="departamento">Departamento</label>
            <select id="departamento" formControlName="departamento">
              <option value="">Selecciona...</option>
              <option>Bogotá D.C.</option>
              <option>Antioquia</option>
              <option>Valle del Cauca</option>
              <option>Atlántico</option>
              <option>Santander</option>
              <option>Cundinamarca</option>
              <option>Boyacá</option>
              <option>Nariño</option>
              <option>Córdoba</option>
              <option>Risaralda</option>
              <option>Tolima</option>
              <option>Huila</option>
              <option>Cauca</option>
              <option>Meta</option>
              <option>Otro</option>
            </select>
            @if (touched('departamento')) { <span class="err-msg">Requerido</span> }
          </div>
          <div class="field" [class.has-error]="touched('ciudad')">
            <label for="ciudad">Ciudad / Municipio</label>
            <input id="ciudad" type="text" formControlName="ciudad"
                   placeholder="Bogotá, Medellín..." (input)="onCiudadChange()" />
            @if (touched('ciudad')) { <span class="err-msg">Requerido</span> }
          </div>
          <div class="field form-full" [class.has-error]="touched('direccion')">
            <label for="direccion">Dirección</label>
            <input id="direccion" type="text" formControlName="direccion"
                   placeholder="Calle 123 #45-67, Apto 8" />
            @if (touched('direccion')) { <span class="err-msg">Requerido</span> }
          </div>
          <div class="field">
            <label for="barrio">Barrio</label>
            <input id="barrio" type="text" formControlName="barrio"
                   placeholder="Chapinero, El Poblado..." />
          </div>
          <div class="field">
            <label for="codigoPostal">Código postal <span style="font-weight:400;text-transform:none">(opcional)</span></label>
            <input id="codigoPostal" type="text" formControlName="codigoPostal" placeholder="110111" />
          </div>
        </div>

        <!-- Calculador de envío -->
        <div class="shipping-estimator">
          <span class="est-label">Costo estimado de envío</span>
          <div class="est-result" style="background:#f5f7fa;color:rgba(21,31,40,.6)">
            {{ estimadoTexto() }}
          </div>
        </div>

        @if (cart.total() >= ENVIO_GRATIS_DESDE) {
          <div class="ship-banner ship-free">
            <span>✓</span>
            <div>
              <strong>Envío gratis</strong>
              Tu pedido supera ${{ ENVIO_GRATIS_DESDE.toLocaleString('es-CO') }}.
              El costo de transporte va por nuestra cuenta.
            </div>
          </div>
        } @else {
          <div class="ship-banner ship-cod">
            <span>📦</span>
            <div>
              <strong>Envío contra entrega</strong>
              El transportista cobrará el flete al momento de la entrega.
              El costo exacto depende de tu ciudad.
            </div>
          </div>
        }
      </div>

      <!-- Nota -->
      <div class="form-card" style="padding: 18px 24px">
        <div class="field">
          <label for="nota">Nota para el pedido <span style="font-weight:400;text-transform:none">(opcional)</span></label>
          <input id="nota" type="text" formControlName="nota"
                 placeholder="Instrucciones especiales, referencias del edificio..." />
        </div>
      </div>

    </form>
  </div>

  <!-- ── Columna resumen ────────────────────────────────────────────────── -->
  <div class="summary-col">
    <div class="summary-card">
      <div class="sum-title">Tu pedido</div>

      <div class="sum-items">
        @for (item of cart.items(); track item.id) {
          <div class="sum-item">
            <div class="sum-swatch" [style.background]="colorHex(item.color)"></div>
            <div class="sum-info">
              <div class="sum-name">{{ item.name }}</div>
              <div class="sum-sub">{{ item.sub }} · ×{{ item.qty }}</div>
            </div>
            <div class="sum-price">{{ cart.fmtPrice(item.price * item.qty) }}</div>
          </div>
        }
      </div>

      <div class="sum-row">
        <span>Subtotal</span>
        <span>{{ cart.fmtPrice(cart.total()) }}</span>
      </div>
      <div class="sum-row">
        <span>Envío</span>
        @if (cart.total() >= ENVIO_GRATIS_DESDE) {
          <span class="free-tag">GRATIS</span>
        } @else {
          <span>Contra entrega</span>
        }
      </div>
      <div class="sum-row total">
        <span>Total</span>
        <span>{{ cart.fmtPrice(cart.total()) }}</span>
      </div>

      <button class="btn-wompi" type="button" (click)="pagar()"
              [disabled]="checkout.loading()">
        @if (checkout.loading()) {
          Procesando...
        } @else {
          Pagar con <span class="wompi-badge">WOMPI</span>
        }
      </button>

      @if (checkout.error()) {
        <div class="error-banner">{{ checkout.error() }}</div>
      }

      <p class="btn-wompi-note">
        Serás redirigido a Wompi.<br>
        Tarjetas, PSE, Nequi, efectivo.
      </p>
    </div>
  </div>

</div>

} <!-- @if cart.count() === 0 -->
```

- [ ] **Step 2: Commit**

```bash
git add src/app/pages/cuaquiverso/checkout/checkout.component.html
git commit -m "feat(checkout): template HTML del formulario de checkout"
```

---

## Task 8: CheckoutComponent — TypeScript

**Files:**
- Crear: `src/app/pages/cuaquiverso/checkout/checkout.component.ts`

- [ ] **Step 1: Crear el componente**

```typescript
// src/app/pages/cuaquiverso/checkout/checkout.component.ts
import { Component, OnInit, inject, computed } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CartService } from '../services/cart.service';
import { CheckoutService, CheckoutForm } from '../services/checkout.service';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { SeoService } from '../../../core/services/seo.service';

const ENVIO_ESTIMADO: Record<string, string> = {
  'bogota':        '~$8.000 – $12.000 COP (contra entrega)',
  'medellin':      '~$12.000 – $16.000 COP (contra entrega)',
  'cali':          '~$12.000 – $16.000 COP (contra entrega)',
  'barranquilla':  '~$14.000 – $18.000 COP (contra entrega)',
  'cartagena':     '~$14.000 – $18.000 COP (contra entrega)',
  'bucaramanga':   '~$12.000 – $16.000 COP (contra entrega)',
  'pereira':       '~$12.000 – $16.000 COP (contra entrega)',
  'manizales':     '~$12.000 – $16.000 COP (contra entrega)',
  'armenia':       '~$12.000 – $16.000 COP (contra entrega)',
  'ibague':        '~$14.000 – $18.000 COP (contra entrega)',
  'cucuta':        '~$14.000 – $18.000 COP (contra entrega)',
  'villavicencio': '~$14.000 – $18.000 COP (contra entrega)',
  'neiva':         '~$16.000 – $20.000 COP (contra entrega)',
  'pasto':         '~$16.000 – $22.000 COP (contra entrega)',
  'monteria':      '~$16.000 – $20.000 COP (contra entrega)',
  'santa marta':   '~$14.000 – $18.000 COP (contra entrega)',
  'popayan':       '~$16.000 – $20.000 COP (contra entrega)',
};

const COLOR_MAP: Record<string, string> = {
  rio:'#2A6FDB', rosa:'#FF6FA8', sol:'#FFC93C', bone:'#D4DCE4',
  terra:'#E8623D', lila:'#8B6FD8', selva:'#1F8A5B', tibu:'#2E8FB8', cream:'#D8DEDE',
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, CartModalComponent],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent implements OnInit {
  readonly cart     = inject(CartService);
  readonly checkout = inject(CheckoutService);
  private  seo      = inject(SeoService);

  readonly ENVIO_GRATIS_DESDE = 150_000;

  private ciudadActual = '';

  form = new FormGroup({
    nombre:       new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    apellido:     new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email:        new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    celular:      new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] }),
    tipoDoc:      new FormControl('CC',{ nonNullable: true, validators: [Validators.required] }),
    numDoc:       new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    departamento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    ciudad:       new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    direccion:    new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    barrio:       new FormControl('', { nonNullable: true }),
    codigoPostal: new FormControl('', { nonNullable: true }),
    nota:         new FormControl('', { nonNullable: true }),
  });

  estimadoTexto = computed(() => {
    if (!this.ciudadActual) return 'Ingresa tu ciudad para ver el estimado.';
    const key = this.ciudadActual.toLowerCase().trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    return ENVIO_ESTIMADO[key] ?? '~$18.000 – $28.000 COP (contra entrega)';
  });

  ngOnInit(): void {
    this.seo.set({
      title:     'Checkout — Cuaquiverso',
      canonical: 'https://cuacdesign.com/cuaquiverso/checkout',
    });
    this.checkout.error.set(null);
  }

  touched(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  onCiudadChange(): void {
    this.ciudadActual = this.form.get('ciudad')?.value ?? '';
  }

  colorHex(key: string): string {
    return COLOR_MAP[key] ?? '#3D4856';
  }

  async pagar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.checkout.loading.set(true);
    this.checkout.error.set(null);

    try {
      const { wompi_url } = await this.checkout.crearPedido(
        this.form.getRawValue() as CheckoutForm,
        this.cart.items(),
        this.cart.total(),
      );
      window.location.href = wompi_url;
    } catch (e: any) {
      this.checkout.error.set(e.message ?? 'Error al procesar el pedido. Intenta de nuevo.');
      this.checkout.loading.set(false);
    }
  }
}
```

- [ ] **Step 2: Verificar build**

```bash
npx ng build --configuration=development 2>&1 | tail -8
```

Resultado esperado: `Application bundle generation complete.` sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/cuaquiverso/checkout/checkout.component.ts
git commit -m "feat(checkout): CheckoutComponent con formulario reactivo y botón Wompi"
```

---

## Task 9: ConfirmacionComponent — SCSS + HTML + TypeScript

**Files:**
- Crear: `src/app/pages/cuaquiverso/checkout/confirmacion/confirmacion.component.scss`
- Crear: `src/app/pages/cuaquiverso/checkout/confirmacion/confirmacion.component.html`
- Crear: `src/app/pages/cuaquiverso/checkout/confirmacion/confirmacion.component.ts`

- [ ] **Step 1: Crear los estilos**

```scss
// src/app/pages/cuaquiverso/checkout/confirmacion/confirmacion.component.scss
:host {
  display: block;
  background: #ECEFF3;
  color: #151F28;
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

.topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 70;
  backdrop-filter: blur(14px);
  background: rgba(236,239,243,0.82);
  border-bottom: 1px solid rgba(21,31,40,0.08);
}
.topbar-inner {
  max-width: 1320px; margin: 0 auto; height: 64px;
  padding: 0 var(--s-7);
  display: flex; align-items: center; justify-content: space-between;
}
.brand {
  font-family: var(--display); font-size: 18px; font-weight: 400;
  text-decoration: none; color: #151F28;
  em { color: var(--ember); font-style: normal; }
}
.steps-done { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #1F8A5B; }
.sd-num {
  width: 22px; height: 22px; border-radius: 50%;
  background: #1F8A5B; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 11px;
}
.sd-div { width: 28px; height: 1px; background: #1F8A5B; }

.page { max-width: 1080px; margin: 0 auto; padding: 96px var(--s-7) var(--s-9); }

// ─── Hero ─────────────────────────────────────────────────────────────────────
.confirm-hero {
  background: #151F28;
  border-radius: 18px;
  padding: 48px;
  color: #ECEFF3;
  margin-bottom: 28px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 32px;

  @media (max-width: 700px) { grid-template-columns: 1fr; padding: 32px 24px; }
}
.hero-check {
  width: 52px; height: 52px; border-radius: 50%;
  background: #1F8A5B;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; margin-bottom: 20px;
}
.hero-eyebrow {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .1em; color: #1F8A5B; margin-bottom: 8px;
}
.hero-title {
  font-family: var(--display); font-size: 30px; font-weight: 400;
  letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 10px;
  em { color: var(--ember); font-style: normal; }
}
.hero-sub {
  font-size: 14px; color: rgba(236,239,243,.55); line-height: 1.6; max-width: 460px;
}
.wompi-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(236,239,243,.08);
  border: 1px solid rgba(236,239,243,.1);
  border-radius: 8px; padding: 8px 14px; margin-top: 20px;
  font-size: 12px; color: rgba(236,239,243,.55);
  strong { color: #ECEFF3; }
  .wl { background: var(--ember); color: #fff; font-size: 9px; font-weight: 800; letter-spacing: .05em; padding: 2px 5px; border-radius: 3px; }
}
.order-ref {
  text-align: right;
  .r-lbl  { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: rgba(236,239,243,.4); margin-bottom: 6px; }
  .r-code { font-size: 20px; font-weight: 700; letter-spacing: .04em; font-family: monospace; }
  .r-date { font-size: 12px; color: rgba(236,239,243,.4); margin-top: 4px; }
}

// ─── Bottom grid ─────────────────────────────────────────────────────────────
.bottom-grid {
  display: grid; grid-template-columns: 1fr 360px; gap: 24px;
  @media (max-width: 800px) { grid-template-columns: 1fr; }
}

.card {
  background: #fff;
  border: 1px solid rgba(21,31,40,.07);
  border-radius: 14px; padding: 28px; margin-bottom: 18px;
  &:last-child { margin-bottom: 0; }
}
.card-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .08em; color: rgba(21,31,40,.4); margin-bottom: 18px;
}

.order-item {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 0; border-bottom: 1px solid rgba(21,31,40,.06);
  &:first-child { padding-top: 0; }
  &:last-child  { border-bottom: none; padding-bottom: 0; }
}
.oi-swatch { width: 40px; height: 40px; border-radius: 8px; flex-shrink: 0; opacity: .8; }
.oi-info   { flex: 1; }
.oi-name   { font-size: 14px; font-weight: 600; }
.oi-sub    { font-size: 12px; color: rgba(21,31,40,.45); margin-top: 2px; }
.oi-price  { font-size: 14px; font-weight: 600; white-space: nowrap; }

.addr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.addr-field { .lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: rgba(21,31,40,.4); margin-bottom: 3px; } .val { font-size: 14px; } }

.ship-note {
  display: flex; gap: 12px; align-items: flex-start;
  background: #FBE0D5; border: 1px solid #F5B08E;
  border-radius: 10px; padding: 14px 16px; margin-top: 16px;
  .sn-icon { font-size: 20px; flex-shrink: 0; }
  strong { font-weight: 700; font-size: 13px; display: block; margin-bottom: 3px; color: #7A2A10; }
  p { font-size: 12px; color: #7A2A10; line-height: 1.5; }
}

.total-row {
  display: flex; justify-content: space-between; font-size: 14px;
  color: rgba(21,31,40,.55); margin-bottom: 8px;
  &.main { color: #151F28; font-size: 18px; font-weight: 700; letter-spacing: -.02em; padding-top: 10px; border-top: 1px solid rgba(21,31,40,.08); }
}
.free-tag {
  background: #D7EBDD; color: #1F5C39;
  font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
}

.next-steps { display: flex; flex-direction: column; gap: 14px; }
.ns-item    { display: flex; gap: 14px; align-items: flex-start; }
.ns-num {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: rgba(21,31,40,.06);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700;
}
.ns-body { strong { font-size: 13px; font-weight: 700; display: block; margin-bottom: 2px; } p { font-size: 12px; color: rgba(21,31,40,.55); line-height: 1.5; } }

.cta-row { display: flex; gap: 10px; margin-top: 22px; }
.btn-primary { flex:1; padding: 13px 20px; background: #151F28; color: #ECEFF3; border-radius: 10px; font-size: 14px; font-weight: 700; text-align: center; text-decoration: none; display: block; }
.btn-ghost   { flex:1; padding: 13px 20px; border: 1.5px solid rgba(21,31,40,.15); border-radius: 10px; font-size: 14px; font-weight: 600; text-align: center; text-decoration: none; color: #151F28; display: block; }

// ─── Loading skeleton ─────────────────────────────────────────────────────────
.skeleton-wrap { max-width: 1080px; margin: 96px auto; padding: 0 var(--s-7); }
.skeleton-hero { background: rgba(21,31,40,.08); border-radius: 18px; height: 220px; margin-bottom: 28px; animation: pulse 1.4s ease-in-out infinite; }
.skeleton-row  { background: rgba(21,31,40,.06); border-radius: 10px; height: 60px; margin-bottom: 14px; animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }

.not-found { text-align: center; padding: var(--s-9) var(--s-7); }
.not-found h2 { font-family: var(--display); font-size: 24px; margin-bottom: 8px; }
.not-found p  { color: rgba(21,31,40,.5); margin-bottom: 20px; }
```

- [ ] **Step 2: Crear el template HTML**

```html
<!-- src/app/pages/cuaquiverso/checkout/confirmacion/confirmacion.component.html -->

<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="/cuaquiverso">Cuaqui<em>verso</em></a>
    <div class="steps-done">
      <div class="sd-num">✓</div>
      <span>Datos y envío</span>
      <div class="sd-div"></div>
      <div class="sd-num">✓</div>
      <span>Pago confirmado</span>
    </div>
    <span></span>
  </div>
</header>

@if (loading()) {
  <div class="skeleton-wrap">
    <div class="skeleton-hero"></div>
    <div class="skeleton-row"></div>
    <div class="skeleton-row" style="width:60%"></div>
  </div>
}

@if (!loading() && notFound()) {
  <div class="not-found">
    <h2>Pedido no encontrado</h2>
    <p>No encontramos un pedido con esa referencia.</p>
    <a class="btn-primary" href="/cuaquiverso/tienda" style="display:inline-block;padding:12px 24px">
      Ir a la tienda
    </a>
  </div>
}

@if (!loading() && pedido()) {
  <div class="page">

    <!-- Hero confirmación -->
    <div class="confirm-hero">
      <div>
        <div class="hero-check">✓</div>
        <div class="hero-eyebrow">Pago aprobado</div>
        <h1 class="hero-title">Tu pedido está<br>en <em>camino</em>.</h1>
        <p class="hero-sub">
          Recibimos tu pago y ya estamos preparando tu pedido.
          Te llegará un correo a <strong>{{ pedido()!.email }}</strong>
          con el número de guía cuando salgamos a despachar.
        </p>
        <div class="wompi-badge">
          Pago procesado por <span class="wl">WOMPI</span>
        </div>
      </div>
      <div class="order-ref">
        <div class="r-lbl">Número de pedido</div>
        <div class="r-code">{{ pedido()!.referencia }}</div>
        <div class="r-date">{{ fechaFormateada() }}</div>
      </div>
    </div>

    <div class="bottom-grid">

      <!-- Columna izquierda -->
      <div>
        <!-- Productos -->
        <div class="card">
          <div class="card-title">Lo que pediste</div>
          @for (item of pedido()!.pedido_items; track item.nombre) {
            <div class="order-item">
              <div class="oi-swatch" [style.background]="colorHex(item.color)"></div>
              <div class="oi-info">
                <div class="oi-name">{{ item.nombre }}</div>
                <div class="oi-sub">{{ item.sub }} · ×{{ item.cantidad }}</div>
              </div>
              <div class="oi-price">{{ fmtPrice(item.precio * item.cantidad) }}</div>
            </div>
          }
        </div>

        <!-- Dirección -->
        <div class="card">
          <div class="card-title">Dirección de entrega</div>
          <div class="addr-grid">
            <div class="addr-field">
              <div class="lbl">Nombre</div>
              <div class="val">{{ pedido()!.nombre }} {{ pedido()!.apellido }}</div>
            </div>
            <div class="addr-field">
              <div class="lbl">Ciudad</div>
              <div class="val">{{ pedido()!.ciudad }}</div>
            </div>
            <div class="addr-field" style="grid-column:span 2">
              <div class="lbl">Dirección</div>
              <div class="val">
                {{ pedido()!.direccion }}
                @if (pedido()!.barrio) { · {{ pedido()!.barrio }} }
              </div>
            </div>
          </div>
          <div class="ship-note">
            <span class="sn-icon">📦</span>
            <div>
              <strong>El envío se cobra contra entrega</strong>
              <p>El transportista cobrará el flete al momento de la entrega en tu dirección.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Columna derecha -->
      <div>
        <!-- Totales -->
        <div class="card">
          <div class="card-title">Resumen del pago</div>
          <div class="total-row">
            <span>Subtotal</span>
            <span>{{ fmtPrice(pedido()!.subtotal) }}</span>
          </div>
          <div class="total-row">
            <span>Envío</span>
            @if (pedido()!.subtotal >= 150000) {
              <span class="free-tag">GRATIS</span>
            } @else {
              <span>Contra entrega</span>
            }
          </div>
          <div class="total-row main">
            <span>Total pagado</span>
            <span>{{ fmtPrice(pedido()!.total) }}</span>
          </div>
        </div>

        <!-- Próximos pasos -->
        <div class="card">
          <div class="card-title">¿Qué sigue?</div>
          <div class="next-steps">
            <div class="ns-item">
              <div class="ns-num">1</div>
              <div class="ns-body">
                <strong>Confirmación por correo</strong>
                <p>Te enviamos los detalles del pedido a {{ pedido()!.email }}</p>
              </div>
            </div>
            <div class="ns-item">
              <div class="ns-num">2</div>
              <div class="ns-body">
                <strong>Preparación en taller</strong>
                <p>Empacamos tu pedido en nuestro taller en Bogotá. 1–2 días hábiles.</p>
              </div>
            </div>
            <div class="ns-item">
              <div class="ns-num">3</div>
              <div class="ns-body">
                <strong>Número de guía</strong>
                <p>Recibirás el código de seguimiento cuando el paquete salga a despachar.</p>
              </div>
            </div>
            <div class="ns-item">
              <div class="ns-num">4</div>
              <div class="ns-body">
                <strong>Entrega y pago del flete</strong>
                <p>El transportista entrega en tu dirección y cobra el envío en efectivo.</p>
              </div>
            </div>
          </div>
          <div class="cta-row">
            <a class="btn-primary" href="/cuaquiverso/tienda">Seguir comprando</a>
            <a class="btn-ghost" href="/cuaquiverso">Inicio</a>
          </div>
        </div>
      </div>

    </div>
  </div>
}
```

- [ ] **Step 3: Crear el TypeScript del componente**

```typescript
// src/app/pages/cuaquiverso/checkout/confirmacion/confirmacion.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CheckoutService, PedidoDetalle } from '../../services/checkout.service';
import { CartService } from '../../services/cart.service';
import { SeoService } from '../../../../core/services/seo.service';

const COLOR_MAP: Record<string, string> = {
  rio:'#2A6FDB', rosa:'#FF6FA8', sol:'#FFC93C', bone:'#D4DCE4',
  terra:'#E8623D', lila:'#8B6FD8', selva:'#1F8A5B', tibu:'#2E8FB8', cream:'#D8DEDE',
};

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports: [],
  templateUrl: './confirmacion.component.html',
  styleUrl: './confirmacion.component.scss',
})
export class ConfirmacionComponent implements OnInit {
  private route    = inject(ActivatedRoute);
  private router   = inject(Router);
  private checkout = inject(CheckoutService);
  private cart     = inject(CartService);
  private seo      = inject(SeoService);

  readonly loading  = signal(true);
  readonly notFound = signal(false);
  readonly pedido   = signal<PedidoDetalle | null>(null);

  async ngOnInit(): Promise<void> {
    this.seo.set({
      title:     'Pedido confirmado — Cuaquiverso',
      canonical: 'https://cuacdesign.com/cuaquiverso/checkout/confirmacion',
    });

    const ref = this.route.snapshot.queryParams['ref'];
    if (!ref) {
      this.router.navigate(['/cuaquiverso']);
      return;
    }

    const data = await this.checkout.obtenerPedido(ref);
    if (!data) {
      this.notFound.set(true);
    } else {
      this.pedido.set(data);
      this.cart.clear();
    }
    this.loading.set(false);
  }

  fechaFormateada(): string {
    const p = this.pedido();
    if (!p) return '';
    return new Date(p.creado_en).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  colorHex(key: string): string {
    return COLOR_MAP[key] ?? '#3D4856';
  }

  fmtPrice(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }
}
```

- [ ] **Step 4: Verificar build**

```bash
npx ng build --configuration=development 2>&1 | tail -8
```

Resultado esperado: `Application bundle generation complete.`

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/cuaquiverso/checkout/confirmacion/
git commit -m "feat(checkout): ConfirmacionComponent — pantalla post-Wompi"
```

---

## Task 10: Routing — agregar rutas de checkout

**Files:**
- Modificar: `src/app/app.routes.ts`

- [ ] **Step 1: Agregar las dos rutas en app.routes.ts**

Buscar el bloque de rutas de cuaquiverso (después de `cuaquiverso/universo`) y agregar antes del bloque de portafolio:

```typescript
  {
    path: 'cuaquiverso/checkout',
    loadComponent: () =>
      import('./pages/cuaquiverso/checkout/checkout.component').then(m => m.CheckoutComponent),
  },
  {
    path: 'cuaquiverso/checkout/confirmacion',
    loadComponent: () =>
      import('./pages/cuaquiverso/checkout/confirmacion/confirmacion.component').then(m => m.ConfirmacionComponent),
  },
```

- [ ] **Step 2: Verificar build final**

```bash
npx ng build --configuration=development 2>&1 | tail -8
```

Resultado esperado: `Application bundle generation complete.`

- [ ] **Step 3: Commit**

```bash
git add src/app/app.routes.ts
git commit -m "feat(routing): agregar rutas /checkout y /checkout/confirmacion"
```

---

## Task 11: Deploy edge functions + configurar secretos

- [ ] **Step 1: Deployar las edge functions**

```bash
npx supabase functions deploy crear-pedido
npx supabase functions deploy wompi-webhook
```

- [ ] **Step 2: Configurar los secretos de las edge functions**

Obtener las claves desde el dashboard de Wompi (sandbox para pruebas: `pub_stagtest_...` / `prv_stagtest_...`).

```bash
npx supabase secrets set WOMPI_PUBLIC_KEY=pub_stagtest_XXXXXXXXXX
npx supabase secrets set WOMPI_INTEGRITY_SECRET=test_integrity_XXXXXXXXXX
npx supabase secrets set WOMPI_EVENTS_SECRET=test_events_XXXXXXXXXX
npx supabase secrets set APP_URL=http://localhost:4200
```

En producción, cambiar `APP_URL` a `https://cuacdesign.com`.

- [ ] **Step 3: Configurar el webhook en el dashboard de Wompi**

En el dashboard de Wompi → Desarrolladores → Webhooks → agregar URL:

```
https://ytqcwrjxlnlsjgnjxiiw.supabase.co/functions/v1/wompi-webhook
```

Evento a suscribir: `transaction.updated`

- [ ] **Step 4: Prueba de humo manual**

1. Iniciar el servidor de desarrollo: `npx ng serve`
2. Navegar a `http://localhost:4200/cuaquiverso/tienda`
3. Agregar un producto al carrito
4. Abrir el modal del carrito → clic "Ir a pagar"
5. Verificar que llega a `/cuaquiverso/checkout` con el resumen del carrito
6. Llenar el formulario con datos de prueba
7. Clic "Pagar con Wompi"
8. Verificar que redirige al hosted checkout de Wompi (sandbox)
9. Completar el pago de prueba con tarjeta Wompi sandbox: `4242 4242 4242 4242`
10. Verificar que Wompi redirige a `/cuaquiverso/checkout/confirmacion?ref=CQV-...`
11. Verificar que la pantalla de confirmación muestra el pedido correcto
12. Verificar en Supabase que el pedido existe en la tabla `pedidos` con estado `aprobado`

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat(checkout): flujo completo — formulario, Wompi, confirmación"
```
