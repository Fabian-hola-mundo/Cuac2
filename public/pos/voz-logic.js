// Lógica pura de la venta por voz: propuesta → líneas del carrito.
// Mismas formas que pos-logic.js (Linea). Sin DOM ni Supabase.

const claveDe = (productoId, varianteId) => `${productoId}|${varianteId ?? ''}`;

function etiquetaDe(variante) {
  if (!variante) return null;
  const o = variante.opciones ?? {};
  const vals = Object.keys(o).sort().map(k => o[k]);
  return vals.length ? vals.join(' · ') : null;
}

export function totalLineas(lineas) {
  return lineas.reduce((s, l) => s + l.cantidad * (l.precio_unitario ?? 0), 0);
}

const pesos = n => '$' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);

export function observacionPrecio(dictado, catalogo) {
  return `Precio dictado ${pesos(dictado)} (catálogo ${pesos(catalogo)})`;
}

// Reparte `total` entre las líneas, proporcional al subtotal de catálogo, sin
// perder pesos: el residuo va en una unidad aparte de la última línea.
// `sello` hace únicas las claves para no mezclarse con líneas a precio de catálogo.
export function repartirPrecio(lineas, total, sello) {
  if (!lineas.length) throw new Error('Sin líneas para repartir');
  if (!Number.isInteger(total) || total <= 0) throw new Error('Total dictado inválido');
  const catalogo = totalLineas(lineas);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const r = lineas.map(l => {
    const unit = catalogo > 0
      ? Math.floor((total * (l.precio_unitario ?? 0)) / catalogo)
      : Math.floor(total / unidades);
    return { ...l, clave: `${claveDe(l.producto_id, l.variante_id)}|v${sello}`, precio_unitario: unit };
  });
  const residuo = total - totalLineas(r);
  if (residuo > 0) {
    const i = r.length - 1;
    const ult = r[i];
    if (ult.cantidad === 1) {
      r[i] = { ...ult, precio_unitario: ult.precio_unitario + residuo };
    } else {
      r[i] = { ...ult, cantidad: ult.cantidad - 1, stock_max: Math.max(ult.stock_max - 1, ult.cantidad - 1) };
      r.push({ ...ult, clave: `${ult.clave}r`, cantidad: 1, precio_unitario: ult.precio_unitario + residuo, stock_max: 1 });
    }
  }
  return r;
}

// Une las líneas seguras de la propuesta con lo elegido en cada duda.
export function propuestaACarrito(propuesta, elecciones, productos, variantesPorProducto) {
  const porId = new Map(productos.map(p => [p.id, p]));
  const pedidas = [...(propuesta.lineas ?? []), ...Object.values(elecciones ?? {}).flat()];
  const lineas = [];
  let omitidas = 0;
  let recortadas = 0;
  for (const e of pedidas) {
    if (!e || !(e.cantidad > 0)) continue;
    const p = porId.get(e.producto_id);
    const v = e.variante_id ? (variantesPorProducto[e.producto_id] ?? []).find(x => x.id === e.variante_id) : null;
    const fuente = e.variante_id ? v : p;
    if (!p || !fuente || fuente.stock_actual <= 0) { omitidas++; continue; }
    const clave = claveDe(p.id, v?.id);
    const previa = lineas.find(l => l.clave === clave);
    const deseada = (previa?.cantidad ?? 0) + e.cantidad;
    const cantidad = Math.min(deseada, fuente.stock_actual);
    if (cantidad < deseada) recortadas++;
    if (previa) { previa.cantidad = cantidad; continue; }
    lineas.push({
      clave,
      producto_id: p.id,
      variante_id: v?.id ?? null,
      nombre: p.nombre,
      etiqueta_variante: etiquetaDe(v),
      cantidad,
      precio_unitario: v?.precio ?? p.precio ?? null,
      stock_max: fuente.stock_actual,
    });
  }
  return { lineas, omitidas, recortadas };
}

export function fusionarCarrito(carrito, nuevas) {
  const r = carrito.map(l => ({ ...l }));
  for (const n of nuevas) {
    const e = r.find(l => l.clave === n.clave);
    if (e) e.cantidad = Math.min(e.cantidad + n.cantidad, e.stock_max);
    else r.push({ ...n });
  }
  return r;
}

export function dudasPendientes(propuesta, elecciones) {
  return (propuesta.dudas ?? []).filter((d, i) => {
    const suma = (elecciones?.[i] ?? []).reduce((s, e) => s + e.cantidad, 0);
    return suma !== d.cantidad;
  }).length;
}
