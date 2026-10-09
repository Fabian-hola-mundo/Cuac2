// Regla anti-adivinanza: el modelo propone, el servidor exige que el fragmento
// dicho señale a ese producto (y combinación) mejor que a cualquier otro del
// catálogo. Si hay empate, se pregunta. JS plano para Deno y Vitest.

const NUMEROS = { un: '1', uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9', diez: '10' };
const VACIAS = new Set(['para', 'por', 'con', 'los', 'las', 'del', 'que', 'unidades', 'ultimas']);

export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Palabras con significado: ≥ 3 letras o números, sin palabras vacías.
export function fichas(s) {
  return [...new Set(normalizar(s).split(' ').filter(w => (/^\d+$/.test(w) || w.length >= 3) && !VACIAS.has(w)))];
}

// Palabras de lo dicho, con los números en letras también como dígitos y cada
// par de palabras seguidas también pegado («tote bag» → «totebag»).
function fichasDichas(s) {
  const ws = normalizar(s).split(' ').filter(Boolean);
  const pares = ws.slice(1).map((w, i) => ws[i] + w);
  return [...new Set([...ws, ...pares, ...ws.map(w => NUMEROS[w]).filter(Boolean)])];
}

// «orquidea» ~ «orquideas»: igual, o prefijo común de ≥ 5 letras.
function parecida(a, b) {
  if (a === b) return true;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 5;
}

export function puntaje(fichasObjetivo, dichas) {
  return fichasObjetivo.filter(f => dichas.some(d => parecida(f, d))).length;
}

const fichasProducto = p => [...new Set([...fichas(p.nombre), ...fichas(p.categoria)])];
// En combinaciones cuentan también las palabras cortas (tallas S, M, L).
const fichasVariante = v => [...new Set(normalizar(Object.values(v.opciones ?? {}).join(' ')).split(' ').filter(w => w && !VACIAS.has(w)))];

// Los mejores según el puntaje; vacío si nadie suma.
function mejores(items, fichasDe, dichas) {
  let max = 0;
  let r = [];
  for (const it of items) {
    const p = puntaje(fichasDe(it), dichas);
    if (p > max) { max = p; r = [it]; } else if (p === max && p > 0) r.push(it);
  }
  return r;
}

// El fragmento cuenta como dicho si cada palabra se parece a una de la frase
// (el modelo a veces copia el nombre del catálogo en vez de lo dicho).
// También acepta una palabra que, pegada a su vecina, se dijo junta (exacto:
// con prefijo, «orquideas»+«grande» pasaría por «orquidea»).
function fragmentoDicho(frag, dichas) {
  const ws = frag.split(' ').filter(Boolean);
  const ok = w => dichas.some(d => parecida(w, d) || NUMEROS[w] === d);
  const junta = w => dichas.includes(w);
  return ws.length > 0 && ws.every((w, i) => ok(w) || (i + 1 < ws.length && junta(w + ws[i + 1])) || (i > 0 && junta(ws[i - 1] + w)));
}

const esCantidad = c => Number.isInteger(c) && c >= 1;

export function validarPropuesta(modelo, catalogo, transcripcion) {
  const dichasFrase = fichasDichas(transcripcion);
  const porId = new Map(catalogo.productos.map(p => [p.id, p]));
  const variantesDe = id => catalogo.variantes.filter(v => v.producto_id === id);
  const opcionesDe = p => {
    const vs = variantesDe(p.id);
    return vs.length ? vs.map(v => ({ producto_id: p.id, variante_id: v.id })) : [{ producto_id: p.id, variante_id: null }];
  };

  const lineas = [];
  const dudas = [];

  for (const l of modelo.lineas ?? []) {
    const p = porId.get(l.producto_id);
    if (!p || !esCantidad(l.cantidad)) continue;
    const frag = normalizar(l.fragmento);
    if (!fragmentoDicho(frag, dichasFrase)) {
      dudas.push({ texto: `¿Confirmas ${p.nombre}?`, cantidad: l.cantidad, opciones: opcionesDe(p) });
      continue;
    }
    const dichas = fichasDichas(frag);
    const top = mejores(catalogo.productos, fichasProducto, dichas);
    if (top.length !== 1 || top[0].id !== p.id) {
      const candidatos = top.length ? top : [p];
      dudas.push({ texto: `¿Cuál exactamente? («${l.fragmento}»)`, cantidad: l.cantidad, opciones: candidatos.flatMap(opcionesDe) });
      continue;
    }
    const vs = variantesDe(p.id);
    if (!vs.length) {
      lineas.push({ producto_id: p.id, variante_id: null, cantidad: l.cantidad });
      continue;
    }
    const topV = mejores(vs, fichasVariante, dichas);
    if (topV.length === 1 && topV[0].id === l.variante_id) {
      lineas.push({ producto_id: p.id, variante_id: l.variante_id, cantidad: l.cantidad });
    } else {
      dudas.push({ texto: `¿Qué combinación de ${p.nombre}?`, cantidad: l.cantidad, opciones: opcionesDe(p) });
    }
  }

  for (const d of modelo.dudas ?? []) {
    if (!esCantidad(d.cantidad)) continue;
    const vistas = new Set();
    const opciones = [];
    // El modelo puede olvidar opciones: se completan con todo lo que empata
    // con lo dicho («dos tote bags» → las 3 totes).
    const fragD = normalizar(d.fragmento);
    const empatados = fragmentoDicho(fragD, dichasFrase)
      ? mejores(catalogo.productos, fichasProducto, fichasDichas(fragD)).map(p => ({ producto_id: p.id, variante_id: null }))
      : [];
    for (const o of [...(d.opciones ?? []), ...empatados]) {
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
    if (opciones.length) dudas.push({ texto: (d.texto ? String(d.texto) : d.fragmento ? `¿Cuál? «${d.fragmento}»` : '¿Cuál?').slice(0, 120), cantidad: d.cantidad, opciones });
  }

  return { lineas, dudas };
}
