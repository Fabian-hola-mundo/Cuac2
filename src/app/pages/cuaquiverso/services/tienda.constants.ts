// Reglas comerciales que se anuncian en varias pantallas de la tienda.
//
// El umbral de envío gratis estaba escrito a mano en el hero de la tienda, en
// el checkout y otra vez como literal en la confirmación: tres sitios que se
// desincronizan solos. La copia autoritativa para el pedido vive en el
// servidor (`supabase/functions/_shared/tienda.ts`), que es quien decide y
// guarda `pedidos.envio_gratis`; este valor sólo sirve para anunciarlo.
export const ENVIO_GRATIS_DESDE = 150_000;

/** "$150k" — cómo se anuncia el umbral en textos cortos. */
export const ENVIO_GRATIS_CORTO = `$${ENVIO_GRATIS_DESDE / 1000}k`;

/** Desde cuántas unidades restantes se avisa "quedan pocas". */
export const UMBRAL_POCAS_UNIDADES = 5;
