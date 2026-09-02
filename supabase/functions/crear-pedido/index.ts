// supabase/functions/crear-pedido/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BOLD_CURRENCY, firmaIntegridad } from '../_shared/bold.ts'

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
    // descuento_monto from the client body is intentionally ignored — computed server-side (C2)
    const { form, items, subtotal, codigo_descuento } = body

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

    // ── C2: Server-side discount validation + recomputation ───────────────────
    let montoDescuento    = 0
    let codigoNormalizado: string | null = null

    if (typeof codigo_descuento === 'string' && codigo_descuento.trim()) {
      codigoNormalizado = codigo_descuento.toUpperCase().trim()

      const { data: dc, error: dcError } = await supabase
        .from('codigos_descuento')
        .select('*')
        .eq('codigo', codigoNormalizado)
        .single()

      // existence + activo
      if (dcError || !dc || !dc.activo) {
        return json({ ok: false, error: 'Código de descuento no válido o expirado' }, 422)
      }

      // expiry
      if (dc.expira_en && new Date(dc.expira_en) < new Date()) {
        return json({ ok: false, error: 'Código de descuento no válido o expirado' }, 422)
      }

      // usage limit (snapshot check; definitive check happens via RPC after inserts)
      if (dc.limite_usos !== null && dc.usos_actuales >= dc.limite_usos) {
        return json({ ok: false, error: 'Código de descuento no válido o expirado' }, 422)
      }

      // minimum order
      if (subtotal < dc.minimo_orden) {
        return json({ ok: false, error: 'Código de descuento no válido o expirado' }, 422)
      }

      // product / category filter
      let itemsElegibles: any[] = items
      if (dc.productos_ids && dc.productos_ids.length > 0) {
        itemsElegibles = items.filter((i: any) => dc.productos_ids.includes(i.id))
        if (itemsElegibles.length === 0) {
          return json({ ok: false, error: 'Código de descuento no válido o expirado' }, 422)
        }
      } else if (dc.categorias_ids && dc.categorias_ids.length > 0) {
        itemsElegibles = items.filter((i: any) => i.categoria && dc.categorias_ids.includes(i.categoria))
        if (itemsElegibles.length === 0) {
          return json({ ok: false, error: 'Código de descuento no válido o expirado' }, 422)
        }
      }

      // recompute amount server-side
      const subtotalElegible = itemsElegibles.reduce(
        (acc: number, i: any) => acc + i.precio * i.cantidad, 0
      )
      montoDescuento = dc.tipo === 'porcentaje'
        ? Math.round(subtotalElegible * dc.valor / 100)
        : Math.min(dc.valor, subtotal)
    }
    // ─────────────────────────────────────────────────────────────────────────

    const total = Math.max(0, subtotal - montoDescuento)

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
        codigo_descuento: codigoNormalizado,
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

    // ── I1: Increment usage counter AFTER both inserts succeed ────────────────
    if (codigoNormalizado) {
      const { data: dcRows } = await supabase.rpc('incrementar_uso_descuento', {
        p_codigo: codigoNormalizado,
      })
      // If RPC returns 0/null the code was exhausted in the race window — roll back
      if (!dcRows || dcRows === 0) {
        await supabase.from('pedido_items').delete().eq('pedido_id', pedido.id)
        await supabase.from('pedidos').delete().eq('id', pedido.id)
        return json({ ok: false, error: 'El código ya no está disponible' }, 409)
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Configuración firmada del botón de pagos Bold ─────────────────────────
    // La llave de identidad es pública y viaja al navegador; la secreta se queda
    // aquí y sólo se usa para el hash de integridad.
    const apiKey       = Deno.env.get('BOLD_API_KEY')!
    const llaveSecreta = Deno.env.get('BOLD_SECRET_KEY')!
    const appUrl       = Deno.env.get('APP_URL') ?? 'https://cuacdesign.com'

    // Bold cobra en pesos sin decimales, no en centavos como Wompi.
    const amount = total

    // La página de confirmación busca el pedido por ?ref=; Bold añade sus
    // propios parámetros con & al volver.
    const redirectionUrl = `${appUrl}/cuaquiverso/checkout/confirmacion?ref=${encodeURIComponent(referencia)}`

    const integritySignature = await firmaIntegridad(referencia, amount, BOLD_CURRENCY, llaveSecreta)

    const cantidadItems = items.reduce((acc: number, i: any) => acc + i.cantidad, 0)

    return json({
      ok: true,
      referencia,
      bold: {
        apiKey,
        orderId:  referencia,
        amount:   String(amount),
        currency: BOLD_CURRENCY,
        integritySignature,
        redirectionUrl,
        description: `Cuaquiverso · ${cantidadItems} ${cantidadItems === 1 ? 'producto' : 'productos'}`,
        customerData: JSON.stringify({
          email:          form.email.trim().toLowerCase(),
          fullName:       `${form.nombre.trim()} ${form.apellido.trim()}`,
          phone:          form.celular.replace(/\D/g, ''),
          dialCode:       '+57',
          documentNumber: form.numDoc.trim(),
          documentType:   form.tipoDoc,
        }),
        billingAddress: JSON.stringify({
          address: form.direccion.trim(),
          zipCode: form.codigoPostal?.trim() || '',
          city:    form.ciudad.trim(),
          state:   form.departamento.trim(),
          country: 'CO',
        }),
      },
    })

  } catch (err) {
    console.error(err)
    return json({ ok: false, error: 'Error interno del servidor' }, 500)
  }
})
