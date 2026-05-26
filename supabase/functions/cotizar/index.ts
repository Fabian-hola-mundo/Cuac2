// supabase/functions/cotizar/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isStr(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0 }

function esc(val: unknown): string {
  return String(val ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const body = await req.json()
    const { nombre, email, empresa, servicios, descripcion } = body

    if (
      !isStr(nombre) || !isStr(email) || !isStr(empresa) || !isStr(descripcion) ||
      !EMAIL_RE.test(email) ||
      !Array.isArray(servicios) || servicios.length === 0 ||
      !servicios.every((s: unknown) => typeof s === 'string')
    ) {
      return json({ ok: false, error: 'Faltan campos requeridos o formato inválido' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await supabase
      .from('cotizaciones')
      .insert([{
        nombre,
        email,
        empresa,
        telefono:           body.telefono           ?? null,
        servicios,
        descripcion,
        presupuesto:        body.presupuesto        ?? null,
        timeline:           body.timeline           ?? null,
        estimador_servicio: body.estimador_servicio ?? null,
        estimador_escala:   body.estimador_escala   ?? null,
        estimador_rango:    body.estimador_rango    ?? null,
      }])
      .select('id')
      .single()

    if (error) throw error

    // Fire-and-forget — email failure must not block the response
    if (Deno.env.get('RESEND_API_KEY')) {
      sendEmail({
        to:      'hola@cuacdesign.com',
        subject: `Nueva cotización de ${empresa} — ${(servicios as string[]).join(', ')}`,
        html:    buildHtml(body),
      }).catch(err => console.error('Resend error (non-fatal):', err))
    } else {
      console.warn('RESEND_API_KEY not set — email skipped')
    }

    return json({ ok: true, id: data.id })

  } catch (err) {
    console.error(err)
    return json({ ok: false, error: 'Error interno del servidor' }, 500)
  }
})

async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Cuac Design <cotizador@cuacdesign.com>',
      to:   opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
}

function buildHtml(b: Record<string, unknown>): string {
  const row = (label: string, value: unknown) =>
    `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px">${label}</td><td style="padding:6px 12px;font-size:13px">${esc(value)}</td></tr>`

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#151F28;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:white;font-size:20px;margin:0">Nueva cotización</h1>
        <p style="color:#9ca3af;font-size:13px;margin:4px 0 0">Cuac Design · cotizador</p>
      </div>
      <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb">
        ${row('Nombre', b['nombre'])}
        ${row('Email', b['email'])}
        ${row('Empresa', b['empresa'])}
        ${row('Teléfono', b['telefono'])}
        ${row('Servicios', Array.isArray(b['servicios']) ? (b['servicios'] as string[]).join(', ') : b['servicios'])}
        ${row('Descripción', b['descripcion'])}
        ${row('Presupuesto', b['presupuesto'])}
        ${row('Timeline', b['timeline'])}
        ${row('Estimador — Servicio', b['estimador_servicio'])}
        ${row('Estimador — Escala', b['estimador_escala'])}
        ${row('Estimador — Rango', b['estimador_rango'])}
      </table>
      <div style="background:#f3f4f6;padding:12px 24px;border-radius:0 0 8px 8px;font-size:12px;color:#9ca3af">
        Responde en menos de 2 días hábiles · hola@cuacdesign.com
      </div>
    </div>
  `
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
