// Lógica pura del POS: búsqueda, carrito, cobro y cola. Sin DOM ni Supabase.

/** @param {string} s */
export function normalizarTexto(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function coincideBusqueda(producto, consulta) {
  const q = normalizarTexto(consulta);
  if (!q) return true;
  const texto = normalizarTexto(`${producto.nombre} ${producto.categoria ?? ''}`);
  return q.split(' ').every(w => texto.includes(w));
}

export function ordenarCatalogo(productos, masVendidos, limite = 8) {
  const porId = new Map(productos.map(p => [p.id, p]));
  const top = [];
  const usados = new Set();
  const ordenados = [...masVendidos].sort((x, y) => y.unidades - x.unidades);
  for (const mv of ordenados) {
    if (top.length >= limite) break;
    const p = porId.get(mv.producto_id);
    if (!p || p.stock_actual <= 0 || usados.has(p.id)) continue;
    usados.add(p.id);
    top.push({ producto: p, rango: top.length + 1 });
  }
  const resto = productos.filter(p => !usados.has(p.id)).map(p => ({ producto: p, rango: null }));
  return [...top, ...resto];
}

const claveDe = (productoId, varianteId) => productoId + '|' + (varianteId ?? '');

function etiquetaDe(variante) {
  if (!variante) return null;
  const o = variante.opciones ?? {};
  const vals = Object.keys(o).sort().map(k => o[k]);
  return vals.length ? vals.join(' · ') : null;
}

export function agregarAlCarrito(carrito, producto, variante, etiqueta) {
  const fuente = variante ?? producto;
  const clave = claveDe(producto.id, variante?.id);
  // Otras líneas del mismo producto/combinación (las de precio dictado por voz
  // llevan otra clave) también gastan stock.
  const otras = carrito
    .filter(l => l.clave !== clave && l.producto_id === producto.id && (l.variante_id ?? null) === (variante?.id ?? null))
    .reduce((s, l) => s + l.cantidad, 0);
  const tope = fuente.stock_actual - otras;
  const existe = carrito.some(l => l.clave === clave);
  if (existe) {
    if (fuente.stock_actual < 1 || tope < 1) return carrito.filter(l => l.clave !== clave);
    return carrito.map(l => (l.clave === clave ? { ...l, cantidad: Math.min(l.cantidad + 1, tope), stock_max: tope } : l));
  }
  if (tope < 1) return carrito;
  return [
    ...carrito,
    {
      clave,
      producto_id: producto.id,
      variante_id: variante?.id ?? null,
      nombre: producto.nombre,
      etiqueta_variante: etiqueta !== undefined ? etiqueta : etiquetaDe(variante),
      cantidad: 1,
      precio_unitario: variante?.precio ?? producto.precio ?? null,
      stock_max: tope,
    },
  ];
}

export function cambiarCantidad(carrito, clave, delta) {
  return carrito
    .map(l => (l.clave === clave ? { ...l, cantidad: Math.min(l.cantidad + delta, l.stock_max) } : l))
    .filter(l => l.cantidad > 0);
}

export function totalCarrito(carrito) {
  return carrito.reduce((s, l) => s + l.cantidad * (l.precio_unitario ?? 0), 0);
}

export function unidadesCarrito(carrito) {
  return carrito.reduce((s, l) => s + l.cantidad, 0);
}

export function restaurarCarrito(guardado, productos, variantesPorProducto) {
  const porId = new Map(productos.map(p => [p.id, p]));
  const carrito = [];
  let descartadas = 0;
  for (const l of guardado) {
    const p = porId.get(l.producto_id);
    const v = l.variante_id ? (variantesPorProducto[l.producto_id] ?? []).find(x => x.id === l.variante_id) : null;
    const fuente = l.variante_id ? v : p;
    if (!p || !fuente || fuente.stock_actual <= 0) {
      descartadas++;
      continue;
    }
    carrito.push({ ...l, cantidad: Math.min(l.cantidad, fuente.stock_actual), stock_max: fuente.stock_actual });
  }
  return { carrito, descartadas };
}

export function atajosBilletes(total) {
  const siguiente = paso => (Math.floor(total / paso) + 1) * paso;
  return [...new Set([siguiente(10000), siguiente(20000), siguiente(50000)])].sort((a, b) => a - b);
}

export function calcularVueltas(total, recibido) {
  if (recibido == null || recibido < total) return null;
  return recibido - total;
}

export function nuevoCobro() {
  return { transaccion_id: crypto.randomUUID() };
}

export function armarTransaccion(carrito, ctx) {
  const c = (ctx.comentario ?? '').trim().slice(0, 280);
  return {
    transaccion_id: ctx.transaccion_id,
    metodo_pago: ctx.metodo_pago ?? null,
    evento_id: ctx.evento_id,
    dispositivo: ctx.dispositivo,
    dispositivo_id: ctx.dispositivo_id,
    comentario: c || null,
    vendido_en: ctx.vendido_en,
    lineas: carrito.map(l => ({
      producto_id: l.producto_id,
      variante_id: l.variante_id,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
    })),
  };
}

export function migrarColaVieja(cola, productos, variantesPorProducto, uuid) {
  const porId = new Map(productos.map(p => [p.id, p]));
  return cola.map(v => {
    const p = porId.get(v.producto_id);
    const variante = v.variante_id
      ? (variantesPorProducto[v.producto_id] ?? []).find(x => x.id === v.variante_id)
      : null;
    const precio = p ? (variante?.precio ?? p.precio ?? null) : null;
    const c = (v.comentario ?? '').trim().slice(0, 280);
    return {
      transaccion_id: uuid(),
      metodo_pago: null,
      evento_id: v.evento_id || 'Venta-regular',
      dispositivo: v.dispositivo,
      dispositivo_id: v.dispositivo_id ?? null,
      comentario: c || null,
      vendido_en: v.vendido_en,
      lineas: [{
        producto_id: v.producto_id,
        variante_id: v.variante_id ?? null,
        cantidad: v.cantidad,
        precio_unitario: precio,
      }],
    };
  });
}

export function sumarPendientes(masVendidos, cola) {
  const mapa = new Map(masVendidos.map(m => [m.producto_id, m.unidades]));
  for (const t of cola) {
    for (const l of t.lineas) mapa.set(l.producto_id, (mapa.get(l.producto_id) ?? 0) + l.cantidad);
  }
  return [...mapa].map(([producto_id, unidades]) => ({ producto_id, unidades })).sort((a, b) => b.unidades - a.unidades);
}

export function resumenPendientes(cola) {
  const total = cola.reduce(
    (s, t) => s + t.lineas.reduce((x, l) => x + l.cantidad * (l.precio_unitario ?? 0), 0),
    0,
  );
  return { ventas: cola.length, total };
}
