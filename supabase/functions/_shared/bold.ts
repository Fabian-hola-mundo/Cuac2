// supabase/functions/_shared/bold.ts
//
// Piezas puras de la integración con Bold, compartidas por crear-pedido y
// bold-webhook. Sólo Web Crypto y btoa, así que corre igual en Deno y en las
// pruebas de vitest.

export const BOLD_CURRENCY = 'COP';

/** Estados de `pedidos` que produce cada evento de Bold. */
const ESTADO_POR_EVENTO: Record<string, string> = {
  SALE_APPROVED: 'aprobado',
  SALE_REJECTED: 'rechazado',
  VOID_APPROVED: 'cancelado',
  // VOID_REJECTED no cambia nada: la anulación falló, el pedido sigue como estaba.
};

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return hex(buf);
}

/**
 * base64 de los bytes UTF-8 del texto. `btoa` sólo acepta latin1 y el cuerpo
 * del webhook trae nombres de comprador, que llegan con tildes y eñes.
 */
export function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

/**
 * Hash de integridad del botón de pagos: SHA-256 de
 * `{orderId}{amount}{currency}{llaveSecreta}`.
 *
 * `amount` va en pesos sin decimales — a diferencia de Wompi, que cobraba en
 * centavos. Enviar centavos aquí cobraría cien veces de más.
 */
export async function firmaIntegridad(
  orderId: string,
  amount: number,
  currency: string,
  llaveSecreta: string,
): Promise<string> {
  if (!Number.isInteger(amount)) {
    throw new Error(`El monto para Bold debe ser un entero sin decimales: ${amount}`);
  }
  return sha256hex(`${orderId}${amount}${currency}${llaveSecreta}`);
}

/**
 * Firma esperada de un webhook: HMAC-SHA256 en hexadecimal, con la llave
 * secreta, sobre el cuerpo crudo codificado en base64.
 */
export async function firmaWebhook(cuerpoCrudo: string, llaveSecreta: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(llaveSecreta),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(base64Utf8(cuerpoCrudo)),
  );
  return hex(firma);
}

/** Comparación en tiempo constante, para no filtrar la firma por temporización. */
export function firmasIguales(recibida: string | null | undefined, esperada: string): boolean {
  if (!recibida || recibida.length !== esperada.length) return false;
  let diff = 0;
  for (let i = 0; i < esperada.length; i++) {
    diff |= recibida.charCodeAt(i) ^ esperada.charCodeAt(i);
  }
  return diff === 0;
}

/** Estado del pedido que corresponde a un evento de Bold, o null si no cambia. */
export function estadoDesdeEvento(tipo: string): string | null {
  return ESTADO_POR_EVENTO[tipo] ?? null;
}
