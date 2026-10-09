// src/app/pages/cuaquiverso/services/edge-error.ts

/** El `message` que pone supabase-js cuando la función responde algo que no es 2xx. */
const GENERICO = /non-2xx status code/i;

/**
 * Saca el mensaje real de un fallo de `functions.invoke`.
 *
 * supabase-js envuelve cualquier respuesta no-2xx en un `FunctionsHttpError`
 * cuyo `.message` es siempre la misma cadena en inglés: "Edge Function returned
 * a non-2xx status code". El texto que sí explica qué pasó y qué hacer —«"X" se
 * agotó mientras comprabas», «Sólo quedan 2 de "X"»— viaja en `.context`, que es
 * la `Response` cruda y hay que leerla a mano.
 *
 * Sin esto, todo el trabajo de mensajería de `crear-pedido` moría en el
 * servidor y el comprador veía la cadena de supabase-js en un banner rojo, sin
 * ninguna pista de qué corregir.
 */
export async function mensajeDeErrorEdge(error: unknown, respaldo: string): Promise<string> {
  const contexto = (error as { context?: unknown } | null)?.context;

  if (contexto instanceof Response) {
    try {
      // clone() porque el cuerpo sólo se puede leer una vez y quien llame
      // podría querer mirarlo también (p. ej. para distinguir por status).
      const cuerpo = await contexto.clone().json();
      const mensaje = (cuerpo as { error?: unknown } | null)?.error;
      if (typeof mensaje === 'string' && mensaje.trim()) return mensaje.trim();
    } catch {
      // El cuerpo no era JSON (un 502 del gateway, por ejemplo): queda el respaldo.
    }
  }

  const mensaje = (error as { message?: unknown } | null)?.message;
  if (typeof mensaje === 'string' && mensaje.trim() && !GENERICO.test(mensaje)) {
    return mensaje.trim();
  }

  return respaldo;
}
