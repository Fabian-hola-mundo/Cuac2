// Hoja de venta por voz del POS. Se carga con import() solo al usarla (no va en
// el SHELL de sw.js): sin internet no hace falta, porque Groq necesita red.
// Graba o recibe texto → función pos-voz → propuesta con dudas por resolver →
// líneas al carrito (puente.agregar). Nunca registra: eso lo hace la hoja de cobro.
import {
  propuestaACarrito, repartirPrecio, dudasPendientes, observacionPrecio, totalLineas,
} from './voz-logic.js?v=1'; // mismo ?v= que en index.html

const MAX_SEG = 60;
const TIMEOUT_MS = 20000;
const METODOS = { qr: 'QR', datafono: 'Datáfono', efectivo: 'Efectivo' };

let puente = null;
let raiz = null;
let estado = 'inicio';     // inicio | grabando | procesando | propuesta | error
let grabador = null;
let trozos = [];
let reloj = null;
let inicioGrab = 0;
let ultimoEnvio = null;    // para «Reintentar»
let propuesta = null;      // respuesta de pos-voz
let cantSeguras = [];      // cantidades editables de propuesta.lineas
let elecciones = {};       // {dudaIndex: [{producto_id, variante_id, cantidad}]}
let usarDictado = false;
let mensaje = '';

const $ = sel => raiz.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cop = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

export function abrirVoz(p, { grabar = false } = {}) {
  puente = p;
  montar();
  reiniciar();
  raiz.classList.add('open');
  if (grabar) void empezarGrabacion();
}

function cerrar() {
  detenerGrabacion(true);
  raiz.classList.remove('open');
}

function reiniciar() {
  estado = 'inicio';
  propuesta = null;
  cantSeguras = [];
  elecciones = {};
  usarDictado = false;
  mensaje = '';
  $('#voz-texto').value = '';
  render();
}

// ── DOM ──
function montar() {
  if (raiz) return;
  const css = document.createElement('style');
  css.textContent = `
    #voz-modal .sheet { max-height: 92vh; overflow-y: auto; gap: 14px; }
    .voz-mic { width: 92px; height: 92px; border-radius: 50%; border: none; margin: 4px auto 0; display: grid; place-items: center;
      background: var(--carbon); color: var(--paper); font-size: 38px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .voz-mic.rec { background: var(--terra); animation: voz-pulso 1.2s ease-in-out infinite; }
    .voz-mic:disabled { opacity: .4; }
    @keyframes voz-pulso { 0%,100% { box-shadow: 0 0 0 0 rgba(232,98,61,.45); } 50% { box-shadow: 0 0 0 16px rgba(232,98,61,0); } }
    .voz-estado { text-align: center; font-size: 14px; color: var(--ink-soft); min-height: 20px; }
    .voz-estado.err { color: var(--err); font-weight: 600; }
    .voz-txt { display: flex; gap: 8px; }
    .voz-txt input { flex: 1; min-width: 0; font-size: 16px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: var(--r-md); }
    .voz-txt button { flex: none; border: none; border-radius: var(--r-md); background: var(--carbon); color: var(--paper); font: inherit; font-weight: 700; padding: 0 14px; cursor: pointer; }
    .voz-trans { font-size: 13.5px; color: var(--ink-mute); font-style: italic; background: var(--paper); border-radius: var(--r-md); padding: 8px 12px; border: none; text-align: left; font-family: inherit; cursor: pointer; }
    .voz-sec { font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute); }
    .voz-fila { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line-soft); }
    .voz-fila img, .voz-fila .ph { width: 42px; height: 42px; border-radius: 8px; object-fit: cover; flex: none; background: var(--bone-soft); }
    .voz-fila .nm { flex: 1; min-width: 0; font-weight: 600; font-size: 14px; }
    .voz-fila .nm small { display: block; font-weight: 500; color: var(--ink-mute); font-size: 12px; }
    .voz-step { display: flex; align-items: center; gap: 6px; }
    .voz-step button { width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid var(--line); background: var(--paper-2); font-size: 16px; font-weight: 700; cursor: pointer; }
    .voz-step button:disabled { opacity: .3; }
    .voz-step .n { min-width: 18px; text-align: center; font-weight: 800; font-variant-numeric: tabular-nums; }
    .voz-duda { border: 2px solid var(--warn); background: var(--warn-soft); border-radius: var(--r-md); padding: 8px 12px; }
    .voz-duda.ok { border-color: var(--ok); background: var(--ok-soft); }
    .voz-duda h4 { margin: 0 0 4px; font-size: 14px; }
    .voz-duda .voz-fila { border-bottom-color: rgba(21,31,40,.08); }
    .voz-chip { display: inline-block; padding: 4px 10px; border-radius: var(--r-pill); background: var(--rio-soft); color: var(--rio); font-weight: 700; font-size: 13px; }
    .voz-precio { border: 2px solid var(--warn); border-radius: var(--r-md); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
    .voz-precio .ops { display: flex; gap: 8px; }
    .voz-precio .ops button { flex: 1; }
    .voz-aviso { font-size: 13px; color: var(--warn); font-weight: 600; }
  `;
  document.head.appendChild(css);

  raiz = document.createElement('div');
  raiz.id = 'voz-modal';
  raiz.className = 'sheet-overlay';
  raiz.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="voz-kicker">
      <div class="sheet-handle"></div>
      <span class="sheet-kicker" id="voz-kicker">Venta por voz</span>
      <button type="button" class="voz-mic" id="voz-mic" aria-label="Grabar">🎙</button>
      <div class="voz-estado" id="voz-estado" aria-live="polite"></div>
      <form class="voz-txt" id="voz-form">
        <input type="text" id="voz-texto" maxlength="500" placeholder="o escríbelo: 2 totes sol por 80 mil" autocomplete="off" enterkeyhint="send" />
        <button type="submit">Enviar</button>
      </form>
      <div id="voz-resultado"></div>
      <div class="sheet-actions">
        <button type="button" class="btn btn-primary" id="voz-agregar" hidden disabled>Agregar al carrito</button>
        <button type="button" class="btn btn-secondary" id="voz-reintentar" hidden>Reintentar</button>
        <button type="button" class="btn btn-secondary" id="voz-cerrar">Cerrar</button>
      </div>
    </div>`;
  document.body.appendChild(raiz);

  raiz.addEventListener('click', e => { if (e.target === raiz) cerrar(); });
  $('#voz-cerrar').addEventListener('click', cerrar);
  $('#voz-mic').addEventListener('click', () => {
    if (estado === 'grabando') detenerGrabacion(false);
    else if (estado !== 'procesando') void empezarGrabacion();
  });
  $('#voz-form').addEventListener('submit', e => {
    e.preventDefault();
    const texto = $('#voz-texto').value.trim();
    if (texto && estado !== 'procesando') void enviar({ texto });
  });
  $('#voz-reintentar').addEventListener('click', () => { if (ultimoEnvio) void enviar(ultimoEnvio); });
  $('#voz-agregar').addEventListener('click', agregar);
  $('#voz-resultado').addEventListener('click', alTocarResultado);
}

// ── GRABACIÓN ──
function tipoAudio() {
  const tipos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return tipos.find(t => window.MediaRecorder?.isTypeSupported?.(t)) ?? '';
}

async function empezarGrabacion() {
  if (!navigator.onLine) { error('Sin conexión: agrega desde el catálogo.'); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { error('Este navegador no permite grabar. Escribe la venta.'); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    error(e?.name === 'NotAllowedError'
      ? 'Micrófono bloqueado. Actívalo en el candado de la barra ▸ Permisos ▸ Micrófono, o escribe la venta.'
      : 'No se pudo usar el micrófono. Escribe la venta.');
    $('#voz-texto').focus();
    return;
  }
  const tipo = tipoAudio();
  grabador = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
  trozos = [];
  grabador.ondataavailable = e => { if (e.data?.size) trozos.push(e.data); };
  grabador.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    const cancelado = grabador?._cancelado;
    const mime = grabador?.mimeType || tipo || 'audio/webm';
    grabador = null;
    if (cancelado) return;
    const blob = new Blob(trozos, { type: mime });
    if (blob.size < 1000) { error('No se escuchó nada. Toca 🎙 y habla cerca del teléfono.'); return; }
    const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
    void enviar({ audio: blob, nombre: `venta.${ext}` });
  };
  grabador.start();
  estado = 'grabando';
  inicioGrab = Date.now();
  mensaje = '';
  reloj = setInterval(() => {
    const s = Math.floor((Date.now() - inicioGrab) / 1000);
    if (s >= MAX_SEG) detenerGrabacion(false);
    else render();
  }, 250);
  render();
}

function detenerGrabacion(cancelar) {
  clearInterval(reloj);
  reloj = null;
  if (grabador && grabador.state !== 'inactive') {
    grabador._cancelado = cancelar;
    grabador.stop();
  }
  if (cancelar && estado === 'grabando') estado = 'inicio';
}

// ── ENVÍO ──
async function enviar(carga) {
  if (!navigator.onLine) { error('Sin conexión: agrega desde el catálogo.'); return; }
  ultimoEnvio = carga;
  estado = 'procesando';
  mensaje = carga.audio ? 'Escuchando…' : 'Entendiendo…';
  render();
  try {
    const { data: { session } } = await puente.sb.auth.getSession();
    if (!session) { error('Tu sesión venció. Vuelve a iniciar sesión.'); return; }
    const headers = { Authorization: `Bearer ${session.access_token}`, apikey: puente.supabaseKey };
    let body;
    if (carga.audio) {
      body = new FormData();
      body.append('audio', carga.audio, carga.nombre);
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ texto: carga.texto });
    }
    const r = await fetch(`${puente.supabaseUrl}/functions/v1/pos-voz`, {
      method: 'POST', headers, body, signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const datos = await r.json().catch(() => ({}));
    if (r.status === 401) { error('Tu sesión venció o no tiene permiso de POS. Vuelve a iniciar sesión.'); return; }
    if (!r.ok) {
      if (datos.transcripcion) $('#voz-texto').value = datos.transcripcion;
      error(datos.error ? `${datos.error}.` : 'No se pudo procesar.', true);
      return;
    }
    mostrarPropuesta(datos);
  } catch (e) {
    console.error('pos-voz', e);
    error(e?.name === 'TimeoutError' ? 'Tardó demasiado.' : 'No se pudo procesar.', true);
  }
}

function error(msg, reintentable = false) {
  estado = 'error';
  mensaje = msg;
  if (!reintentable) ultimoEnvio = null;
  render();
}

function mostrarPropuesta(datos) {
  propuesta = datos;
  cantSeguras = (datos.lineas ?? []).map(l => l.cantidad);
  elecciones = {};
  usarDictado = false;
  estado = 'propuesta';
  mensaje = '';
  $('#voz-texto').value = '';
  // Duda de una sola opción: se resuelve sola.
  (datos.dudas ?? []).forEach((d, i) => {
    if (d.opciones.length === 1) elecciones[i] = [{ ...d.opciones[0], cantidad: d.cantidad }];
  });
  render();
}

// ── PROPUESTA ──
function catalogo() { return puente.catalogo(); }

function infoOpcion(o) {
  const { productos, variantesPorProducto } = catalogo();
  const p = productos.find(x => x.id === o.producto_id);
  const v = o.variante_id ? (variantesPorProducto[o.producto_id] ?? []).find(x => x.id === o.variante_id) : null;
  if (!p || (o.variante_id && !v)) return null;
  const etiqueta = v ? Object.keys(v.opciones ?? {}).sort().map(k => v.opciones[k]).join(' · ') : null;
  return {
    nombre: p.nombre,
    categoria: p.categoria,
    etiqueta,
    precio: v?.precio ?? p.precio ?? 0,
    stock: (v ?? p).stock_actual,
    foto: p.cover_url || (Array.isArray(p.fotos) && p.fotos[0]) || null,
  };
}

function propuestaEditada() {
  return {
    lineas: (propuesta.lineas ?? []).map((l, i) => ({ ...l, cantidad: cantSeguras[i] })).filter(l => l.cantidad > 0),
    dudas: propuesta.dudas ?? [],
  };
}

function lineasFinales() {
  const { productos, variantesPorProducto } = catalogo();
  return propuestaACarrito(propuestaEditada(), elecciones, productos, variantesPorProducto);
}

function filaHTML(info, cantidad, attrs, max) {
  const foto = info.foto ? `<img src="${esc(info.foto)}" alt="" loading="lazy">` : '<span class="ph"></span>';
  const det = [info.etiqueta, info.categoria, cop(info.precio), `${info.stock} en stock`].filter(Boolean).join(' · ');
  return `<div class="voz-fila">${foto}
    <div class="nm">${esc(info.nombre)}<small>${esc(det)}</small></div>
    <div class="voz-step">
      <button type="button" ${attrs} data-d="-1" ${cantidad <= 0 ? 'disabled' : ''} aria-label="Restar">−</button>
      <span class="n">${cantidad}</span>
      <button type="button" ${attrs} data-d="1" ${cantidad >= max ? 'disabled' : ''} aria-label="Sumar">+</button>
    </div></div>`;
}

function renderPropuesta() {
  const partes = [];
  if (propuesta.transcripcion) {
    partes.push(`<button type="button" class="voz-trans" data-editar="1" title="Tocar para corregir">«${esc(propuesta.transcripcion)}» ✎</button>`);
  }

  const seguras = (propuesta.lineas ?? []).map((l, i) => {
    const info = infoOpcion(l);
    return info ? filaHTML(info, cantSeguras[i], `data-segura="${i}"`, info.stock) : '';
  }).join('');
  if (seguras) partes.push(`<span class="voz-sec">Productos</span><div>${seguras}</div>`);

  (propuesta.dudas ?? []).forEach((d, i) => {
    const elegidas = elecciones[i] ?? [];
    const suma = elegidas.reduce((s, e) => s + e.cantidad, 0);
    const filas = d.opciones.map((o, j) => {
      const info = infoOpcion(o);
      if (!info) return '';
      const n = elegidas.find(e => e.producto_id === o.producto_id && e.variante_id === o.variante_id)?.cantidad ?? 0;
      const max = Math.min(info.stock, n + (d.cantidad - suma));
      return filaHTML(info, n, `data-duda="${i}" data-op="${j}"`, max);
    }).join('');
    partes.push(`<div class="voz-duda ${suma === d.cantidad ? 'ok' : ''}">
      <h4>${esc(d.texto)}</h4>
      <span class="voz-sec">Elige ${d.cantidad} · llevas ${suma}</span>${filas}</div>`);
  });

  if (!seguras && !(propuesta.dudas ?? []).length) {
    partes.push('<div class="voz-aviso">No encontré productos del catálogo en lo que dijiste. Repite o escribe la venta.</div>');
  }

  if (propuesta.metodo_pago) {
    partes.push(`<div><span class="voz-sec">Medio de pago</span> <span class="voz-chip">${METODOS[propuesta.metodo_pago]}</span></div>`);
  }
  if (propuesta.observacion) {
    partes.push(`<div><span class="voz-sec">Observación</span> ${esc(propuesta.observacion)}</div>`);
  }

  const listas = dudasPendientes(propuestaEditada(), elecciones) === 0;
  const { lineas, omitidas, recortadas } = lineasFinales();
  if (omitidas) partes.push(`<div class="voz-aviso">${omitidas} producto(s) ya no están disponibles y se omitieron.</div>`);
  if (recortadas) partes.push('<div class="voz-aviso">Algunas cantidades se ajustaron al stock disponible.</div>');

  const dictado = propuesta.total_dictado;
  const totalCat = totalLineas(lineas);
  if (listas && lineas.length && dictado && dictado !== totalCat) {
    partes.push(`<div class="voz-precio">
      <div>Dijiste <b>${cop(dictado)}</b> · catálogo <b>${cop(totalCat)}</b></div>
      <div class="ops">
        <button type="button" class="pay-btn ${usarDictado ? 'on' : ''}" data-precio="dictado">Usar ${cop(dictado)}</button>
        <button type="button" class="pay-btn ${usarDictado ? '' : 'on'}" data-precio="catalogo">Usar catálogo</button>
      </div></div>`);
  }
  return { html: partes.join(''), listo: listas && lineas.length > 0, total: usarDictado && dictado ? dictado : totalCat };
}

function alTocarResultado(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.editar) {
    $('#voz-texto').value = propuesta.transcripcion;
    $('#voz-texto').focus();
    return;
  }
  if (b.dataset.precio) { usarDictado = b.dataset.precio === 'dictado'; render(); return; }
  const d = Number(b.dataset.d);
  if (b.dataset.segura !== undefined) {
    const i = Number(b.dataset.segura);
    cantSeguras[i] = Math.max(0, cantSeguras[i] + d);
  } else if (b.dataset.duda !== undefined) {
    const i = Number(b.dataset.duda);
    const o = propuesta.dudas[i].opciones[Number(b.dataset.op)];
    const lista = (elecciones[i] ?? []).map(x => ({ ...x }));
    const e2 = lista.find(x => x.producto_id === o.producto_id && x.variante_id === o.variante_id);
    if (e2) e2.cantidad = Math.max(0, e2.cantidad + d);
    else if (d > 0) lista.push({ ...o, cantidad: 1 });
    elecciones[i] = lista.filter(x => x.cantidad > 0);
  }
  render();
}

function agregar() {
  if (estado !== 'propuesta') return;
  const { lineas } = lineasFinales();
  if (!lineas.length || dudasPendientes(propuestaEditada(), elecciones) > 0) return;
  const totalCat = totalLineas(lineas);
  const dictado = propuesta.total_dictado;
  const conDictado = usarDictado && dictado && dictado !== totalCat;
  const finales = conDictado ? repartirPrecio(lineas, dictado, Date.now().toString(36)) : lineas;
  const observacion = [propuesta.observacion, conDictado ? observacionPrecio(dictado, totalCat) : null]
    .filter(Boolean).join(' · ').slice(0, 280);
  Promise.resolve(puente.agregar(finales, { metodoPago: propuesta.metodo_pago ?? null, observacion }))
    .then(ok => { if (ok !== false) cerrar(); });
}

// ── RENDER ──
function render() {
  const mic = $('#voz-mic');
  const est = $('#voz-estado');
  const res = $('#voz-resultado');
  const btnAgregar = $('#voz-agregar');
  const btnRe = $('#voz-reintentar');

  mic.classList.toggle('rec', estado === 'grabando');
  mic.disabled = estado === 'procesando';
  mic.textContent = estado === 'grabando' ? '■' : '🎙';
  mic.setAttribute('aria-label', estado === 'grabando' ? 'Terminar' : 'Grabar');
  est.classList.toggle('err', estado === 'error');

  if (estado === 'grabando') {
    const s = Math.floor((Date.now() - inicioGrab) / 1000);
    est.textContent = `Grabando… 0:${String(s).padStart(2, '0')} · toca ■ para terminar`;
  } else if (estado === 'inicio') {
    est.textContent = navigator.onLine ? 'Toca 🎙 y di la venta: «dos totes sol por 80 mil en efectivo»' : 'Sin conexión: agrega desde el catálogo.';
  } else {
    est.textContent = mensaje;
  }

  btnRe.hidden = !(estado === 'error' && ultimoEnvio);
  if (estado === 'propuesta') {
    const { html, listo, total } = renderPropuesta();
    res.innerHTML = html;
    btnAgregar.hidden = false;
    btnAgregar.disabled = !listo;
    btnAgregar.textContent = listo ? `Agregar al carrito · ${cop(total)}` : 'Resuelve las dudas';
  } else {
    res.innerHTML = '';
    btnAgregar.hidden = true;
  }
}
