// supabase/functions/_shared/variantes.ts
//
// Lógica pura de variantes, compartida por la tienda, el admin y la edge
// function crear-pedido. Sin dependencias: corre igual en Deno y en vitest.

export interface ValorOpcion { valor: string; foto_url: string | null }
export interface OpcionDef { nombre: string; valores: ValorOpcion[] }
/** Una combinación: { "Talla": "M", "Color": "Negro" }. */
export type Combinacion = Record<string, string>;

export interface VarianteBase {
  id: string;
  opciones: Combinacion;
  precio: number | null;
  activo: boolean;
}
export interface VarianteConStock extends VarianteBase { disponible: number }

const clave = (s: string) => s.trim().toLocaleLowerCase('es');

/**
 * Lo que el admin escribe llega con espacios y repetidos ("Rosa " y "rosa").
 * Sin esto se generan combinaciones duplicadas que la base rechaza por la
 * restricción única de opciones.
 */
export function normalizarOpciones(opciones: OpcionDef[]): OpcionDef[] {
  const nombresVistos = new Set<string>();
  const out: OpcionDef[] = [];
  for (const o of opciones) {
    const nombre = o.nombre.trim();
    if (!nombre || nombresVistos.has(clave(nombre))) continue;
    const vistos = new Set<string>();
    const valores: ValorOpcion[] = [];
    for (const v of o.valores) {
      const valor = v.valor.trim();
      if (!valor || vistos.has(clave(valor))) continue;
      vistos.add(clave(valor));
      valores.push({ valor, foto_url: v.foto_url ?? null });
    }
    if (valores.length === 0) continue;
    nombresVistos.add(clave(nombre));
    out.push({ nombre, valores });
  }
  return out;
}

export function generarCombinaciones(opciones: OpcionDef[]): Combinacion[] {
  if (opciones.length === 0) return [];
  return opciones.reduce<Combinacion[]>(
    (acc, o) => acc.flatMap(c => o.valores.map(v => ({ ...c, [o.nombre]: v.valor }))),
    [{}],
  );
}

export function claveCombinacion(c: Combinacion, orden: string[]): string {
  return orden.map(n => `${n}=${c[n] ?? ''}`).join('|');
}

export function etiquetaVariante(c: Combinacion, orden: string[]): string {
  return orden.map(n => c[n]).filter(Boolean).join(' · ');
}

export function varianteDeSeleccion<T extends VarianteBase>(
  variantes: T[],
  sel: Combinacion,
  orden: string[],
): T | null {
  if (orden.some(n => !sel[n])) return null;
  const buscada = claveCombinacion(sel, orden);
  return variantes.find(v => v.activo && claveCombinacion(v.opciones, orden) === buscada) ?? null;
}

/**
 * ¿Se puede elegir `valor` en `opcion` dado lo ya elegido en las DEMÁS
 * opciones? La selección actual de la propia opción no cuenta: el comprador
 * está a punto de cambiarla.
 */
export function valorDisponible(
  variantes: VarianteConStock[],
  sel: Combinacion,
  opcion: string,
  valor: string,
): boolean {
  return variantes.some(v =>
    v.activo &&
    v.disponible > 0 &&
    v.opciones[opcion] === valor &&
    Object.entries(sel).every(([n, val]) => n === opcion || !val || v.opciones[n] === val),
  );
}

export function rangoPrecios(
  variantes: VarianteBase[],
  precioBase: number,
): { min: number; max: number } | null {
  const precios = variantes.filter(v => v.activo).map(v => v.precio ?? precioBase);
  if (precios.length === 0) return null;
  return { min: Math.min(...precios), max: Math.max(...precios) };
}

// ── Líneas de pedido (crear-pedido) ──────────────────────────────────────────
// Convierte los ítems que manda el navegador en líneas de pedido con precio,
// nombre y etiqueta de variante tomados del catálogo. Del cliente sólo se
// confía en qué producto/variante y cuántas unidades.

export interface ItemEntrada { id: string; variante_id?: string | null; cantidad: number; sub?: unknown; color?: unknown }
interface ProductoCat { id: string; nombre: string; categoria: string | null; precio: number; activo: boolean }
interface VarianteCat { id: string; producto_id: string; opciones: Combinacion; precio: number | null; activo: boolean }
interface OpcionCat { producto_id: string; nombre: string; posicion: number }

export interface LineaPedido {
  id: string;
  varianteId: string | null;
  varianteLabel: string | null;
  nombre: string;
  categoria: string | null;
  precio: number;
  cantidad: number;
  sub: string;
  color: string | null;
}

export type ResultadoLineas =
  | { ok: true; lineas: LineaPedido[] }
  | { ok: false; status: 400 | 422; error: string };

export function resolverLineas(
  items: ItemEntrada[],
  productos: ProductoCat[],
  variantes: VarianteCat[],
  opciones: OpcionCat[],
): ResultadoLineas {
  const catalogo = new Map(
    productos.filter(p => p.activo && Number.isInteger(p.precio) && p.precio > 0).map(p => [p.id, p]),
  );
  const lineas: LineaPedido[] = [];

  for (const i of items) {
    const p = catalogo.get(i.id);
    if (!p) return { ok: false, status: 422, error: 'Alguno de los productos ya no está disponible' };

    const activas = variantes.filter(v => v.producto_id === p.id && v.activo);
    let varianteId: string | null = null;
    let varianteLabel: string | null = null;
    let precio = p.precio;

    if (activas.length > 0) {
      if (!i.variante_id) {
        return { ok: false, status: 400,
          error: `"${p.nombre}" ahora tiene opciones. Quítalo del carrito y vuelve a agregarlo eligiendo la tuya.` };
      }
      const v = activas.find(x => x.id === i.variante_id);
      if (!v) return { ok: false, status: 400, error: `La opción elegida de "${p.nombre}" ya no está disponible.` };
      const orden = opciones
        .filter(o => o.producto_id === p.id)
        .sort((a, b) => a.posicion - b.posicion)
        .map(o => o.nombre);
      varianteId = v.id;
      varianteLabel = etiquetaVariante(v.opciones, orden.length ? orden : Object.keys(v.opciones));
      precio = v.precio ?? p.precio;
    } else if (i.variante_id) {
      return { ok: false, status: 400, error: `La opción elegida de "${p.nombre}" ya no está disponible.` };
    }

    lineas.push({
      id: p.id,
      varianteId,
      varianteLabel,
      nombre: p.nombre,
      categoria: p.categoria,
      precio,
      cantidad: i.cantidad,
      // `sub` es NOT NULL en la tabla.
      sub: typeof i.sub === 'string' ? i.sub : '',
      color: typeof i.color === 'string' ? i.color : null,
    });
  }
  return { ok: true, lineas };
}
