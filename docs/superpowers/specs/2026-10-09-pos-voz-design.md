# POS: venta por voz — Diseño

Fecha: 2026-10-09 · Estado: aprobado en conversación, pendiente de revisión escrita
Depende de: `2026-10-08-pos-carrito-pagos-design.md` (rama `feat/pos-carrito`).

## Objetivo

Registrar una venta del evento activo (hoy **SOFA 2026**) hablándole al celular (S25 Ultra): «ayúdame a registrar la venta de dos tote bags por 80 mil pesos». Groq transcribe e interpreta; el POS muestra la venta propuesta, resuelve lo ambiguo con botones y la registra **solo cuando el usuario confirma**, por el mismo camino que una venta del catálogo.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Acceso | Ícono propio en la pantalla de inicio (shortcut del PWA → `/pos/?voz=1`) **y** botón 🎙 dentro del POS. |
| Confirmación | Siempre. Nunca se registra sin el toque del usuario. |
| Dónde vive | Dentro del POS: la voz llena el carrito y abre la hoja de cobro existente. Sin segunda app. |
| Procesamiento | Edge Function `pos-voz` (clave de Groq en el servidor). No registra ventas. |
| Transcripción | Groq `whisper-large-v3-turbo`, `language: es`. |
| Interpretación | Modelo de chat de Groq con salida JSON estricta (`response_format: json_schema`); ids de producto y combinación restringidos al catálogo activo. Modelo configurable con `GROQ_MODEL` (por defecto `openai/gpt-oss-120b`). |
| Ambigüedad | Se devuelve como «duda» con opciones; el POS pide elegir con botones. |
| Medio de pago | Si se dijo, queda preseleccionado en la hoja de cobro; si no, se elige ahí (sigue obligatorio). |
| Precio dictado distinto | Aviso con las dos cifras y opción de usar el dictado: reparto proporcional exacto + observación automática. |
| Sin internet | La voz no está disponible; el resto del POS sigue igual. |
| Base de datos | Sin migraciones. Se usa `registrar_transaccion_pos` tal cual. |

## Fuera de alcance

- Widget Android nativo (app Kotlin).
- Registro automático sin confirmar.
- Voz sin internet (transcripción local).
- Comandos que no sean ventas (consultar stock, anular, etc.).
- Guardar el audio.

## 1. Acceso

- `public/pos/manifest.json`: entrada en `shortcuts` → `{ name: "Venta por voz", short_name: "Voz", url: "/pos/?voz=1", icons: [...] }`. En Android, al mantener presionado el ícono del POS aparece el atajo y se puede arrastrar a la pantalla de inicio como ícono propio.
- Al arrancar, si la URL trae `voz=1` y hay sesión y catálogo cargado, el POS abre la hoja de voz y empieza a grabar. Luego limpia el parámetro con `history.replaceState` para que recargar no vuelva a grabar.
- Botón 🎙 fijo junto al buscador del catálogo.
- `sw.js` no cambia: sin red, toda navegación ya cae a `caches.match('/pos/')`, así que `/pos/?voz=1` abre el POS cacheado (y la voz muestra «Sin conexión»).

## 2. Hoja de voz

**Carga diferida.** Toda la hoja de voz (DOM, estilos, grabación y llamada a la función) vive en `public/pos/voz.js`, que importa `voz-logic.js`. `index.html` la carga con `import('./voz.js')` solo al tocar 🎙 o al abrir con `?voz=1`. Así el POS sin internet nunca depende de esos archivos: no van en el `SHELL` de `sw.js` y la caché sigue en `pos-v4`. `index.html` le pasa un puente: `abrirVoz(puente, { grabar })` con `puente = { sb, supabaseUrl, supabaseKey, catalogo(): { productos, variantesPorProducto }, agregar(lineas, { metodoPago, observacion }): Promise<boolean>, toast(msg, tipo) }`. El catálogo se pide con una función para leer siempre el más reciente; el evento no viaja: lo pone la hoja de cobro al registrar.

Estados: `grabando` → `procesando` → `propuesta` (o `error`).

- **Grabar:** `MediaRecorder` (`audio/webm;codecs=opus`, o el que soporte el navegador). Un toque para empezar, otro para terminar; tope de 60 s con corte automático. Indicador de tiempo y nivel.
- **Texto:** campo «o escríbelo» (sirve el dictado del teclado). Enviar texto salta la transcripción.
- **Procesando:** spinner y «Entendiendo…». Tiempo límite de 20 s en el cliente.
- **Propuesta:**
  - Transcripción arriba, en gris (se puede tocar para editarla y reenviar como texto).
  - Líneas resueltas: foto, nombre, combinación, `− cantidad +`, precio unitario, subtotal, aviso si supera el stock.
  - Dudas: el texto de la duda («¿Cuáles tote bags? Faltan 2») y un botón por opción con `− N +`. La duda queda resuelta cuando la suma llega a la cantidad pedida. Una opción con combinaciones pide elegir la combinación (botones con stock, igual que la hoja de combinación del POS).
  - Medio de pago detectado, si lo hay (chip).
  - Si hay `total_dictado` y no coincide con el total de catálogo de las líneas resueltas: aviso «Dijiste $70.000 · catálogo $80.000» con dos botones, «Usar $70.000» y «Usar catálogo» (por defecto, catálogo).
  - Botón principal «Agregar al carrito», deshabilitado mientras haya dudas sin resolver o no haya líneas.
- **Agregar al carrito:** si el carrito ya tenía productos, las líneas se suman (no lo reemplazan). Luego se cierra la hoja de voz y se abre la hoja de cobro con el medio de pago preseleccionado y la observación prellenada. Desde ahí, todo es el flujo normal del POS.
- Cerrar la hoja de voz descarta la propuesta, no el carrito.

## 3. Lógica pura — `public/pos/voz-logic.js`

Junto a `pos-logic.js`, con pruebas en `src/app/pos/voz-logic.spec.ts`.

- `repartirPrecio(lineas, totalDictado)` → líneas nuevas cuyo `Σ cantidad × precio_unitario === totalDictado` exacto. Reparto proporcional al subtotal de catálogo; se redondea hacia abajo por unidad y el residuo se pone en una línea extra de 1 unidad (separada de su línea original) del último producto. Si todas las líneas tienen precio 0, reparte en partes iguales. Si `totalDictado <= 0` lanza error.
- `propuestaACarrito(propuesta, elecciones, productos, variantesPorProducto)` → líneas del carrito con la misma forma de `agregarAlCarrito` (`clave, producto_id, variante_id, nombre, etiqueta_variante, cantidad, precio_unitario, stock_max`). Ignora ids que no estén en el catálogo local y lo informa.
- `fusionarCarrito(carrito, nuevas)` → suma cantidades por `clave` (con tope en `stock_max`); las líneas con precio dictado usan una clave propia (`<producto_id>|<variante_id ?? ''>|v<n>`) para no mezclarse con la línea a precio de catálogo del mismo producto. `pos-logic.js` no cambia: `restaurarCarrito` y `cambiarCantidad` ya conservan la clave y el `precio_unitario` de cada línea (verificado en `feat/pos-carrito`).

**Integración en `index.html`** (API confirmada con la sesión que implementa `feat/pos-carrito`): asignar `carrito = fusionarCarrito(...)` → `cambioCarrito()` → `window.abrirCobro()` → asignar `metodoPago` y llamar `renderCobro()` → poner la observación en `#cobro-note`, quitarle `hidden` y ocultar `#cobro-note-toggle`. No se hace nada mientras `registrando` sea true.
- `dudasPendientes(propuesta, elecciones)` → número de dudas sin resolver.
- `observacionPrecio(totalDictado, totalCatalogo)` → `"Precio dictado $70.000 (catálogo $80.000)"`.

La observación final es `[observacion de la propuesta, observacionPrecio]` unida con ` · ` y cortada a 280.

## 4. Edge Function — `supabase/functions/pos-voz/index.ts`

**Entrada:** `POST` con `Authorization: Bearer <jwt de la sesión del POS>`.
- `multipart/form-data` con `audio` (≤ 10 MB) y `evento_id`, **o**
- JSON `{ texto, evento_id }` (texto ≤ 500 caracteres).

**Pasos:**
1. CORS igual que las demás funciones.
2. Autoriza con un cliente con el JWT del usuario: `rpc('is_admin')` o `rpc('is_pos_operator')`; si ninguno, 401.
3. Si hay audio: `POST https://api.groq.com/openai/v1/audio/transcriptions` (`whisper-large-v3-turbo`, `language=es`, `prompt` con los nombres de productos para mejorar la transcripción). Transcripción vacía → 422 `{ error: 'No se entendió el audio' }`.
4. Lee el catálogo activo con service role: `productos_evento` activos (`id, nombre, categoria, precio, stock_actual`) y sus `producto_variantes` activas (`id, producto_id, opciones, precio, stock_actual`).
5. Llama a `POST https://api.groq.com/openai/v1/chat/completions` con `temperature: 0`, el catálogo compacto en el mensaje de sistema y `response_format: { type: 'json_schema', json_schema: { strict: true, schema } }`. El esquema restringe `producto_id` y `variante_id` a `enum` de ids reales.
6. **Valida en el servidor** la respuesta del modelo:
   - Cada `producto_id` existe y está activo; cada `variante_id` pertenece a su producto. Si no, la línea pasa a duda o se descarta.
   - **Evidencia obligatoria (anti-adivinanza).** El esquema exige en cada línea un campo `fragmento`: las palabras exactas de la transcripción que identifican ese producto. El servidor normaliza (`NFD`, sin tildes, minúsculas) y comprueba que el fragmento aparezca en la transcripción **y** contenga al menos una palabra distintiva del nombre del producto: las palabras del nombre que no aparecen en los nombres de los demás productos de su categoría ni en el nombre de la categoría (para «Totebag Orquídeas» es «orquideas»; «orquidea» también cuenta, porque se compara por raíz de ≥ 5 letras o por la palabra completa). Si no la contiene y la categoría tiene más de un producto activo, la línea se convierte en duda con todos los productos activos de esa categoría como opciones y la misma cantidad. Medido el 2026-10-09: con «dos tote bags por 80 mil», `gpt-oss-120b` devolvió por su cuenta «2 × Totebag Orquídeas»; esta regla es la que lo impide.
   - Un producto con combinaciones activas y sin `variante_id` pasa a duda con sus combinaciones como opciones. Lo mismo vale para una `variante_id` sin evidencia en el fragmento (ninguno de los valores de `opciones` de la combinación aparece en la transcripción).
   - Se pide el modelo con `reasoning_effort: "low"` y se ignora el campo `reasoning` de la respuesta.
   - `cantidad` entera ≥ 1; `metodo_pago` ∈ `qr | datafono | efectivo | null`; `total_dictado` entero ≥ 0 o null.
7. Responde 200:

```json
{
  "transcripcion": "ayúdame a registrar la venta de dos tote bags por 80 mil pesos",
  "lineas": [{ "producto_id": "…", "variante_id": null, "cantidad": 1 }],
  "dudas": [{
    "texto": "¿Cuáles tote bags?",
    "cantidad": 2,
    "opciones": [{ "producto_id": "…", "variante_id": null }]
  }],
  "metodo_pago": null,
  "total_dictado": 80000,
  "observacion": null
}
```

**Reglas del prompt:** entender pesos colombianos coloquiales («80 mil», «ochenta lucas», «80k»); «tote», «totebag» y «tote bag» son la categoría `tote`; si la frase nombra una categoría o un producto sin precisar cuál y hay varios, va a `dudas` con todas las opciones de esa categoría; nunca inventar productos; el medio de pago solo se llena si se dice («efectivo», «QR», «Nequi»/«Bancolombia» → `qr`, «tarjeta»/«datáfono» → `datafono`).

**Secretos:** `GROQ_API_KEY` (obligatorio), `GROQ_MODEL` (opcional). Sin clave → 500 `{ error: 'Voz no configurada' }`.

**Despliegue:** `verify_jwt` activo (la función valida además el rol).

## 5. Evento y registro

Sin cambios: las líneas llegan al carrito y la hoja de cobro llama a `registrar_transaccion_pos` con el `evento_id` activo (`SOFA 2026`), descuento atómico de stock, cola sin internet y sincronización Realtime con las demás cajas y el cuadre del admin.

## 6. Errores

| Caso | Comportamiento |
|---|---|
| Sin internet | El botón 🎙 se muestra deshabilitado con «Sin conexión»; `?voz=1` abre el catálogo con ese toast. |
| Permiso de micrófono negado | Mensaje con cómo activarlo y el campo de texto disponible. |
| Audio vacío o no se entendió | Se muestra la transcripción (si la hay) y «Repetir» / editar texto. |
| Groq falla o tarda más de 20 s | «No se pudo procesar. Reintentar» (reenvía el mismo audio). |
| Sesión vencida (401) | Mensaje y vuelta al login, como el resto del POS. |
| Producto propuesto ya no está en el catálogo local | Se omite con aviso en la propuesta. |
| Cantidad mayor que el stock | Se limita a `stock_max` con aviso en la línea, igual que el carrito. |
| Precio dictado ≤ 0 o sin líneas | No se ofrece «Usar precio dictado». |

## 7. Pruebas

- **Unitarias** (`src/app/pos/voz-logic.spec.ts`): `repartirPrecio` (exacto, con residuo, precio 0, una línea con cantidad 3 y total no divisible), `propuestaACarrito` (ids desconocidos, variantes, topes de stock), `fusionarCarrito` (claves con precio dictado), `dudasPendientes`, `observacionPrecio`.
- **Función** (con la clave real, contra el catálogo de producción, sin registrar nada):
  - «dos tote bags por 80 mil» → duda de 3 totes, cantidad 2, `total_dictado` 80000.
  - «una totebag orquídeas en efectivo» → 1 línea, `metodo_pago` efectivo.
  - «dos totes por 70 mil» → `total_dictado` 70000.
  - Producto inexistente → sin líneas inventadas.
  - La regla de evidencia, aislada en `supabase/functions/pos-voz/evidencia.js` (+ `.d.ts`, mismo patrón que `pos-logic.js`) con pruebas de Vitest en `src/app/pos/evidencia.spec.ts`: «dos tote bags» → duda; «una orquídea» → línea; producto único en su categoría sin nombre exacto → línea; combinación sin valor dicho → duda.
  - Sin sesión → 401.
- **Manual en el S25 Ultra:** instalar el PWA, arrastrar el atajo «Venta por voz» a inicio, abrirlo, conceder micrófono, dictar la frase del ejemplo, resolver la duda, registrar en QR y ver la venta en otro POS y en el cuadre de SOFA 2026. Después, anular esa venta de prueba desde el admin.

## 8. Hallazgos de la implementación (2026-10-09)

- **Ambigüedad entre categorías:** «Orquídeas» existe como Totebag, Banda y Pañoleta, y hay dos «Libretas ÚLTIMAS UNIDADES». La regla de evidencia compara el fragmento contra **todo** el catálogo (nombre + categoría, números en letras = dígitos, prefijo común ≥ 5 letras) y solo acepta un producto si gana sin empate; si no, duda con los empatados. Las dudas del modelo se completan con lo que empata con su `fragmento` (el modelo llegó a omitir la Totebag Orquídeas).
- **Tokens:** el plan gratuito de Groq permite 8.000 tokens/minuto por modelo. Con UUIDs cada consulta gastaba ~6.900; con alias cortos (`p1`, `v1`, traducidos en el servidor) gasta ~2.300 (≈ 3 ventas/minuto por modelo). Ante 429 o JSON fuera del esquema (400) se reintenta con `GROQ_MODEL_RESPALDO` (por defecto `openai/gpt-oss-20b`), lo que da ≈ 6 ventas/minuto. Para más, subir la cuenta de Groq a Dev Tier.
- **Duda sin campo `texto`:** el modelo lo omitió una vez y Groq rechazó la respuesta; el esquema ya no lo pide y el servidor lo arma con el fragmento.
- **Lógica del modelo** en `supabase/functions/pos-voz/interpretar.js` (JS plano), para probar frases reales desde Node sin desplegar.
- Banco de 9 frases reales contra el catálogo de producción: todas correctas, ~1,1 s cada una.

## 9. Puesta en marcha (2026-10-09)

- **Clave de Groq en Supabase Vault** (`groq_api_key`). La migración `039_pos_voz_secreto.sql` crea `public.secreto_pos_voz(text)`, que solo `service_role` puede ejecutar y que solo entrega nombres permitidos. La función usa primero `GROQ_API_KEY` del entorno y, si no existe, la de Vault. Para rotar la clave: `select vault.update_secret((select id from vault.secrets where name = 'groq_api_key'), '<nueva>');`. La instancia la recuerda hasta que se recicla, así que conviene redesplegar `pos-voz` después de rotarla.
- **Fragmento flexible:** el modelo a veces devuelve el nombre del catálogo («Totebag Orquídeas») o separa «tote bag». El fragmento cuenta como dicho si cada palabra se parece a una de la frase (prefijo ≥ 5) o, pegada a su vecina, coincide exactamente con una palabra dicha.
- **Verificado en producción** (función v4, con la sesión real del POS): texto → respuestas correctas; sin sesión → 401; audio sintetizado en español → Whisper ~1 s, total ~2 s, duda correcta entre las 3 totes con efectivo y $80.000.
