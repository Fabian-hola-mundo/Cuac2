// supabase/functions/_shared/tienda.ts
// Reglas comerciales de la tienda que el servidor tiene que conocer.
//
// El umbral de envío gratis se anuncia en el hero de la tienda, en el checkout
// y en la confirmación. Vivía hardcodeado en tres sitios del front y en ninguno
// del backend, así que la promesa no quedaba registrada en el pedido: quien
// empacaba no tenía forma de saber que ese envío iba prepagado.
//
// Ahora el servidor decide y lo guarda en `pedidos.envio_gratis`. El front tiene
// su propia copia del número en `src/app/pages/cuaquiverso/services/tienda.constants.ts`
// (un edge function no puede importar del bundle de Angular): si cambia uno,
// cambia el otro.
export const ENVIO_GRATIS_DESDE = 150_000
