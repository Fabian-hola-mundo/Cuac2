// Interpretación de la frase con un modelo de Groq en JSON estricto.
// JS plano para que lo usen Deno (función) y Node (pruebas con frases reales).
// Los ids viajan como alias cortos (p1, v1) para gastar pocos tokens: el plan
// gratuito de Groq limita los tokens por minuto.

export const METODOS = ['qr', 'datafono', 'efectivo'];
export const MODELO = 'openai/gpt-oss-120b';
export const MODELO_RESPALDO = 'openai/gpt-oss-20b';

export function alias(catalogo) {
  const prod = new Map(catalogo.productos.map((p, i) => [`p${i + 1}`, p.id]));
  const vari = new Map(catalogo.variantes.map((v, i) => [`v${i + 1}`, v.id]));
  const prodInv = new Map([...prod].map(([a, id]) => [id, a]));
  const variInv = new Map([...vari].map(([a, id]) => [id, a]));
  return { prod, vari, prodInv, variInv };
}

export function esquemaVenta(al) {
  const opcion = {
    producto_id: { type: 'string', enum: [...al.prod.keys()] },
    variante_id: { type: ['string', 'null'], enum: [...al.vari.keys(), null] },
  };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['lineas', 'dudas', 'metodo_pago', 'total_dictado', 'observacion'],
    properties: {
      lineas: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['producto_id', 'variante_id', 'cantidad', 'fragmento'],
          properties: { ...opcion, cantidad: { type: 'integer' }, fragmento: { type: 'string' } },
        },
      },
      dudas: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['cantidad', 'fragmento', 'opciones'],
          properties: {
            cantidad: { type: 'integer' },
            fragmento: { type: 'string' },
            opciones: {
              type: 'array',
              items: { type: 'object', additionalProperties: false, required: ['producto_id', 'variante_id'], properties: opcion },
            },
          },
        },
      },
      metodo_pago: { type: ['string', 'null'], enum: [...METODOS, null] },
      total_dictado: { type: ['integer', 'null'] },
      observacion: { type: ['string', 'null'] },
    },
  };
}

export function promptSistema(catalogo, al) {
  const lista = catalogo.productos.map(p => {
    const vs = catalogo.variantes
      .filter(v => v.producto_id === p.id)
      .map(v => `${al.variInv.get(v.id)} ${Object.values(v.opciones ?? {}).join(' ')}${v.precio && v.precio !== p.precio ? ` $${v.precio}` : ''}`)
      .join('; ');
    return `${al.prodInv.get(p.id)}|${p.nombre}|${p.categoria}|$${p.precio}${vs ? `|variantes: ${vs}` : ''}`;
  }).join('\n');

  return `Asistente del punto de venta de Cuac Design en un evento. Convierte lo que dice el vendedor en una venta estructurada.

Catálogo (alias|nombre|categoría|precio COP|variantes):
${lista}

Reglas:
- Solo alias del catálogo. Nunca inventes productos.
- En "lineas" pon un producto SOLO si lo nombró sin ambigüedad. "fragmento": palabras EXACTAS de la frase, copiadas tal cual, que lo identifican (nombre propio y combinación si la dijo).
- Si dice algo genérico que encaja con varios productos ("dos tote bags", "una orquídea" habiendo varios Orquídeas, "una libreta"), NO elijas: va en "dudas" con TODAS las opciones posibles, la cantidad pedida y su "fragmento".
- Producto con variantes sin decir cuál: va en "dudas" con sus variantes como opciones.
- Pesos colombianos: "80 mil", "80k", "ochenta lucas" = 80000; "un palo" = 1000000. "total_dictado": total que dijo por toda la venta, o null.
- "metodo_pago": "efectivo"; "qr" si dice QR, Nequi, Daviplata, Bancolombia, transferencia o Bre-B; "datafono" si dice datáfono o tarjeta; si no lo dice, null.
- "observacion": solo notas extra útiles (p. ej. "cliente pidió factura"); si no hay, null.`;
}

function desaliasar(m, al) {
  const op = o => ({ ...o, producto_id: al.prod.get(o.producto_id) ?? o.producto_id, variante_id: o.variante_id ? (al.vari.get(o.variante_id) ?? o.variante_id) : null });
  return {
    ...m,
    lineas: (m.lineas ?? []).map(op),
    dudas: (m.dudas ?? []).map(d => ({ ...d, opciones: (d.opciones ?? []).map(op) })),
  };
}

async function llamar(groqKey, modelo, catalogo, al, transcripcion, timeoutMs) {
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo,
      temperature: 0,
      reasoning_effort: 'low',
      include_reasoning: false,
      messages: [
        { role: 'system', content: promptSistema(catalogo, al) },
        { role: 'user', content: transcripcion },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'venta', strict: true, schema: esquemaVenta(al) } },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

// Devuelve la propuesta cruda del modelo con ids reales, más el modelo usado
// y los tokens gastados. Si el modelo principal está saturado (429), usa el de respaldo.
export async function interpretar({ groqKey, modelo, respaldo, catalogo, transcripcion, timeoutMs = 15000 }) {
  const al = alias(catalogo);
  const modelos = [modelo || MODELO, respaldo || MODELO_RESPALDO];
  let r;
  let usado;
  for (const m of modelos) {
    usado = m;
    r = await llamar(groqKey, m, catalogo, al, transcripcion, timeoutMs);
    // 429: modelo saturado. 400: el modelo generó JSON fuera del esquema.
    if (r.status !== 429 && r.status !== 400) break;
    console.error('groq', r.status, 'en', m, r.status === 400 ? await r.clone().text() : '');
  }
  if (!r.ok) {
    console.error('groq chat', r.status, await r.text());
    throw new Error('Groq chat ' + r.status);
  }
  const body = await r.json();
  const contenido = body?.choices?.[0]?.message?.content ?? '{}';
  return { ...desaliasar(JSON.parse(contenido), al), _modelo: usado, _tokens: body?.usage?.total_tokens ?? null };
}
