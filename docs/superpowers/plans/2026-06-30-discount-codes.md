# Códigos de Descuento — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un sistema de códigos de descuento con CRUD en el panel admin (pestaña dentro de Pedidos) y campo de aplicación en el checkout del cliente, respaldado por Supabase.

**Architecture:** Nueva tabla `codigos_descuento` + dos columnas en `pedidos` (migración SQL). Nueva Edge Function `validar-descuento`. `crear-pedido` actualizada para procesar descuentos de forma atómica. En Angular: `DescuentoService` + `DescuentosAdminService` + componente `DescuentosTabComponent` embebido en la vista de Pedidos del admin.

**Tech Stack:** Angular 19+ (standalone, signals), Supabase (PostgreSQL + Deno Edge Functions), SCSS con tokens CSS del proyecto (`--carbon`, `--cream`, `--rio`, `var(--sans)`, etc.).

## Global Constraints
- Precios en COP entero (`integer`). Sin decimales.
- Códigos siempre en mayúsculas — normalizar en UI y en cada Edge Function.
- `CartItem.id` es el UUID de `productos_evento.id` en Supabase. Las restricciones por producto usan ese UUID.
- `categorias_ids` usa los mismos slugs de categoría del catálogo: `'tee' | 'pin' | 'sticker' | 'tote' | 'gorra' | 'peluche' | 'print' | 'llavero' | 'pañoleta' | 'amigurumi' | 'charm' | 'libreta'`.
- Las Edge Functions usan `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS).
- El admin CRUD usa `SupabaseService` (`this.sb.db`) — sin mock data.
- Seguir el patrón de drawer existente: `.drawer-back.on` + `.drawer.on` en el template.
- Admin usa `FormsModule` para `[(ngModel)]`.

---

### Task 1: Migración SQL — tabla `codigos_descuento` + columnas en `pedidos`

**Files:**
- Create: `supabase/migrations/012_codigos_descuento.sql`

**Interfaces:**
- Produces: tabla `codigos_descuento` y columnas `codigo_descuento`, `descuento_monto` en `pedidos` — usadas por Tasks 2, 3 y 6.

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/012_codigos_descuento.sql

CREATE TABLE codigos_descuento (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          text        UNIQUE NOT NULL,
  tipo            text        NOT NULL CHECK (tipo IN ('porcentaje', 'fijo')),
  valor           integer     NOT NULL CHECK (valor > 0),
  minimo_orden    integer     NOT NULL DEFAULT 0,
  limite_usos     integer,                        -- NULL = ilimitado
  usos_actuales   integer     NOT NULL DEFAULT 0,
  productos_ids   text[],                         -- NULL = todos
  categorias_ids  text[],                         -- NULL = todas
  activo          boolean     NOT NULL DEFAULT true,
  expira_en       timestamptz,                    -- NULL = no expira
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pedidos
  ADD COLUMN codigo_descuento text,
  ADD COLUMN descuento_monto  integer NOT NULL DEFAULT 0;

-- RLS: solo el admin puede leer/escribir códigos de descuento
ALTER TABLE codigos_descuento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solo_admin_descuentos" ON codigos_descuento
  FOR ALL USING (auth.email() = 'designcuac@gmail.com');

CREATE INDEX idx_codigos_descuento_codigo ON codigos_descuento(codigo);
```

- [ ] **Step 2: Aplicar la migración en Supabase**

Opción A — CLI local:
```bash
supabase db push
```

Opción B — Supabase Dashboard → SQL Editor → pegar el contenido del archivo y ejecutar.

- [ ] **Step 3: Verificar en Supabase Dashboard**

En Table Editor, confirmar que existe la tabla `codigos_descuento` con todas las columnas, y que la tabla `pedidos` tiene las columnas `codigo_descuento` y `descuento_monto`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_codigos_descuento.sql
git commit -m "feat(db): add codigos_descuento table and discount columns to pedidos"
```

---

### Task 2: Edge Function `validar-descuento`

**Files:**
- Create: `supabase/functions/validar-descuento/index.ts`

**Interfaces:**
- Consumes: tabla `codigos_descuento` (Task 1), tabla `productos_evento` (existente).
- Produces:
  ```ts
  // Éxito
  { valido: true; tipo: 'porcentaje' | 'fijo'; valor: number; monto_descuento: number }
  // Error
  { valido: false; mensaje: string }
  ```
  Llamada desde `DescuentoService.aplicar()` (Task 4) via `supabase.db.functions.invoke('validar-descuento', ...)`.

- [ ] **Step 1: Crear la Edge Function**

```ts
// supabase/functions/validar-descuento/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { codigo, subtotal, items } = await req.json()
    // items: { id: string; categoria: string; precio: number; cantidad: number }[]

    if (
      typeof codigo !== 'string' || !codigo.trim() ||
      typeof subtotal !== 'number' || subtotal <= 0 ||
      !Array.isArray(items) || items.length === 0
    ) {
      return json({ valido: false, mensaje: 'Solicitud inválida' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: dc, error } = await supabase
      .from('codigos_descuento')
      .select('*')
      .eq('codigo', codigo.toUpperCase().trim())
      .single()

    if (error || !dc) return json({ valido: false, mensaje: 'Código inválido' })

    if (!dc.activo) return json({ valido: false, mensaje: 'Código inválido' })

    if (dc.expira_en && new Date(dc.expira_en) < new Date()) {
      return json({ valido: false, mensaje: 'Código expirado' })
    }

    if (dc.limite_usos !== null && dc.usos_actuales >= dc.limite_usos) {
      return json({ valido: false, mensaje: 'Límite de usos alcanzado' })
    }

    if (subtotal < dc.minimo_orden) {
      return json({
        valido: false,
        mensaje: `Monto mínimo $${dc.minimo_orden.toLocaleString('es-CO')} COP`,
      })
    }

    // Filtrar items elegibles
    let itemsElegibles: typeof items = items
    if (dc.productos_ids && dc.productos_ids.length > 0) {
      itemsElegibles = items.filter((i: any) => dc.productos_ids.includes(i.id))
      if (itemsElegibles.length === 0) {
        return json({ valido: false, mensaje: 'No aplica para los productos en tu carrito' })
      }
    } else if (dc.categorias_ids && dc.categorias_ids.length > 0) {
      itemsElegibles = items.filter((i: any) => dc.categorias_ids.includes(i.categoria))
      if (itemsElegibles.length === 0) {
        return json({ valido: false, mensaje: 'No aplica para los productos en tu carrito' })
      }
    }

    const subtotalElegible = itemsElegibles.reduce(
      (acc: number, i: any) => acc + i.precio * i.cantidad, 0
    )

    const monto_descuento = dc.tipo === 'porcentaje'
      ? Math.round(subtotalElegible * dc.valor / 100)
      : Math.min(dc.valor, subtotal)

    return json({ valido: true, tipo: dc.tipo, valor: dc.valor, monto_descuento })

  } catch (err) {
    console.error(err)
    return json({ valido: false, mensaje: 'Error interno del servidor' }, 500)
  }
})
```

- [ ] **Step 2: Desplegar la Edge Function**

```bash
supabase functions deploy validar-descuento
```

- [ ] **Step 3: Verificar manualmente**

Primero crear un código de prueba en Supabase (Dashboard → Table Editor → `codigos_descuento`):
```
codigo: TEST10, tipo: porcentaje, valor: 10, minimo_orden: 0, activo: true
```

Luego invocarla (reemplazar `<project-ref>` y `<anon-key>`):
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/validar-descuento \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"codigo":"TEST10","subtotal":100000,"items":[{"id":"abc","categoria":"tee","precio":100000,"cantidad":1}]}'
```

Respuesta esperada:
```json
{"valido":true,"tipo":"porcentaje","valor":10,"monto_descuento":10000}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/validar-descuento/
git commit -m "feat(functions): add validar-descuento edge function"
```

---

### Task 3: Actualizar `crear-pedido` — soporte para descuento

**Files:**
- Modify: `supabase/functions/crear-pedido/index.ts`

**Interfaces:**
- Consumes: tabla `codigos_descuento` (Task 1), nuevas columnas de `pedidos` (Task 1).
- Produces: `crear-pedido` acepta `codigo_descuento?: string` y `descuento_monto?: number` en el body. Decrementa `usos_actuales` atómicamente. Devuelve `wompi_url` con el total descontado.

- [ ] **Step 1: Reemplazar el contenido de `crear-pedido/index.ts`**

```ts
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
    const { form, items, subtotal, codigo_descuento, descuento_monto } = body

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

    const montoDescuento = typeof descuento_monto === 'number' && descuento_monto > 0
      ? descuento_monto
      : 0
    const total = Math.max(0, subtotal - montoDescuento)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Si viene código de descuento: decrementar usos atómicamente
    if (typeof codigo_descuento === 'string' && codigo_descuento.trim()) {
      const { data: dcRows } = await supabase.rpc('incrementar_uso_descuento', {
        p_codigo: codigo_descuento.toUpperCase().trim(),
      })
      // Si dcRows es 0 (o null), el código ya no está disponible
      if (!dcRows || dcRows === 0) {
        return json({ ok: false, error: 'El código de descuento ya no está disponible' }, 409)
      }
    }

    // Generar referencia única
    let referencia = generarReferencia()
    const { data: existing } = await supabase
      .from('pedidos').select('id').eq('referencia', referencia).maybeSingle()
    if (existing) referencia = generarReferencia()

    // Insertar pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        referencia,
        nombre:           form.nombre.trim(),
        apellido:         form.apellido.trim(),
        email:            form.email.trim().toLowerCase(),
        celular:          form.celular.trim(),
        tipo_doc:         form.tipoDoc,
        num_doc:          form.numDoc.trim(),
        departamento:     form.departamento.trim(),
        ciudad:           form.ciudad.trim(),
        direccion:        form.direccion.trim(),
        barrio:           form.barrio?.trim() || null,
        codigo_postal:    form.codigoPostal?.trim() || null,
        nota:             form.nota?.trim() || null,
        subtotal,
        total,
        codigo_descuento: codigo_descuento?.toUpperCase().trim() || null,
        descuento_monto:  montoDescuento,
        estado:           'pendiente',
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

    // Construir URL de Wompi con el total descontado
    const publicKey       = Deno.env.get('WOMPI_PUBLIC_KEY')!
    const integritySecret = Deno.env.get('WOMPI_INTEGRITY_SECRET')!
    const appUrl          = Deno.env.get('APP_URL') ?? 'https://cuacdesign.com'
    const amountCentavos  = total * 100
    const currency        = 'COP'
    const redirectUrl     = `${appUrl}/cuaquiverso/checkout/confirmacion`

    const integrity = await sha256hex(`${referencia}${amountCentavos}${currency}${integritySecret}`)

    const params = new URLSearchParams({
      'public-key':                  publicKey,
      'currency':                    currency,
      'amount-in-cents':             String(amountCentavos),
      'reference':                   referencia,
      'redirect-url':                redirectUrl,
      'customer-data:email':         form.email.trim().toLowerCase(),
      'customer-data:full-name':     `${form.nombre.trim()} ${form.apellido.trim()}`,
      'customer-data:phone-number':  form.celular.replace(/\D/g, ''),
      'customer-data:legal-id':      form.numDoc.trim(),
      'customer-data:legal-id-type': form.tipoDoc,
      'signature:integrity':         integrity,
    })

    return json({ ok: true, referencia, wompi_url: `https://checkout.wompi.co/p/?${params.toString()}` })

  } catch (err) {
    console.error(err)
    return json({ ok: false, error: 'Error interno del servidor' }, 500)
  }
})
```

- [ ] **Step 2: Crear la función SQL `incrementar_uso_descuento` en la migración**

Añadir al final de `supabase/migrations/012_codigos_descuento.sql`:

```sql
-- Función atómica para incrementar usos — retorna 1 si tuvo éxito, 0 si no
CREATE OR REPLACE FUNCTION incrementar_uso_descuento(p_codigo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE codigos_descuento
  SET usos_actuales = usos_actuales + 1,
      actualizado_en = now()
  WHERE codigo = p_codigo
    AND activo = true
    AND (expira_en IS NULL OR expira_en > now())
    AND (limite_usos IS NULL OR usos_actuales < limite_usos);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;
```

Aplicar con `supabase db push` o pegando en el SQL Editor.

- [ ] **Step 3: Desplegar `crear-pedido`**

```bash
supabase functions deploy crear-pedido
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/crear-pedido/index.ts supabase/migrations/012_codigos_descuento.sql
git commit -m "feat(functions): update crear-pedido to apply discount codes atomically"
```

---

### Task 4: `CartItem` + `DescuentoService`

**Files:**
- Modify: `src/app/pages/cuaquiverso/services/cart.service.ts` — añadir campo `categoria`
- Modify: `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.ts` — pasar `categoria`
- Create: `src/app/pages/cuaquiverso/services/descuento.service.ts`

**Interfaces:**
- Consumes: `validar-descuento` EF (Task 2), `SupabaseService.db.functions.invoke`.
- Produces:
  ```ts
  // CartItem actualizado
  interface CartItem {
    id: string; name: string; sub: string; price: number;
    color: string; qty: number; categoria: string;
  }

  // DescuentoService (signals públicos)
  codigoAplicado: Signal<string | null>
  montoDescuento: Signal<number>
  validando:      Signal<boolean>
  error:          Signal<string | null>

  // Métodos
  aplicar(codigo: string, items: CartItem[], subtotal: number): Promise<void>
  limpiar(): void
  ```

- [ ] **Step 1: Añadir `categoria` a `CartItem` en `cart.service.ts`**

En `src/app/pages/cuaquiverso/services/cart.service.ts`, actualizar la interfaz:

```ts
export interface CartItem {
  id:       string;
  name:     string;
  sub:      string;
  price:    number;
  color:    string;
  qty:      number;
  categoria: string;   // ← nuevo campo
}
```

El resto del archivo (`CartService`) no cambia.

- [ ] **Step 2: Pasar `categoria` en `addToCart()` dentro de `producto-detail.component.ts`**

Localizar el método `addToCart()` en `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.ts` (línea 74) y actualizarlo:

```ts
addToCart(): void {
  const p = this.producto();
  if (!p) return;
  this.cart.add({
    id:        p.id,
    name:      p.nombre,
    sub:       this.catLabel(p.categoria),
    price:     p.precio,
    color:     p.color ?? '#3D4856',
    categoria: p.categoria,   // ← nuevo
  });
  this.cart.open();
}
```

- [ ] **Step 3: Crear `descuento.service.ts`**

```ts
// src/app/pages/cuaquiverso/services/descuento.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CartItem } from './cart.service';

@Injectable({ providedIn: 'root' })
export class DescuentoService {
  private supabase = inject(SupabaseService);

  readonly codigoAplicado = signal<string | null>(null);
  readonly montoDescuento = signal(0);
  readonly validando      = signal(false);
  readonly error          = signal<string | null>(null);

  async aplicar(codigo: string, items: CartItem[], subtotal: number): Promise<void> {
    this.validando.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.db.functions.invoke('validar-descuento', {
      body: {
        codigo:   codigo.toUpperCase().trim(),
        subtotal,
        items: items.map(i => ({
          id:       i.id,
          categoria: i.categoria,
          precio:   i.price,
          cantidad: i.qty,
        })),
      },
    });

    this.validando.set(false);

    if (error) {
      this.error.set('Error al validar el código. Intenta de nuevo.');
      return;
    }

    if (!data?.valido) {
      this.error.set(data?.mensaje ?? 'Código inválido');
      return;
    }

    this.codigoAplicado.set(codigo.toUpperCase().trim());
    this.montoDescuento.set(data.monto_descuento);
  }

  limpiar(): void {
    this.codigoAplicado.set(null);
    this.montoDescuento.set(0);
    this.error.set(null);
  }
}
```

- [ ] **Step 4: Verificar compilación**

```bash
ng build --configuration development
```

Debe compilar sin errores. Si algún otro lugar llama a `cart.add()` sin `categoria`, TypeScript lo reportará — añadir `categoria: ''` como valor por defecto en esos puntos.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/cuaquiverso/services/cart.service.ts \
        src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.ts \
        src/app/pages/cuaquiverso/services/descuento.service.ts
git commit -m "feat(cart): add categoria to CartItem and create DescuentoService"
```

---

### Task 5: Checkout UI + actualizar `CheckoutService`

**Files:**
- Modify: `src/app/pages/cuaquiverso/services/checkout.service.ts`
- Modify: `src/app/pages/cuaquiverso/checkout/checkout.component.ts`
- Modify: `src/app/pages/cuaquiverso/checkout/checkout.component.html`
- Modify: `src/app/pages/cuaquiverso/checkout/checkout.component.scss`

**Interfaces:**
- Consumes: `DescuentoService` (Task 4), `CartService`, `crear-pedido` EF (Task 3).
- Produces: UI de campo de código con estados vacío / validando / aplicado / error. `crearPedido()` pasa `codigo_descuento` y `descuento_monto` al backend.

- [ ] **Step 1: Actualizar `CheckoutService.crearPedido()`**

En `src/app/pages/cuaquiverso/services/checkout.service.ts`, reemplazar la firma y el body de `crearPedido`:

```ts
async crearPedido(
  form:     CheckoutForm,
  items:    CartItem[],
  subtotal: number,
  codigoDescuento?: { codigo: string; monto: number },
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
      codigo_descuento: codigoDescuento?.codigo ?? null,
      descuento_monto:  codigoDescuento?.monto  ?? 0,
    },
  });

  if (error) throw new Error(error.message);
  if (!data?.wompi_url) throw new Error('Respuesta inválida del servidor');
  return data as { referencia: string; wompi_url: string };
}
```

- [ ] **Step 2: Actualizar `checkout.component.ts`**

Reemplazar el contenido del archivo:

```ts
// src/app/pages/cuaquiverso/checkout/checkout.component.ts
import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CartService } from '../services/cart.service';
import { CheckoutService, CheckoutForm } from '../services/checkout.service';
import { DescuentoService } from '../services/descuento.service';
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
  rio: '#2A6FDB', rosa: '#FF6FA8', sol: '#FFC93C', bone: '#D4DCE4',
  terra: '#E8623D', lila: '#8B6FD8', selva: '#1F8A5B', tibu: '#2E8FB8', cream: '#D8DEDE',
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
  readonly descuento = inject(DescuentoService);
  private  seo       = inject(SeoService);

  readonly ENVIO_GRATIS_DESDE = 150_000;

  private ciudadActual = signal('');

  codigoInput       = '';
  descuentoExpanded = signal(false);

  readonly totalFinal = computed(() =>
    Math.max(0, this.cart.total() - this.descuento.montoDescuento())
  );

  form = new FormGroup({
    nombre:       new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    apellido:     new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email:        new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    celular:      new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] }),
    tipoDoc:      new FormControl('CC', { nonNullable: true, validators: [Validators.required] }),
    numDoc:       new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    departamento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    ciudad:       new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    direccion:    new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    barrio:       new FormControl('', { nonNullable: true }),
    codigoPostal: new FormControl('', { nonNullable: true }),
    nota:         new FormControl('', { nonNullable: true }),
  });

  estimadoTexto = computed(() => {
    const ciudad = this.ciudadActual();
    if (!ciudad) return 'Ingresa tu ciudad para ver el estimado.';
    const key = ciudad.toLowerCase().trim().normalize('NFD').replace(/\p{M}/gu, '');
    return ENVIO_ESTIMADO[key] ?? '~$18.000 – $28.000 COP (contra entrega)';
  });

  ngOnInit(): void {
    this.seo.set({
      title:       'Checkout — Cuaquiverso',
      description: 'Completa tu compra en Cuaquiverso. Envío a toda Colombia.',
      canonical:   'https://cuacdesign.com/cuaquiverso/checkout',
    });
    this.checkout.error.set(null);
    this.descuento.limpiar();
  }

  touched(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  onCiudadChange(): void {
    this.ciudadActual.set(this.form.get('ciudad')?.value ?? '');
  }

  onCodigoInput(e: Event): void {
    this.codigoInput = (e.target as HTMLInputElement).value.toUpperCase();
  }

  async aplicarCodigo(): Promise<void> {
    if (!this.codigoInput.trim()) return;
    await this.descuento.aplicar(this.codigoInput, this.cart.items(), this.cart.total());
  }

  quitarCodigo(): void {
    this.codigoInput = '';
    this.descuento.limpiar();
  }

  colorHex(key: string): string {
    if (!key) return '#3D4856';
    if (key.startsWith('#') || key.startsWith('rgb')) return key;
    return COLOR_MAP[key] ?? '#3D4856';
  }

  async pagar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.checkout.loading.set(true);
    this.checkout.error.set(null);

    try {
      const codigoDesc = this.descuento.codigoAplicado()
        ? { codigo: this.descuento.codigoAplicado()!, monto: this.descuento.montoDescuento() }
        : undefined;

      const { wompi_url } = await this.checkout.crearPedido(
        this.form.getRawValue() as CheckoutForm,
        this.cart.items(),
        this.totalFinal(),
        codigoDesc,
      );
      window.location.href = wompi_url;
    } catch (e: any) {
      this.checkout.error.set(e.message ?? 'Error al procesar el pedido. Intenta de nuevo.');
      this.checkout.loading.set(false);
    }
  }
}
```

- [ ] **Step 3: Actualizar `checkout.component.html`**

Reemplazar el contenido completo del archivo:

```html
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

  <div class="form-col">
    <h1 class="page-title">¿A dónde te lo enviamos?</h1>
    <p class="page-sub">Completa tus datos para continuar al pago.</p>

    <form [formGroup]="form" (ngSubmit)="pagar()">

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

      <div class="form-card" style="padding: 18px 24px">
        <div class="field">
          <label for="nota">Nota para el pedido <span style="font-weight:400;text-transform:none">(opcional)</span></label>
          <input id="nota" type="text" formControlName="nota"
                 placeholder="Instrucciones especiales, referencias del edificio..." />
        </div>
      </div>

    </form>
  </div>

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

      <!-- Código de descuento -->
      <div class="discount-section">
        @if (!descuento.codigoAplicado()) {
          <button class="discount-toggle" type="button"
                  (click)="descuentoExpanded.update(v => !v)">
            ¿Tienes un código de descuento?
            <svg class="chevron" [class.open]="descuentoExpanded()"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
          @if (descuentoExpanded()) {
            <div class="discount-input-row">
              <input type="text" class="discount-input"
                     [value]="codigoInput"
                     (input)="onCodigoInput($event)"
                     placeholder="CUAC20"
                     [disabled]="descuento.validando()" />
              <button type="button" class="btn-apply"
                      [disabled]="!codigoInput.trim() || descuento.validando()"
                      (click)="aplicarCodigo()">
                @if (descuento.validando()) {
                  <span class="spin">⟳</span>
                } @else {
                  Aplicar
                }
              </button>
            </div>
            @if (descuento.error()) {
              <div class="discount-error">{{ descuento.error() }}</div>
            }
          }
        } @else {
          <div class="discount-applied-row">
            <span class="discount-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                   stroke-linecap="round" style="width:12px;height:12px">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
              {{ descuento.codigoAplicado() }}
            </span>
            <button type="button" class="btn-remove-code" (click)="quitarCodigo()">Quitar</button>
          </div>
        }
      </div>

      <div class="sum-row">
        <span>Subtotal</span>
        <span>{{ cart.fmtPrice(cart.total()) }}</span>
      </div>
      @if (descuento.codigoAplicado()) {
        <div class="sum-row discount-line">
          <span>Descuento <em class="code-tag">{{ descuento.codigoAplicado() }}</em></span>
          <span class="discount-amount">−{{ cart.fmtPrice(descuento.montoDescuento()) }}</span>
        </div>
      }
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
        <span>{{ cart.fmtPrice(totalFinal()) }}</span>
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

}
```

- [ ] **Step 4: Añadir estilos para la sección de descuento en `checkout.component.scss`**

Añadir al final del archivo:

```scss
/* ── Discount code section ──────────────────────────────────────────────────── */
.discount-section {
  padding: 12px 0 4px;
  border-top: 1px solid var(--carbon-08);
  margin-top: 4px;
}

.discount-toggle {
  display: flex; align-items: center; gap: 6px;
  background: none; border: none; cursor: pointer;
  font-size: 12.5px; color: var(--carbon-50); font-family: var(--sans);
  padding: 0; transition: color .15s;
  &:hover { color: var(--carbon); }
}
.chevron {
  width: 14px; height: 14px; transition: transform .2s;
  &.open { transform: rotate(180deg); }
}

.discount-input-row {
  display: flex; gap: 8px; margin-top: 10px;
}
.discount-input {
  flex: 1; height: 38px; padding: 0 12px;
  border: 1.5px solid var(--carbon-12); border-radius: 8px;
  font-size: 13px; font-family: var(--mono);
  letter-spacing: .08em; text-transform: uppercase;
  background: #fff; outline: none;
  transition: border-color .15s;
  &:focus { border-color: var(--carbon); }
  &:disabled { opacity: .5; cursor: not-allowed; }
}
.btn-apply {
  height: 38px; padding: 0 16px;
  background: var(--carbon); color: #fff;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 12.5px; font-weight: 600; font-family: var(--sans);
  transition: opacity .15s;
  &:disabled { opacity: .4; cursor: not-allowed; }
  &:not(:disabled):hover { opacity: .85; }
}
.spin {
  display: inline-block;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.discount-error {
  margin-top: 8px; font-size: 12px; color: var(--terra);
}

.discount-applied-row {
  display: flex; align-items: center; gap: 10px; margin-bottom: 4px;
}
.discount-pill {
  display: inline-flex; align-items: center; gap: 5px;
  background: rgba(31,138,91,.12); color: #1F8A5B;
  border-radius: 99px; padding: 4px 10px;
  font-size: 12px; font-weight: 700; font-family: var(--mono);
  letter-spacing: .08em;
}
.btn-remove-code {
  background: none; border: none; cursor: pointer;
  font-size: 11.5px; color: var(--carbon-50); font-family: var(--sans);
  text-decoration: underline; padding: 0;
  &:hover { color: var(--terra); }
}

.discount-line {
  color: #1F8A5B;
  .code-tag {
    font-family: var(--mono); font-size: 10.5px;
    font-style: normal; letter-spacing: .08em;
    background: rgba(31,138,91,.1); border-radius: 4px;
    padding: 1px 5px; margin-left: 4px;
  }
}
.discount-amount { font-weight: 600; }
```

- [ ] **Step 5: Verificar en el navegador**

```bash
ng serve
```

Navegar a `/cuaquiverso/tienda`, añadir un producto al carrito, ir a `/cuaquiverso/checkout`.

Verificar:
1. La sección "¿Tienes un código de descuento?" aparece sobre el subtotal.
2. Clic en el toggle expande el input.
3. Ingresar `TEST10` (creado en Task 2) y clicar "Aplicar".
4. El input desaparece y aparece la pill verde `TEST10`.
5. El subtotal y el total muestran valores distintos (línea de descuento visible).
6. El botón "Quitar" borra el código y restaura el total.
7. Ingresar un código inválido → mensaje de error en rojo.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/cuaquiverso/services/checkout.service.ts \
        src/app/pages/cuaquiverso/checkout/checkout.component.ts \
        src/app/pages/cuaquiverso/checkout/checkout.component.html \
        src/app/pages/cuaquiverso/checkout/checkout.component.scss
git commit -m "feat(checkout): add discount code field with validation and updated totals"
```

---

### Task 6: Admin — `DescuentosAdminService` + `DescuentosTabComponent`

**Files:**
- Create: `src/app/core/services/descuentos-admin.service.ts`
- Create: `src/app/pages/admin/descuentos/descuentos-tab.component.ts`
- Create: `src/app/pages/admin/descuentos/descuentos-tab.component.html`
- Create: `src/app/pages/admin/descuentos/descuentos-tab.component.scss`
- Modify: `src/app/pages/admin/admin-home.component.ts` — añadir `pedidosSubTab` + importar `DescuentosTabComponent`
- Modify: `src/app/pages/admin/admin-home.component.html` — añadir switcher de pestañas en la vista Pedidos

**Interfaces:**
- Consumes: `SupabaseService` (tabla `codigos_descuento`, `pedidos`), `AdminStateService` view `'pedidos'`.
- Produces: CRUD completo de códigos de descuento accesible desde la vista Pedidos del admin.

- [ ] **Step 1: Crear `DescuentosAdminService`**

```ts
// src/app/core/services/descuentos-admin.service.ts
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface CodigoDescuento {
  id:             string;
  codigo:         string;
  tipo:           'porcentaje' | 'fijo';
  valor:          number;
  minimo_orden:   number;
  limite_usos:    number | null;
  usos_actuales:  number;
  productos_ids:  string[] | null;
  categorias_ids: string[] | null;
  activo:         boolean;
  expira_en:      string | null;
  creado_en:      string;
  actualizado_en: string;
}

export type CodigoDescuentoInput = Omit<CodigoDescuento,
  'id' | 'usos_actuales' | 'creado_en' | 'actualizado_en'>;

export interface UsoDescuento {
  referencia:      string;
  creado_en:       string;
  descuento_monto: number;
}

@Injectable({ providedIn: 'root' })
export class DescuentosAdminService {
  private sb = inject(SupabaseService);

  async listar(): Promise<CodigoDescuento[]> {
    const { data, error } = await this.sb.db
      .from('codigos_descuento')
      .select('*')
      .order('creado_en', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CodigoDescuento[];
  }

  async crear(input: CodigoDescuentoInput): Promise<void> {
    const { error } = await this.sb.db
      .from('codigos_descuento')
      .insert({ ...input, codigo: input.codigo.toUpperCase().trim() });
    if (error) throw new Error(error.message);
  }

  async actualizar(id: string, input: Partial<CodigoDescuentoInput>): Promise<void> {
    const { error } = await this.sb.db
      .from('codigos_descuento')
      .update({ ...input, actualizado_en: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.sb.db
      .from('codigos_descuento')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async usosPorCodigo(codigo: string): Promise<UsoDescuento[]> {
    const { data, error } = await this.sb.db
      .from('pedidos')
      .select('referencia, creado_en, descuento_monto')
      .eq('codigo_descuento', codigo)
      .order('creado_en', { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    return (data ?? []) as UsoDescuento[];
  }
}
```

- [ ] **Step 2: Crear `descuentos-tab.component.ts`**

```ts
// src/app/pages/admin/descuentos/descuentos-tab.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DescuentosAdminService,
  CodigoDescuento,
  CodigoDescuentoInput,
  UsoDescuento,
} from '../../../core/services/descuentos-admin.service';

const CATEGORIAS = [
  { id: 'tee',        label: 'Camiseta'   },
  { id: 'pin',        label: 'Pin'        },
  { id: 'sticker',    label: 'Sticker'    },
  { id: 'tote',       label: 'Tote bag'   },
  { id: 'gorra',      label: 'Gorra'      },
  { id: 'peluche',    label: 'Peluche'    },
  { id: 'print',      label: 'Print'      },
  { id: 'llavero',    label: 'Llavero'    },
  { id: 'pañoleta',   label: 'Pañoleta'   },
  { id: 'amigurumi',  label: 'Amigurumi'  },
  { id: 'charm',      label: 'Charm'      },
  { id: 'libreta',    label: 'Libreta'    },
];

@Component({
  selector: 'app-descuentos-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './descuentos-tab.component.html',
  styleUrl:    './descuentos-tab.component.scss',
})
export class DescuentosTabComponent implements OnInit {
  private svc = inject(DescuentosAdminService);

  readonly CATEGORIAS = CATEGORIAS;

  codigos      = signal<CodigoDescuento[]>([]);
  loading      = signal(false);
  drawerOn     = signal(false);
  saving       = signal(false);
  errorMsg     = signal<string | null>(null);
  toastMsg     = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  editingId    = signal<string | null>(null);
  deleteConfirmId = signal<string | null>(null);

  expandedId   = signal<string | null>(null);
  usos         = signal<UsoDescuento[]>([]);
  usosLoading  = signal(false);

  // Form fields
  dcCodigo    = '';
  dcTipo      = signal<'porcentaje' | 'fijo'>('porcentaje');
  dcValor     = '';
  dcMinimo    = '';
  dcLimite    = '';
  dcExpira    = '';
  dcActivo    = signal(true);
  dcCategorias: string[] = [];
  dcProductos = '';   // comma-separated UUIDs

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.loading.set(true);
    try {
      this.codigos.set(await this.svc.listar());
    } catch { /* silent */ }
    this.loading.set(false);
  }

  abrirNuevo(): void {
    this.editingId.set(null);
    this.dcCodigo    = '';
    this.dcTipo.set('porcentaje');
    this.dcValor     = '';
    this.dcMinimo    = '';
    this.dcLimite    = '';
    this.dcExpira    = '';
    this.dcActivo.set(true);
    this.dcCategorias = [];
    this.dcProductos  = '';
    this.errorMsg.set(null);
    this.drawerOn.set(true);
  }

  abrirEditar(c: CodigoDescuento): void {
    this.editingId.set(c.id);
    this.dcCodigo    = c.codigo;
    this.dcTipo.set(c.tipo);
    this.dcValor     = String(c.valor);
    this.dcMinimo    = c.minimo_orden > 0 ? String(c.minimo_orden) : '';
    this.dcLimite    = c.limite_usos !== null ? String(c.limite_usos) : '';
    this.dcExpira    = c.expira_en ? c.expira_en.substring(0, 10) : '';
    this.dcActivo.set(c.activo);
    this.dcCategorias = c.categorias_ids ? [...c.categorias_ids] : [];
    this.dcProductos  = c.productos_ids ? c.productos_ids.join(', ') : '';
    this.errorMsg.set(null);
    this.drawerOn.set(true);
  }

  cerrarDrawer(): void {
    this.drawerOn.set(false);
    this.errorMsg.set(null);
  }

  toggleCategoria(id: string): void {
    const i = this.dcCategorias.indexOf(id);
    if (i > -1) this.dcCategorias.splice(i, 1);
    else this.dcCategorias.push(id);
  }

  async guardar(): Promise<void> {
    if (!this.dcCodigo.trim() || !this.dcValor) {
      this.errorMsg.set('Código y valor son obligatorios.');
      return;
    }
    const valor = parseInt(this.dcValor, 10);
    if (isNaN(valor) || valor <= 0) {
      this.errorMsg.set('El valor debe ser un número positivo.');
      return;
    }

    const productos_ids = this.dcProductos.trim()
      ? this.dcProductos.split(',').map(s => s.trim()).filter(Boolean)
      : null;

    const input: CodigoDescuentoInput = {
      codigo:         this.dcCodigo.toUpperCase().trim(),
      tipo:           this.dcTipo(),
      valor,
      minimo_orden:   this.dcMinimo ? parseInt(this.dcMinimo, 10) : 0,
      limite_usos:    this.dcLimite ? parseInt(this.dcLimite, 10) : null,
      productos_ids,
      categorias_ids: this.dcCategorias.length > 0 ? [...this.dcCategorias] : null,
      activo:         this.dcActivo(),
      expira_en:      this.dcExpira ? new Date(this.dcExpira + 'T23:59:59').toISOString() : null,
    };

    this.saving.set(true);
    this.errorMsg.set(null);
    try {
      const id = this.editingId();
      if (id) {
        await this.svc.actualizar(id, input);
        this.flash('Código actualizado');
      } else {
        await this.svc.crear(input);
        this.flash('Código creado');
      }
      this.drawerOn.set(false);
      await this.cargar();
    } catch (e: any) {
      this.errorMsg.set(e.message ?? 'Error al guardar. Intenta de nuevo.');
    }
    this.saving.set(false);
  }

  async toggleActivo(c: CodigoDescuento): Promise<void> {
    try {
      await this.svc.actualizar(c.id, { activo: !c.activo });
      await this.cargar();
      this.flash(c.activo ? 'Código desactivado' : 'Código activado');
    } catch { /* silent */ }
  }

  confirmarEliminar(id: string): void {
    this.deleteConfirmId.set(id);
  }

  async eliminar(id: string): Promise<void> {
    try {
      await this.svc.eliminar(id);
      this.deleteConfirmId.set(null);
      await this.cargar();
      this.flash('Código eliminado');
    } catch { /* silent */ }
  }

  async toggleExpand(c: CodigoDescuento): Promise<void> {
    if (this.expandedId() === c.id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(c.id);
    this.usosLoading.set(true);
    this.usos.set(await this.svc.usosPorCodigo(c.codigo));
    this.usosLoading.set(false);
  }

  flash(msg: string): void {
    this.toastMsg.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMsg.set(null), 2400);
  }

  fmtCOP(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }

  fmtFecha(s: string | null): string {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
```

- [ ] **Step 3: Crear `descuentos-tab.component.html`**

```html
<!-- src/app/pages/admin/descuentos/descuentos-tab.component.html -->
<div class="ph">
  <div class="ph-l">
    <div class="eyebrow"><span class="dot"></span> Marketing</div>
    <h1>Códigos de <em>descuento</em></h1>
    <p class="sub">Crea y gestiona cupones para la tienda Cuaquiverso.</p>
  </div>
  <div class="ph-r">
    <button class="btn-sm solid" (click)="abrirNuevo()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" style="width:13px;height:13px">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Nuevo código
    </button>
  </div>
</div>

<div class="panel tbl-page">
  <div class="panel-b flush">
    @if (loading()) {
      <div style="padding:48px;text-align:center;color:var(--carbon-50)">Cargando…</div>
    } @else if (codigos().length === 0) {
      <div style="padding:48px;text-align:center;color:var(--carbon-50)">
        Aún no hay códigos de descuento. Crea el primero.
      </div>
    } @else {
      <table class="tbl">
        <thead>
          <tr>
            <th>Código</th>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Mínimo</th>
            <th>Usos</th>
            <th>Expira</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (c of codigos(); track c.id) {
          <tr (click)="toggleExpand(c)" style="cursor:pointer">
            <td><strong style="font-family:var(--mono);letter-spacing:.08em">{{ c.codigo }}</strong></td>
            <td><span style="font-size:11.5px;color:var(--carbon-70)">{{ c.tipo === 'porcentaje' ? 'Porcentaje' : 'Monto fijo' }}</span></td>
            <td>
              @if (c.tipo === 'porcentaje') { {{ c.valor }}% }
              @else { {{ fmtCOP(c.valor) }} }
            </td>
            <td>{{ c.minimo_orden > 0 ? fmtCOP(c.minimo_orden) : '—' }}</td>
            <td>
              {{ c.usos_actuales }}
              @if (c.limite_usos !== null) { / {{ c.limite_usos }} }
              @else { / ∞ }
            </td>
            <td>{{ fmtFecha(c.expira_en) }}</td>
            <td>
              @if (c.activo) {
                <span class="badge ok"><span class="pdot"></span>Activo</span>
              } @else {
                <span class="badge"><span class="pdot"></span>Inactivo</span>
              }
            </td>
            <td class="actions" (click)="$event.stopPropagation()">
              @if (deleteConfirmId() === c.id) {
                <span style="font-size:11.5px;color:var(--terra)">¿Eliminar?</span>
                <button class="icon-act" title="Confirmar" (click)="eliminar(c.id)" style="color:var(--terra)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px"><path d="M20 6 9 17l-5-5"/></svg>
                </button>
                <button class="icon-act" title="Cancelar" (click)="deleteConfirmId.set(null)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px"><path d="M6 6l12 12M18 6 6 18"/></svg>
                </button>
              } @else {
                <button class="icon-act" title="Editar" (click)="abrirEditar(c)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>
                </button>
                <button class="icon-act" [title]="c.activo ? 'Desactivar' : 'Activar'" (click)="toggleActivo(c)">
                  @if (c.activo) {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:15px;height:15px"><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3" fill="currentColor"/></svg>
                  } @else {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:15px;height:15px;opacity:.4"><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="8" cy="12" r="3" fill="currentColor"/></svg>
                  }
                </button>
                <button class="icon-act" title="Eliminar" (click)="confirmarEliminar(c.id)" style="color:var(--carbon-40)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              }
            </td>
          </tr>
          @if (expandedId() === c.id) {
            <tr class="expand-row">
              <td colspan="8">
                <div class="expand-inner">
                  @if (usosLoading()) {
                    <span style="color:var(--carbon-50);font-size:12px">Cargando usos…</span>
                  } @else if (usos().length === 0) {
                    <span style="color:var(--carbon-50);font-size:12px">Sin usos registrados aún.</span>
                  } @else {
                    <span style="font-size:11.5px;font-weight:600;color:var(--carbon-50);text-transform:uppercase;letter-spacing:.08em">Últimos pedidos con este código</span>
                    <table class="inner-tbl">
                      <thead><tr><th>Referencia</th><th>Fecha</th><th>Descuento</th></tr></thead>
                      <tbody>
                        @for (u of usos(); track u.referencia) {
                          <tr>
                            <td><span style="font-family:var(--mono);font-size:11.5px">{{ u.referencia }}</span></td>
                            <td>{{ fmtFecha(u.creado_en) }}</td>
                            <td style="color:#1F8A5B;font-weight:600">−{{ fmtCOP(u.descuento_monto) }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                </div>
              </td>
            </tr>
          }
          }
        </tbody>
      </table>
    }
  </div>
</div>

<!-- Toast -->
@if (toastMsg()) {
  <div class="toast-admin">{{ toastMsg() }}</div>
}

<!-- Drawer -->
@if (drawerOn()) {
<div class="drawer-back on" (click)="cerrarDrawer()"></div>
<div class="drawer on">
  <div class="drawer-h">
    <div>
      <h2>{{ editingId() ? 'Editar código' : 'Nuevo código de descuento' }}</h2>
    </div>
    <button class="drawer-close" (click)="cerrarDrawer()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M6 6l12 12M18 6 6 18"/>
      </svg>
    </button>
  </div>
  <div class="drawer-b">
    <div class="panel">
      <div class="panel-b" style="display:flex;flex-direction:column;gap:var(--s-4)">

        <div class="field">
          <label>Código</label>
          <input class="input" [(ngModel)]="dcCodigo" name="dcCodigo"
                 placeholder="CUAC20" style="text-transform:uppercase;font-family:var(--mono);letter-spacing:.08em"
                 (input)="dcCodigo = dcCodigo.toUpperCase()" />
          <div class="help">Solo letras y números, sin espacios. Se guarda en mayúsculas.</div>
        </div>

        <div class="grid-2">
          <div class="field">
            <label>Tipo de descuento</label>
            <select class="select" [ngModel]="dcTipo()" (ngModelChange)="dcTipo.set($event)" name="dcTipo">
              <option value="porcentaje">Porcentaje (%)</option>
              <option value="fijo">Monto fijo ($)</option>
            </select>
          </div>
          <div class="field">
            <label>Valor {{ dcTipo() === 'porcentaje' ? '(%)' : '(COP)' }}</label>
            <input class="input" type="number" [(ngModel)]="dcValor" name="dcValor"
                   [placeholder]="dcTipo() === 'porcentaje' ? 'Ej: 20' : 'Ej: 5000'" min="1" />
          </div>
        </div>

        <div class="grid-2">
          <div class="field">
            <label>Monto mínimo <span class="opt">(opcional)</span></label>
            <input class="input" type="number" [(ngModel)]="dcMinimo" name="dcMinimo"
                   placeholder="Ej: 80000" min="0" />
            <div class="help">Vacío = sin mínimo.</div>
          </div>
          <div class="field">
            <label>Límite de usos <span class="opt">(opcional)</span></label>
            <input class="input" type="number" [(ngModel)]="dcLimite" name="dcLimite"
                   placeholder="Ej: 100" min="1" />
            <div class="help">Vacío = ilimitado.</div>
          </div>
        </div>

        <div class="field">
          <label>Fecha de expiración <span class="opt">(opcional)</span></label>
          <input class="input" type="date" [(ngModel)]="dcExpira" name="dcExpira" />
          <div class="help">Vacío = no expira.</div>
        </div>

        <div class="field">
          <label>Categorías <span class="opt">(opcional, vacío = todas)</span></label>
          <div class="cat-chips">
            @for (cat of CATEGORIAS; track cat.id) {
              <button type="button" class="chip"
                      [class.on]="dcCategorias.includes(cat.id)"
                      (click)="toggleCategoria(cat.id)">
                {{ cat.label }}
              </button>
            }
          </div>
        </div>

        <div class="field">
          <label>Productos específicos <span class="opt">(opcional)</span></label>
          <textarea class="textarea" [(ngModel)]="dcProductos" name="dcProductos" rows="2"
                    placeholder="UUID1, UUID2, ..."></textarea>
          <div class="help">UUIDs de productos separados por coma. Vacío = todos los productos.</div>
        </div>

        <div class="field" style="flex-direction:row;align-items:center;gap:10px">
          <label style="margin:0">Activo</label>
          <button type="button" class="toggle-btn" [class.on]="dcActivo()"
                  (click)="dcActivo.update(v => !v)">
            <span class="toggle-thumb"></span>
          </button>
        </div>

        @if (errorMsg()) {
          <div style="color:var(--terra);font-size:12.5px;padding:8px 12px;background:rgba(232,98,61,.08);border-radius:8px">
            {{ errorMsg() }}
          </div>
        }
      </div>
    </div>
  </div>
  <div class="drawer-f">
    @if (editingId()) {
      <button class="btn-sm ghost" style="color:var(--terra)"
              (click)="confirmarEliminar(editingId()!); cerrarDrawer()">
        Eliminar
      </button>
    }
    <div style="flex:1"></div>
    <button class="btn-sm ghost" (click)="cerrarDrawer()">Cancelar</button>
    <button class="btn-sm solid" (click)="guardar()" [disabled]="saving()">
      {{ saving() ? 'Guardando…' : (editingId() ? 'Actualizar' : 'Crear código') }}
    </button>
  </div>
</div>
}
```

- [ ] **Step 4: Crear `descuentos-tab.component.scss`**

```scss
// src/app/pages/admin/descuentos/descuentos-tab.component.scss
:host { display: block; }

.cat-chips {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;
}

.expand-row td {
  background: rgba(21,31,40,.02);
  border-bottom: 1px solid var(--carbon-06);
}
.expand-inner {
  padding: 14px 18px;
  display: flex; flex-direction: column; gap: 10px;
}
.inner-tbl {
  width: 100%; border-collapse: collapse; font-size: 12.5px;
  th { text-align: left; color: var(--carbon-50); font-weight: 500; padding: 4px 8px; }
  td { padding: 5px 8px; border-bottom: 1px solid var(--carbon-06); }
}

.toggle-btn {
  width: 36px; height: 20px; border-radius: 99px;
  background: var(--carbon-12); border: none; cursor: pointer;
  position: relative; transition: background .2s;
  &.on { background: #1F8A5B; }
}
.toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; transition: transform .2s;
  .toggle-btn.on & { transform: translateX(16px); }
}

.toast-admin {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: var(--carbon); color: #fff; border-radius: 10px;
  padding: 10px 20px; font-size: 13px; z-index: 200;
  box-shadow: 0 4px 24px rgba(21,31,40,.18);
  animation: fadeInUp .25s ease;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

- [ ] **Step 5: Añadir `pedidosSubTab` + importar componente en `admin-home.component.ts`**

En `src/app/pages/admin/admin-home.component.ts`:

1. En el `import` de `@angular/core`, el archivo ya tiene `signal` — no cambia.
2. Añadir el import del nuevo componente al final de los imports:
```ts
import { DescuentosTabComponent } from './descuentos/descuentos-tab.component';
```
3. En el decorador `@Component`, añadir `DescuentosTabComponent` al array `imports`:
```ts
imports: [CommonModule, FormsModule, RouterLink, ClienteDetailComponent, PagoDetailComponent, DescuentosTabComponent],
```
4. En el cuerpo de la clase, después de `orderTab = signal('all');`, añadir:
```ts
pedidosSubTab = signal<'pedidos' | 'descuentos'>('pedidos');
```

- [ ] **Step 6: Añadir el switcher de pestañas en `admin-home.component.html`**

Localizar el bloque `@case ('pedidos')` (línea 212). Reemplazar las dos líneas de `.tabs` existentes (líneas 225-231) con lo siguiente — dejando el resto del bloque intacto:

```html
<!-- Sub-navegación Pedidos / Descuentos -->
<div class="section-switcher">
  <button class="ssw-btn" [class.on]="pedidosSubTab()==='pedidos'"
          (click)="pedidosSubTab.set('pedidos')">
    Pedidos
  </button>
  <button class="ssw-btn" [class.on]="pedidosSubTab()==='descuentos'"
          (click)="pedidosSubTab.set('descuentos')">
    Descuentos
  </button>
</div>

@if (pedidosSubTab() === 'pedidos') {
  <div class="tabs">
    <button class="tab" [class.on]="orderTab()==='all'"     (click)="orderTab.set('all')">Todos     <span class="ct">{{ ordersByTab().all.length }}</span></button>
    <button class="tab" [class.on]="orderTab()==='paid'"    (click)="orderTab.set('paid')">Pagados   <span class="ct">{{ ordersByTab().paid.length }}</span></button>
    <button class="tab" [class.on]="orderTab()==='pending'" (click)="orderTab.set('pending')">Pendientes <span class="ct">{{ ordersByTab().pending.length }}</span></button>
    <button class="tab" [class.on]="orderTab()==='shipped'" (click)="orderTab.set('shipped')">Enviados  <span class="ct">{{ ordersByTab().shipped.length }}</span></button>
    <button class="tab" [class.on]="orderTab()==='issues'"  (click)="orderTab.set('issues')">Problemas <span class="ct">{{ ordersByTab().issues.length }}</span></button>
  </div>
  <div class="tlb">
    <div class="search-min"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg><input placeholder="Buscar por orden, cliente, ciudad…" /></div>
    <button class="chip">Últimos 7 días</button>
    <div class="spacer"></div>
    <span style="font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--carbon-50)">{{ currentOrders().length }} pedidos</span>
  </div>
  <div class="panel tbl-page">
    <div class="panel-b flush">
      <table class="tbl">
        <thead><tr><th style="width:36px"><input type="checkbox" /></th><th>Orden</th><th>Cliente</th><th>Ciudad</th><th>Items</th><th>Pago</th><th>Envío</th><th>Método</th><th class="num">Total</th><th>Fecha</th><th></th></tr></thead>
        <tbody>
          @for (o of currentOrders(); track o.id) {
          <tr (click)="openOrder()">
            <td (click)="$event.stopPropagation()"><input type="checkbox" /></td>
            <td><span class="id" style="color:var(--carbon);font-weight:600">{{ o.id }}</span></td>
            <td><strong style="font-weight:600">{{ o.customer }}</strong><div style="font-size:11px;color:var(--carbon-50);font-family:var(--mono)">{{ o.email }}</div></td>
            <td>{{ o.city }}</td>
            <td>{{ o.items }}</td>
            <td><span class="badge" [class]="sb(o.status).tone"><span class="pdot"></span>{{ sb(o.status).label }}</span></td>
            <td><span class="badge" [class]="sb(o.shipping).tone"><span class="pdot"></span>{{ sb(o.shipping).label }}</span></td>
            <td><span style="font-family:var(--mono);font-size:11.5px;color:var(--carbon-70)">{{ o.method }}</span></td>
            <td class="num">{{ fmtCOP(o.total) }}</td>
            <td><span class="id">{{ o.date }}</span></td>
            <td class="actions" (click)="$event.stopPropagation()">
              <button class="icon-act"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button>
            </td>
          </tr>
          }
        </tbody>
      </table>
    </div>
  </div>
} @else {
  <app-descuentos-tab />
}
```

- [ ] **Step 7: Añadir estilos del switcher en `admin-home.component.scss`**

Buscar el archivo `src/app/pages/admin/admin-home.component.scss` y añadir al final:

```scss
/* ── Section switcher (Pedidos / Descuentos) ─────────────────────────────── */
.section-switcher {
  display: flex; gap: 2px; margin-bottom: 18px;
  background: var(--carbon-06); border-radius: 10px; padding: 3px;
  width: fit-content;
}
.ssw-btn {
  padding: 6px 16px; border: none; border-radius: 8px; cursor: pointer;
  font-size: 13px; font-weight: 500; font-family: var(--sans);
  color: var(--carbon-50); background: transparent; transition: all .15s;
  &.on {
    background: #fff; color: var(--carbon); font-weight: 600;
    box-shadow: 0 1px 4px rgba(21,31,40,.1);
  }
  &:not(.on):hover { color: var(--carbon); }
}
```

- [ ] **Step 8: Verificar en el navegador**

```bash
ng serve
```

Ir a `/admin`, clic en Pedidos en la nav lateral. Verificar:
1. Aparecen dos botones: "Pedidos" | "Descuentos" en el section-switcher.
2. "Pedidos" está activo por defecto — la tabla de órdenes se muestra igual que antes.
3. Clic en "Descuentos" → aparece el encabezado "Códigos de descuento" + tabla (vacía o con datos de Supabase).
4. Clic en "+ Nuevo código" → se abre el drawer lateral.
5. Llenar el formulario, guardar → el código aparece en la tabla.
6. Editar un código, cambiar un valor, guardar → los cambios se reflejan.
7. Toggle de activo → badge cambia.
8. Eliminar → pide confirmación inline, luego desaparece de la tabla.
9. Expandir una fila (click) → muestra los últimos pedidos que usaron ese código.

- [ ] **Step 9: Commit**

```bash
git add src/app/core/services/descuentos-admin.service.ts \
        src/app/pages/admin/descuentos/ \
        src/app/pages/admin/admin-home.component.ts \
        src/app/pages/admin/admin-home.component.html \
        src/app/pages/admin/admin-home.component.scss
git commit -m "feat(admin): add discount codes management tab in Pedidos view"
```

---

## Self-Review

### Cobertura del spec
| Requerimiento | Task |
|---|---|
| Tabla `codigos_descuento` + columnas en `pedidos` | Task 1 |
| Función `incrementar_uso_descuento` atómica | Task 3 Step 2 |
| EF `validar-descuento` con todas las validaciones | Task 2 |
| EF `crear-pedido` actualizada con descuento | Task 3 |
| `CartItem.categoria` para restricción por categoría | Task 4 |
| `DescuentoService` con signals y `aplicar`/`limpiar` | Task 4 |
| Campo de código en checkout con estados (vacío/validando/aplicado/error) | Task 5 |
| Totales actualizados (línea de descuento) | Task 5 |
| `pagar()` pasa código al backend | Task 5 |
| CRUD admin (crear/editar/toggle/eliminar) | Task 6 |
| Pestaña "Descuentos" dentro de vista Pedidos | Task 6 |
| Panel de usos por código (últimos 5 pedidos) | Task 6 |
| RLS en `codigos_descuento` | Task 1 |

### Nombres consistentes a través de tasks
- `DescuentoService.aplicar()` — Task 4 define, Task 5 consume ✓
- `DescuentoService.limpiar()` — Task 4 define, Task 5 consume ✓
- `descuento.montoDescuento()` — Task 4 signal, Task 5 usa en `totalFinal` computed ✓
- `CheckoutService.crearPedido(..., codigoDescuento?)` — Task 5 Step 1 define y Task 5 Step 2 consume ✓
- `CodigoDescuento` interface — Task 6 Step 1 define, Task 6 Step 2 consume ✓
- `incrementar_uso_descuento(p_codigo)` — Task 3 Step 2 crea, Task 3 Step 1 llama con `.rpc()` ✓
- `CartItem.categoria` — Task 4 Step 1 añade, Task 4 Step 2 popula, Task 4 Step 3 consume ✓
