// supabase/functions/verificar-pago/index.ts
//
// Respaldo del webhook de Bold. La pantalla de confirmación llama aquí mientras
// el pedido sigue 'pendiente': preguntamos —servidor a servidor— el estado real
// de la venta a la API de Bold y, si está pagada, movemos el pedido. Así el
// pedido se cierra aunque el webhook no llegue (p. ej. si está en modo pruebas).
//
// Bold: GET https://payments.api.bold.co/v2/payment-voucher/<id>
//   Authorization: x-api-key <LLAVE DE IDENTIDAD>   (la pública, no la secreta)
// Se puede consultar por el `bold-order-id` que Bold añade a la URL de retorno o
// por la referencia del comercio. La respuesta trae `payment_status`,
// `reference_id`, `total` y `transaction_id`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.1'

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

function isStr(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0 }

/** Sólo los estados terminales de Bold mueven el pedido; el resto lo dejan como está. */
const ESTADO_POR_STATUS: Record<string, string> = {
  APPROVED: 'aprobado',
  REJECTED: 'rechazado',
  FAILED:   'rechazado',
  VOIDED:   'cancelado',
  // PROCESSING / PENDING / NO_TRANSACTION_FOUND -> se queda 'pendiente'
}

async function consultarVenta(identificador: string, apiKey: string): Promise<any | null> {
  try {
    const res = await fetch(
      `https://payments.api.bold.co/v2/payment-voucher/${encodeURIComponent(identificador)}`,
      { headers: { 'Authorization': `x-api-key ${apiKey}` } },
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const referencia = isStr(body?.referencia) ? body.referencia.trim() : ''
    const boldOrderId = isStr(body?.boldOrderId) ? body.boldOrderId.trim() : ''
    if (!referencia) return json({ ok: false, error: 'Falta la referencia' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: pedido, error: pErr } = await supabase
      .from('pedidos')
      .select('id, estado, total, referencia')
      .eq('referencia', referencia)
      .maybeSingle()

    if (pErr) return json({ ok: false, error: 'No se pudo consultar el pedido' }, 500)
    if (!pedido) return json({ ok: false, error: 'Pedido no encontrado' }, 404)

    // Ya resuelto: no hay nada que consultar.
    if (pedido.estado !== 'pendiente') {
      return json({ ok: true, estado: pedido.estado, cambiado: false })
    }

    const apiKey = Deno.env.get('BOLD_API_KEY')!

    // Primero por el id que Bold mandó al volver (identifica la venta concreta);
    // si no hay o no resuelve, por la referencia del comercio.
    const candidatos = [boldOrderId, pedido.referencia].filter(isStr)
    let venta: any = null
    for (const id of candidatos) {
      const r = await consultarVenta(id, apiKey)
      if (!r) continue
      if (!venta) venta = r
      if (r.payment_status && r.payment_status !== 'NO_TRANSACTION_FOUND') { venta = r; break }
    }

    if (!venta || !venta.payment_status) {
      return json({ ok: true, estado: 'pendiente', cambiado: false })
    }

    const nuevoEstado = ESTADO_POR_STATUS[String(venta.payment_status)] ?? null
    if (!nuevoEstado) {
      // PROCESSING / PENDING / NO_TRANSACTION_FOUND
      return json({ ok: true, estado: 'pendiente', cambiado: false })
    }

    // La venta consultada tiene que ser de ESTE pedido: si el reference_id no
    // cuadra, alguien pasó un bold-order-id de otra orden — no lo tocamos.
    if (isStr(venta.reference_id) && venta.reference_id !== pedido.referencia) {
      console.error(`reference_id no coincide: ${venta.reference_id} != ${pedido.referencia}`)
      return json({ ok: true, estado: 'pendiente', cambiado: false })
    }

    // Sólo aprobamos si el monto de Bold cuadra con el del pedido.
    if (nuevoEstado === 'aprobado' && Number(venta.total) !== Number(pedido.total)) {
      console.error(`Monto no coincide para ${pedido.referencia}: bold=${venta.total} pedido=${pedido.total}`)
      return json({ ok: true, estado: 'pendiente', cambiado: false })
    }

    const { error: uErr } = await supabase
      .from('pedidos')
      .update({ estado: nuevoEstado, bold_payment_id: isStr(venta.transaction_id) ? venta.transaction_id : null })
      .eq('id', pedido.id)
      .eq('estado', 'pendiente')

    if (uErr) {
      console.error('Error actualizando pedido:', uErr)
      return json({ ok: false, error: 'Error al actualizar el pedido' }, 500)
    }

    return json({ ok: true, estado: nuevoEstado, cambiado: true })

  } catch (err) {
    console.error(err)
    return json({ ok: false, error: 'Error interno del servidor' }, 500)
  }
})
