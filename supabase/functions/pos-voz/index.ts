// supabase/functions/pos-voz/index.ts
// Venta por voz del POS: transcribe con Groq Whisper, interpreta con un modelo
// de Groq en JSON estricto contra el catálogo activo y valida en el servidor
// que nada se haya adivinado. No registra ventas: el POS confirma y registra.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validarPropuesta } from './evidencia.js'
import { interpretar, METODOS } from './interpretar.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GROQ = 'https://api.groq.com/openai/v1'
const MAX_AUDIO = 10 * 1024 * 1024
const MAX_TEXTO = 500
const TIMEOUT_MS = 15000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  // Solo admin u operador del POS.
  const authHeader = req.headers.get('Authorization') ?? ''
  const usuario = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const [adm, pos] = await Promise.all([usuario.rpc('is_admin'), usuario.rpc('is_pos_operator')])
  if (adm.data !== true && pos.data !== true) return json({ error: 'No autorizado' }, 401)

  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!groqKey) return json({ error: 'Voz no configurada' }, 500)

  // Entrada: audio (multipart) o texto (JSON).
  let audio: File | null = null
  let transcripcion = ''
  try {
    const tipo = req.headers.get('content-type') ?? ''
    if (tipo.includes('multipart/form-data')) {
      const form = await req.formData()
      const f = form.get('audio')
      if (f instanceof File) audio = f
      if (!audio) return json({ error: 'Falta el audio' }, 400)
      if (audio.size > MAX_AUDIO) return json({ error: 'Audio demasiado largo' }, 413)
    } else {
      const body = await req.json()
      transcripcion = typeof body?.texto === 'string' ? body.texto.trim().slice(0, MAX_TEXTO) : ''
      if (!transcripcion) return json({ error: 'Falta el texto' }, 400)
    }
  } catch {
    return json({ error: 'Solicitud inválida' }, 400)
  }

  // Catálogo activo, el mismo que muestra el POS.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: productos, error: errP } = await admin
    .from('productos_evento')
    .select('id, nombre, categoria, precio, stock_actual')
    .eq('activo', true)
  if (errP) return json({ error: 'No se pudo leer el catálogo' }, 500)
  const ids = (productos ?? []).map((p) => p.id)
  const { data: variantes, error: errV } = ids.length
    ? await admin
      .from('producto_variantes')
      .select('id, producto_id, opciones, precio, stock_actual')
      .in('producto_id', ids)
      .eq('activo', true)
    : { data: [], error: null }
  if (errV) return json({ error: 'No se pudo leer el catálogo' }, 500)
  const catalogo = { productos: productos ?? [], variantes: variantes ?? [] }

  try {
    if (audio) {
      const fd = new FormData()
      fd.append('file', audio, audio.name || 'venta.webm')
      fd.append('model', 'whisper-large-v3-turbo')
      fd.append('language', 'es')
      fd.append('temperature', '0')
      fd.append('response_format', 'json')
      // Pista de vocabulario: nombres de productos (Whisper usa ~224 tokens).
      fd.append('prompt', ('Venta en pesos colombianos. ' + catalogo.productos.map((p) => p.nombre).join(', ')).slice(0, 800))
      const r = await fetch(`${GROQ}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body: fd,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!r.ok) {
        console.error('whisper', r.status, await r.text())
        return json({ error: 'No se pudo transcribir' }, 502)
      }
      transcripcion = String((await r.json())?.text ?? '').trim()
      if (!transcripcion) return json({ error: 'No se entendió el audio' }, 422)
    }

    const modelo = await interpretar({
      groqKey, modelo: Deno.env.get('GROQ_MODEL'), respaldo: Deno.env.get('GROQ_MODEL_RESPALDO'), catalogo, transcripcion, timeoutMs: TIMEOUT_MS,
    })
    const { lineas, dudas } = validarPropuesta(modelo, catalogo, transcripcion)
    const metodo = METODOS.includes(modelo.metodo_pago) ? modelo.metodo_pago : null
    const total = Number.isInteger(modelo.total_dictado) && modelo.total_dictado > 0 ? modelo.total_dictado : null
    const obs = typeof modelo.observacion === 'string' && modelo.observacion.trim()
      ? modelo.observacion.trim().slice(0, 280)
      : null

    return json({ transcripcion, lineas, dudas, metodo_pago: metodo, total_dictado: total, observacion: obs })
  } catch (e) {
    console.error('pos-voz', e)
    const timeout = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')
    return json({ error: timeout ? 'Groq tardó demasiado' : 'No se pudo procesar', transcripcion }, 502)
  }
})
