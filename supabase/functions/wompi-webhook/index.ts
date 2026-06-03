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
