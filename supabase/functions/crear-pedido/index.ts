// supabase/functions/crear-pedido/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.1'
import { BOLD_CURRENCY, firmaIntegridad } from '../_shared/bold.ts'
import { ENVIO_GRATIS_DESDE } from '../_shared/tienda.ts'

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
    // El precio, el subtotal y el descuento que manda el cliente se IGNORAN a
    // propósito: se recalculan aquí contra el catálogo. Confiar en ellos dejaba
    // que el comprador firmara con Bold el monto que quisiera (fraude de precio).
    const { form, items, codigo_descuento } = body

    if (
      !isStr(form?.nombre) || !isStr(form?.apellido) ||
      !isStr(form?.email)  || !isStr(form?.celular)  ||
      !isStr(form?.tipoDoc) || !isStr(form?.numDoc)  ||
      !isStr(form?.departamento) || !isStr(form?.ciudad) ||
      !isStr(form?.direccion) ||
      !Array.isArray(items) || items.length === 0
    ) {
      return json({ ok: false, error: 'Faltan campos requeridos' }, 400)
    }

    // Cada ítem debe traer el id del producto y una cantidad entera positiva.
    // El precio se toma de la base, no de aquí.
    for (const it of items) {
      if (!isStr(it?.id) || !Number.isInteger(it?.cantidad) || it.cantidad <= 0) {
        return json({ ok: false, error: 'Ítems del pedido inválidos' }, 400)
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Precios y stock autoritativos desde el catálogo ───────────────────────
    const ids = [...new Set(items.map((i: any) => i.id as string))]
    const { data: productos, error: prodError } = await supabase
      .from('productos_evento')
      .select('id, nombre, categoria, precio, activo, stock_actual')
      .in('id', ids)

    if (prodError) {
      console.error(prodError)
      return json({ ok: false, error: 'No se pudo verificar el catálogo' }, 500)
    }

    const catalogo = new Map(
      (productos ?? [])
        .filter((p: any) => p.activo && Number.isInteger(p.precio) && p.precio > 0)
        .map((p: any) => [p.id, p]),
    )

    // Todo id pedido debe existir, estar activo y tener precio válido.
    if (items.some((i: any) => !catalogo.has(i.id))) {
      return json({ ok: false, error: 'Alguno de los productos ya no está disponible' }, 422)
    }

    // ── Stock: hasta ahora nadie miraba `stock_actual` en el camino web, así
    // que se podía comprar un agotado tantas veces como se quisiera. Esto no es
    // una reserva (el stock se descuenta al aprobarse el pago, en el webhook):
    // es la comprobación que evita el caso obvio de vender lo que no existe.
    const pedidoPorProducto = new Map<string, number>()
    for (const i of items) {
      pedidoPorProducto.set(i.id, (pedidoPorProducto.get(i.id) ?? 0) + (i.cantidad as number))
    }
    for (const [id, cantidad] of pedidoPorProducto) {
      const p = catalogo.get(id)!
      const disponible = Number.isInteger(p.stock_actual) ? p.stock_actual : 0
      if (disponible <= 0) {
        return json({ ok: false, error: `"${p.nombre}" se agotó mientras comprabas. Quítalo del carrito para continuar.` }, 409)
      }
      if (cantidad > disponible) {
        return json({
          ok: false,
          error: `Sólo quedan ${disponible} de "${p.nombre}". Ajusta la cantidad para continuar.`,
        }, 409)
      }
    }

    // Líneas con el id, precio, nombre y categoría que manda el servidor. `sub`
    // y `color` son cosméticos (variante de color) y sí vienen del cliente.
    const lineas = items.map((i: any) => {
      const p = catalogo.get(i.id)!
      return {
        id:       i.id as string,
        nombre:   p.nombre as string,
        categoria: p.categoria as string | null,
        precio:   p.precio as number,
        cantidad: i.cantidad as number,
        // `sub` es NOT NULL en la tabla: un null aquí reventaba el INSERT de
        // items después de haber insertado ya el pedido.
        sub:      typeof i.sub === 'string' ? i.sub : '',
        color:    typeof i.color === 'string' ? i.color : null,
      }
    })

    const subtotal = lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0)
    if (subtotal <= 0) {
      return json({ ok: false, error: 'El pedido no tiene un total válido' }, 400)
    }

    // ── Validación + recomputación del descuento (sobre precios de catálogo) ───
    let montoDescuento    = 0
    let codigoNormalizado: string | null = null

    if (typeof codigo_descuento === 'string' && codigo_descuento.trim()) {
      codigoNormalizado = codigo_descuento.toUpperCase().trim()

      const { data: dc, error: dcError } = await supabase
        .from('codigos_descuento')
        .select('*')
        .eq('codigo', codigoNormalizado)
        .single()

      if (dcError || !dc || !dc.activo) {
        return json({ ok: false, error: 'Código de descuento no válido o expirado' }, 422)
      }
      if (dc.expira_en && new Date(dc.expira_en) < new Date()) {
        return json({ ok: false, error: 'Código de descuento no válido o expirado' }, 422)
      }
      if (dc.limite_usos !== null && dc.usos_actuales >= dc.limite_usos) {
        return json({ ok: false, error: 'Código de descuento no válido o expirado' }, 422)
      }
      if (subtotal < dc.minimo_orden) {
        return json({ ok: false, error: 'Código de descuento no válido o expirado' }, 422)
      }

      // Filtro por producto / categoría, usando id y categoría de catálogo.
      let lineasElegibles = lineas
      if (dc.productos_ids && dc.productos_ids.length > 0) {
        lineasElegibles = lineas.filter(l => dc.productos_ids.includes(l.id))
        if (lineasElegibles.length === 0) {
          return json({ ok: false, error: 'Código de descuento no válido o expirado' }, 422)
        }
      } else if (dc.categorias_ids && dc.categorias_ids.length > 0) {
        lineasElegibles = lineas.filter(l => l.categoria && dc.categorias_ids.includes(l.categoria))
        if (lineasElegibles.length === 0) {
          return json({ ok: false, error: 'Código de descuento no válido o expirado' }, 422)
        }
      }

      const subtotalElegible = lineasElegibles.reduce((acc, l) => acc + l.precio * l.cantidad, 0)
      montoDescuento = dc.tipo === 'porcentaje'
        ? Math.round(subtotalElegible * dc.valor / 100)
        : Math.min(dc.valor, subtotal)
    }

    const total = Math.max(0, subtotal - montoDescuento)

    // Generar referencia única
    let referencia = generarReferencia()
    const { data: existing } = await supabase
      .from('pedidos').select('id').eq('referencia', referencia).maybeSingle()
    if (existing) referencia = generarReferencia()

    // Insertar pedido (subtotal/total/descuento son los del servidor)
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
        // La promesa de "envío gratis desde $150k" se anunciaba en tres
        // pantallas y no quedaba en ningún lado del pedido: quien empacaba no
        // podía saber que ese envío iba prepagado. Lo decide el servidor.
        envio_gratis:     subtotal >= ENVIO_GRATIS_DESDE,
        estado:           'pendiente',
      })
      .select('id, confirmacion_token')
      .single()

    if (pedidoError || !pedido) {
      console.error(pedidoError)
      return json({ ok: false, error: 'Error al crear el pedido' }, 500)
    }

    // Insertar items con el id, precio y nombre autoritativos. `producto_id` es
    // lo que permite descontar inventario al aprobarse el pago: sin él sólo
    // quedaba el nombre, que es texto libre y cambia al editar el producto.
    const { error: itemsError } = await supabase
      .from('pedido_items')
      .insert(lineas.map(l => ({
        pedido_id:   pedido.id,
        producto_id: l.id,
        nombre:      l.nombre,
        sub:         l.sub,
        precio:      l.precio,
        cantidad:    l.cantidad,
        color:       l.color,
      })))

    if (itemsError) {
      console.error(itemsError)
      // Sin este rollback quedaba un pedido 'pendiente' sin líneas en el admin.
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      return json({ ok: false, error: 'Error al guardar los productos' }, 500)
    }

    // ── Incrementar el contador de usos tras ambos inserts ────────────────────
    if (codigoNormalizado) {
      const { data: dcRows } = await supabase.rpc('incrementar_uso_descuento', {
        p_codigo: codigoNormalizado,
      })
      if (!dcRows || dcRows === 0) {
        await supabase.from('pedido_items').delete().eq('pedido_id', pedido.id)
        await supabase.from('pedidos').delete().eq('id', pedido.id)
        return json({ ok: false, error: 'El código ya no está disponible' }, 409)
      }
    }

    // ── Configuración firmada del botón de pagos Bold ─────────────────────────
    const apiKey       = Deno.env.get('BOLD_API_KEY')!
    const llaveSecreta = Deno.env.get('BOLD_SECRET_KEY')!
    const appUrl       = Deno.env.get('APP_URL') ?? 'https://cuacdesign.com'

    // Bold cobra en pesos sin decimales, no en centavos como Wompi.
    const amount = total

    // La página de confirmación busca el pedido por ?ref=, que ahora lleva el
    // token impredecible (no la referencia, que era enumerable). Bold añade sus
    // propios parámetros con & al volver.
    const redirectionUrl = `${appUrl}/cuaquiverso/checkout/confirmacion?ref=${encodeURIComponent(pedido.confirmacion_token)}`

    const integritySignature = await firmaIntegridad(referencia, amount, BOLD_CURRENCY, llaveSecreta)

    const cantidadItems = lineas.reduce((acc, l) => acc + l.cantidad, 0)

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
