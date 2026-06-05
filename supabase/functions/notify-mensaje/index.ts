// supabase/functions/notify-mensaje/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const TO_EMAIL       = 'designcuac@gmail.com';

const TIPO_LABEL: Record<string, string> = {
  comentario: '💬 Comentario',
  producto:   '🛍 Sugerencia de producto',
  duda:       '❓ Duda',
  pedido:     '📦 Problema con pedido',
};

serve(async (req) => {
  try {
    const payload = await req.json();
    const { tipo, mensaje, correo, created_at } = payload.record as {
      tipo: string;
      mensaje: string;
      correo: string | null;
      created_at: string;
    };

    const tipoLabel   = TIPO_LABEL[tipo] ?? tipo;
    const correoHtml  = correo
      ? `<p><strong>Correo:</strong> <a href="mailto:${correo}">${correo}</a></p>`
      : `<p><strong>Correo:</strong> sin correo</p>`;
    const fechaStr = new Date(created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' });

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#EC3813;margin-bottom:4px;">Nuevo mensaje en Cuaquiverso</h2>
        <p style="color:#888;font-size:13px;margin-bottom:24px;">${fechaStr} (Bogotá)</p>
        <p><strong>Tipo:</strong> ${tipoLabel}</p>
        ${correoHtml}
        <div style="background:#f5f5f0;border-radius:8px;padding:16px;margin-top:16px;">
          <p style="margin:0;white-space:pre-wrap;font-size:15px;color:#151F28;">${mensaje}</p>
        </div>
        <hr style="margin-top:32px;border:none;border-top:1px solid #eee;" />
        <p style="color:#aaa;font-size:12px;">
          Ver todos los mensajes en el
          <a href="https://cuacdesign.com/admin/mensajes" style="color:#EC3813;">panel de admin</a>.
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'Cuaquiverso <noreply@cuacdesign.com>',
        to:      [TO_EMAIL],
        subject: `[Cuaquiverso] ${tipoLabel} — nuevo mensaje`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return new Response(JSON.stringify({ ok: false, error: body }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});
