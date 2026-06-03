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
