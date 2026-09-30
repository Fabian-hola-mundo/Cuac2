// supabase/functions/notify-pedido/index.ts
//
// Envía un correo al equipo cada vez que un pedido pasa a 'aprobado'. Lo dispara
// el trigger `trigger_notify_pedido` sobre la tabla `pedidos` (ver migración
// 019), así que llega el aviso sin importar quién confirmó el pago: el respaldo
// `verificar-pago`, el webhook de Bold o una conciliación a mano.
//
// Destinatarios: NOTIFY_PEDIDO_EMAILS (coma-separado) o, por omisión,
// designcuac@gmail.com. Envía con Resend (RESEND_API_KEY), como las demás.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.1'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
// Por omisión, el correo del dueño de la cuenta Resend: es el único al que
// Resend entrega mientras cuacdesign.com no esté verificado. Una vez verificado
// el dominio, poner NOTIFY_PEDIDO_EMAILS con los destinatarios definitivos.
const DESTINOS = (Deno.env.get('NOTIFY_PEDIDO_EMAILS') ?? 'pedidocuac@gmail.com')
  .split(',').map(s => s.trim()).filter(Boolean)
// Remitente. Por omisión el de Resend, que no exige dominio verificado (pero
// sólo entrega al dueño de la cuenta). Cuando cuacdesign.com esté verificado en
// Resend, poner NOTIFY_FROM='Cuaquiverso <noreply@cuacdesign.com>'.
const FROM = Deno.env.get('NOTIFY_FROM') ?? 'Cuaquiverso <noreply@cuacdesign.com>'

function esc(v: unknown): string {
  return String(v ?? '—')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
const fmt = (n: unknown) => '$' + Number(n ?? 0).toLocaleString('es-CO')

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const p = payload?.record ?? payload
    if (!p?.id) {
      return new Response(JSON.stringify({ ok: false, error: 'Falta el pedido' }), { status: 400 })
    }

    // Traemos los ítems con el service_role (el trigger sólo manda la fila pedidos).
    let items: any[] = []
    const supaUrl = Deno.env.get('SUPABASE_URL')
    const svc     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supaUrl && svc) {
      const supabase = createClient(supaUrl, svc)
      const { data } = await supabase
        .from('pedido_items')
        .select('nombre, sub, precio, cantidad, color, variante_label')
        .eq('pedido_id', p.id)
      items = data ?? []
      // El trigger manda la fila ANTES de que registrar_venta_web marque
      // `sobreventa`, así que se relee el flag aquí.
      const { data: fresco } = await supabase.from('pedidos').select('sobreventa').eq('id', p.id).maybeSingle()
      if (fresco) p.sobreventa = fresco.sobreventa
    }

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY no configurada — correo omitido')
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    FROM,
        to:      DESTINOS,
        subject: `🎉 Compra confirmada — ${p.referencia} · ${fmt(p.total)}`,
        html:    buildHtml(p, items),
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Resend error:', body)
      return new Response(JSON.stringify({ ok: false, error: body }), { status: 500 })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 })
  }
})

function buildHtml(p: any, items: any[]): string {
  const fecha = (() => {
    try {
      return new Date(p.creado_en).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
    } catch { return '—' }
  })()

  const filas = (items ?? []).map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#151F28">
        ${esc(i.nombre)}${i.sub ? ` · <span style="color:#6b7280">${esc(i.sub)}</span>` : ''}${i.variante_label ? ` · <strong>${esc(i.variante_label)}</strong>` : ''}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center;color:#151F28">${esc(i.cantidad)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:right;color:#151F28">${fmt((Number(i.precio) || 0) * (Number(i.cantidad) || 0))}</td>
    </tr>`).join('')

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;width:130px">${label}</td><td style="padding:4px 0;font-size:13px;color:#151F28">${value}</td></tr>`

  const descuento = Number(p.descuento_monto) > 0
    ? `<tr><td style="padding:4px 12px;color:#1F8A5B;font-size:14px">Descuento${p.codigo_descuento ? ` (${esc(p.codigo_descuento)})` : ''}</td><td style="padding:4px 12px;text-align:right;color:#1F8A5B;font-size:14px">−${fmt(p.descuento_monto)}</td></tr>`
    : ''

  const avisoSobreventa = p.sobreventa
    ? `<div style="background:#FDECEA;color:#9B1C1C;padding:12px 16px;border-radius:8px;margin:0 0 16px;font-size:14px">⚠ Sobreventa: al aprobarse este pago ya no había stock suficiente de algún producto. Revisa el inventario antes de despachar.</div>`
    : ''

  return `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f5f5f0;padding:24px">
    <div style="background:#151F28;padding:22px 24px;border-radius:12px 12px 0 0">
      <div style="color:#fff;font-size:13px;letter-spacing:.08em;text-transform:uppercase">Cuaquiverso · Tienda</div>
      <h1 style="color:#fff;font-size:22px;margin:6px 0 0">🎉 Nueva compra confirmada</h1>
    </div>
    <div style="background:#fff;padding:22px 24px;border-radius:0 0 12px 12px">
      ${avisoSobreventa}
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
        ${row('Pedido', `<strong>${esc(p.referencia)}</strong>`)}
        ${row('Fecha', esc(fecha))}
        ${row('Pago Bold', esc(p.bold_payment_id))}
      </table>

      <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;margin:0 0 6px">Productos</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:6px">
        ${filas || `<tr><td style="padding:8px 12px;color:#6b7280;font-size:14px">Sin ítems registrados</td></tr>`}
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr><td style="padding:4px 12px;color:#6b7280;font-size:14px">Subtotal</td><td style="padding:4px 12px;text-align:right;font-size:14px;color:#151F28">${fmt(p.subtotal)}</td></tr>
        ${descuento}
        <tr><td style="padding:8px 12px;font-size:16px;font-weight:700;color:#151F28;border-top:1px solid #eee">Total pagado</td><td style="padding:8px 12px;text-align:right;font-size:16px;font-weight:700;color:#151F28;border-top:1px solid #eee">${fmt(p.total)}</td></tr>
      </table>

      <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;margin:0 0 6px">Cliente y envío</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        ${row('Nombre', esc(`${p.nombre ?? ''} ${p.apellido ?? ''}`.trim()))}
        ${row('Correo', `<a href="mailto:${esc(p.email)}" style="color:#EC3813">${esc(p.email)}</a>`)}
        ${row('Celular', esc(p.celular))}
        ${row('Documento', esc(`${p.tipo_doc ?? ''} ${p.num_doc ?? ''}`.trim()))}
        ${row('Dirección', esc([p.direccion, p.barrio, p.ciudad, p.departamento].filter(Boolean).join(', ')))}
        ${p.codigo_postal ? row('Cód. postal', esc(p.codigo_postal)) : ''}
        ${p.nota ? row('Nota', esc(p.nota)) : ''}
      </table>

      <a href="https://cuacdesign.com/admin/pedidos" style="display:inline-block;background:#EC3813;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600">Ver en el panel</a>
    </div>
    <p style="color:#aaa;font-size:12px;text-align:center;margin:16px 0 0">Aviso automático de Cuaquiverso · se envía al confirmarse el pago.</p>
  </div>`
}
