// Lógica pura de la tabla de productos del admin.
//
// Vive fuera del componente por dos razones: se prueba sin TestBed (ver
// productos-filtros.spec.ts) y mantiene el componente en su papel de pegamento
// entre señales y plantilla.
import type { ProductoEvento } from '../../../core/services/inventario.service';

/** Bajo este número de unidades el producto se marca en amarillo en la tabla. */
export const UMBRAL_STOCK_BAJO = 3;

/** Todo stock va en chip: el tono dice si está agotado, bajo o disponible. */
export function chipStock(n: number): { tono: 'err' | 'warn' | 'ok'; texto: string } {
  if (n <= 0) return { tono: 'err', texto: 'Agotado' };
  return { tono: n < UMBRAL_STOCK_BAJO ? 'warn' : 'ok', texto: `${n} ud.` };
}

export type EstadoFiltro = 'all' | 'activo' | 'inactivo' | 'bajo' | 'agotado';
export type OrdenCampo = 'nombre' | 'precio' | 'stock_actual' | 'creado_en';
export type OrdenDir = 'asc' | 'desc';

export interface FiltrosProductos {
  categoria: string;
  estado: EstadoFiltro;
  busqueda: string;
}

export interface KpisProductos {
  total: number;
  activos: number;
  agotados: number;
  bajos: number;
  valorInventario: number;
}

/** Traduce el id de categoría a su label legible (lo aporta el componente). */
export type LabelCategoria = (id: string) => string;

/**
 * Minúsculas y sin acentos, para que "panoleta" encuentre "Pañoleta". El
 * catálogo es pequeño, así que normalizar en cada filtrado no cuesta nada.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function coincideStockBajo(p: ProductoEvento): boolean {
  return p.stock_actual > 0 && p.stock_actual < UMBRAL_STOCK_BAJO;
}

function coincideEstado(p: ProductoEvento, estado: EstadoFiltro): boolean {
  switch (estado) {
    case 'activo':   return p.activo;
    case 'inactivo': return !p.activo;
    case 'agotado':  return p.stock_actual === 0;
    case 'bajo':     return coincideStockBajo(p);
    default:         return true;
  }
}

/** Busca en nombre, personaje y categoría (id y label). */
function coincideBusqueda(p: ProductoEvento, q: string, label: LabelCategoria): boolean {
  if (!q) return true;
  const campos = [p.nombre, p.personaje ?? '', p.categoria, label(p.categoria)];
  return campos.some(c => normalizar(c).includes(q));
}

export function filtrarProductos(
  productos: readonly ProductoEvento[],
  filtros: FiltrosProductos,
  label: LabelCategoria,
): ProductoEvento[] {
  const q = normalizar(filtros.busqueda.trim());
  return productos.filter(
    p =>
      (filtros.categoria === 'all' || p.categoria === filtros.categoria) &&
      coincideEstado(p, filtros.estado) &&
      coincideBusqueda(p, q, label),
  );
}

export function ordenarProductos(
  productos: readonly ProductoEvento[],
  campo: OrdenCampo,
  dir: OrdenDir,
): ProductoEvento[] {
  const signo = dir === 'asc' ? 1 : -1;
  return [...productos].sort((a, b) => signo * comparar(a, b, campo));
}

function comparar(a: ProductoEvento, b: ProductoEvento, campo: OrdenCampo): number {
  switch (campo) {
    case 'nombre':
      // localeCompare con 'es' para que la Ñ caiga entre N y O.
      return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    case 'creado_en':
      return new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime();
    default:
      return a[campo] - b[campo];
  }
}

export function calcularKpis(productos: readonly ProductoEvento[]): KpisProductos {
  return productos.reduce<KpisProductos>(
    (acc, p) => ({
      total: acc.total + 1,
      activos: acc.activos + (p.activo ? 1 : 0),
      agotados: acc.agotados + (p.stock_actual === 0 ? 1 : 0),
      bajos: acc.bajos + (coincideStockBajo(p) ? 1 : 0),
      valorInventario: acc.valorInventario + p.precio * p.stock_actual,
    }),
    { total: 0, activos: 0, agotados: 0, bajos: 0, valorInventario: 0 },
  );
}

/** Conteos para los chips de estado, para que el filtro anuncie qué va a mostrar. */
export function contarPorEstado(productos: readonly ProductoEvento[]): Record<EstadoFiltro, number> {
  const kpis = calcularKpis(productos);
  return {
    all: kpis.total,
    activo: kpis.activos,
    inactivo: kpis.total - kpis.activos,
    bajo: kpis.bajos,
    agotado: kpis.agotados,
  };
}

/**
 * Filtros aplicados que no se ven a simple vista en el celular: allí estado y
 * categoría viven en una hoja aparte y el botón que la abre muestra este número.
 */
export function contarFiltrosActivos(f: Pick<FiltrosProductos, 'categoria' | 'estado'>): number {
  return (f.estado !== 'all' ? 1 : 0) + (f.categoria !== 'all' ? 1 : 0);
}

export interface OrdenMovil { campo: OrdenCampo; dir: OrdenDir; label: string; }

/**
 * En el celular no hay cabeceras de tabla para ordenar: se elige entre órdenes
 * ya armados, con la dirección que tiene sentido para cada campo.
 */
export const ORDENES_MOVIL: readonly OrdenMovil[] = [
  { campo: 'creado_en',    dir: 'desc', label: 'Recientes' },
  { campo: 'nombre',       dir: 'asc',  label: 'Nombre' },
  { campo: 'precio',       dir: 'desc', label: 'Mayor precio' },
  { campo: 'stock_actual', dir: 'asc',  label: 'Menos stock' },
];

/** Opción del móvil que coincide con el orden actual (null si vino de la tabla). */
export function ordenActual(campo: OrdenCampo, dir: OrdenDir): OrdenMovil | null {
  return ORDENES_MOVIL.find(o => o.campo === campo && o.dir === dir) ?? null;
}
