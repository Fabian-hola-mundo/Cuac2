// supabase/functions/bold-webhook/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.1'
import { estadoDesdeEvento, firmasIguales, firmaWebhook } from '../_shared/bold.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bold-signature',
}

function ok(mensaje = 'ok') {
  return new Response(mensaje, { status: 200, headers: CORS })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const cuerpoCrudo = await req.text()

  // En pruebas Bold firma con la cadena vacía; en producción, con la llave
  // secreta. Fail-closed: si falta BOLD_SECRET_KEY fuera de pruebas NO se cae a
  // la llave vacía (que cualquiera puede reproducir y forjar un SALE_APPROVED),
  // sino que se responde 500 y ningún evento pasa la validación.
  const esPruebas = Deno.env.get('BOLD_AMBIENTE') === 'pruebas'
  let   llaveSecreta: string
  if (esPruebas) {
    llaveSecreta = ''
  } else {
    const secreto = Deno.env.get('BOLD_SECRET_KEY')
    if (!secreto) {
      console.error('BOLD_SECRET_KEY no configurada en producción — rechazando el webhook')
      return new Response('Configuración del servidor incompleta', { status: 500, headers: CORS })
    }
    llaveSecreta = secreto
  }
  const esperada = await firmaWebhook(cuerpoCrudo, llaveSecreta)

  if (!firmasIguales(req.headers.get('x-bold-signature'), esperada)) {
    return new Response('Firma inválida', { status: 401, headers: CORS })
  }

  let evento: any
  try { evento = JSON.parse(cuerpoCrudo) } catch {
    return new Response('JSON inválido', { status: 400, headers: CORS })
  }

  const estado     = estadoDesdeEvento(evento?.type ?? '')
  const referencia = evento?.data?.metadata?.reference
  const eventoId   = evento?.id

  // Eventos que no mueven el estado del pedido (p. ej. VOID_REJECTED): se
  // confirman y ya. Bold sólo necesita el 200.
  if (!estado || !referencia) return ok()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Idempotencia: Bold reintenta hasta 5 veces si no ve un 200 a tiempo. El
  // primer INSERT gana; los reintentos chocan con la llave primaria y salen.
  if (eventoId) {
    const { error: dupError } = await supabase
      .from('bold_eventos')
      .insert({ id: eventoId, tipo: evento.type, referencia })

    if (dupError) {
      if (dupError.code === '23505') return ok('duplicado')
      console.error('Error registrando evento Bold:', dupError)
      return new Response('Error interno', { status: 500, headers: CORS })
    }
  }

  const { error } = await supabase
    .from('pedidos')
    .update({ estado, bold_payment_id: evento?.data?.payment_id ?? evento?.subject ?? null })
    .eq('referencia', referencia)

  if (error) {
    console.error('Error actualizando pedido:', error)
    return new Response('Error interno', { status: 500, headers: CORS })
  }

  // Un pago aprobado es lo que mueve inventario. Antes de esto el stock sólo
  // bajaba con las ventas del POS, así que la web podía vender indefinidamente
  // un producto agotado. `registrar_venta_web` es idempotente (marca el pedido
  // con `stock_descontado`), así que un reintento de Bold no descuenta dos
  // veces.
  if (estado === 'aprobado') {
    const { error: stockError } = await supabase.rpc('registrar_venta_web', {
      p_referencia: referencia,
    })
    // No se devuelve 500: el pago ya está cobrado y el evento ya se registró
    // como procesado, así que un reintento de Bold no arreglaría nada. Queda el
    // log y el pedido con stock_descontado=false para poder repararlo a mano.
    if (stockError) {
      console.error('Error descontando stock del pedido', referencia, stockError)
    }
  }

  return ok()
})
