// Regla anti-adivinanza: el modelo propone, el servidor exige que cada
// producto (y su combinación) esté realmente dicho en la transcripción.
// JS plano para que lo importen Deno (función) y Vitest (pruebas).

export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const palabras = s => normalizar(s).split(' ').filter(Boolean);

export function palabrasDistintivas(producto, productosCategoria, categoria) {
  const comunes = new Set(palabras(categoria));
  for (const p of productosCategoria) {
    if (p.id !== producto.id) palabras(p.nombre).forEach(w => comunes.add(w));
  }
  return palabras(producto.nombre).filter(w => w.length >= 3 && !comunes.has(w));
}

// «orquidea» ~ «orquideas»: palabra completa o prefijo común de ≥ 5 letras.
function coincide(palabra, textoPalabras) {
  return textoPalabras.some(t => {
    if (t === palabra) return true;
    let i = 0;
    while (i < t.length && i < palabra.length && t[i] === palabra[i]) i++;
    return i >= 5;
  });
}

const esCantidad = c => Number.isInteger(c) && c >= 1;

export function validarPropuesta(modelo, catalogo, transcripcion) {
  const texto = normalizar(transcripcion);
  const textoPalabras = texto.split(' ').filter(Boolean);
  const porId = new Map(catalogo.productos.map(p => [p.id, p]));
  const variantesDe = id => catalogo.variantes.filter(v => v.producto_id === id);
  const deCategoria = cat => catalogo.productos.filter(p => p.categoria === cat);

  const lineas = [];
  const dudas = [];

  // Opciones de un producto: sus combinaciones si las tiene, o el producto.
  const opcionesDe = p => {
    const vs = variantesDe(p.id);
    return vs.length ? vs.map(v => ({ producto_id: p.id, variante_id: v.id })) : [{ producto_id: p.id, variante_id: null }];
  };

  for (const l of modelo.lineas ?? []) {
    const p = porId.get(l.producto_id);
    if (!p || !esCantidad(l.cantidad)) continue;
    const frag = normalizar(l.fragmento);
    const fragmentoDicho = frag.length > 0 && texto.includes(frag);
    const hermanos = deCategoria(p.categoria);
    const distintivas = palabrasDistintivas(p, hermanos, p.categoria);
    const productoDicho = fragmentoDicho &&
      (hermanos.length <= 1 || distintivas.some(w => coincide(w, frag.split(' '))));

    if (!productoDicho) {
      const candidatos = fragmentoDicho ? hermanos : [p];
      dudas.push({
        texto: fragmentoDicho ? `¿Cuál ${p.categoria}?` : `¿Confirmas ${p.nombre}?`,
        cantidad: l.cantidad,
        opciones: candidatos.flatMap(opcionesDe),
      });
      continue;
    }

    const vs = variantesDe(p.id);
    if (!vs.length) {
      lineas.push({ producto_id: p.id, variante_id: null, cantidad: l.cantidad });
      continue;
    }
    const v = vs.find(x => x.id === l.variante_id);
    const varianteDicha = v && Object.values(v.opciones ?? {})
      .some(val => palabras(val).every(w => textoPalabras.includes(w)));
    if (varianteDicha) {
      lineas.push({ producto_id: p.id, variante_id: v.id, cantidad: l.cantidad });
    } else {
      dudas.push({ texto: `¿Qué combinación de ${p.nombre}?`, cantidad: l.cantidad, opciones: opcionesDe(p) });
    }
  }

  for (const d of modelo.dudas ?? []) {
    if (!esCantidad(d.cantidad)) continue;
    const vistas = new Set();
    const opciones = [];
    for (const o of d.opciones ?? []) {
      const p = porId.get(o.producto_id);
      if (!p) continue;
      const vs = variantesDe(p.id);
      const expandidas = !vs.length
        ? [{ producto_id: p.id, variante_id: null }]
        : vs.some(v => v.id === o.variante_id)
          ? [{ producto_id: p.id, variante_id: o.variante_id }]
          : opcionesDe(p);
      for (const e of expandidas) {
        const k = `${e.producto_id}|${e.variante_id ?? ''}`;
        if (!vistas.has(k)) { vistas.add(k); opciones.push(e); }
      }
    }
    if (opciones.length) dudas.push({ texto: String(d.texto ?? '¿Cuál?').slice(0, 120), cantidad: d.cantidad, opciones });
  }

  return { lineas, dudas };
}
