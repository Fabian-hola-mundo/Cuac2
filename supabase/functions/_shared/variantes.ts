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
