import type { Linea, Producto, Variante } from './pos-logic.js';

export interface Opcion { producto_id: string; variante_id: string | null; }
export interface Eleccion extends Opcion { cantidad: number; }
export interface DudaVoz { texto: string; cantidad: number; opciones: Opcion[]; }
export interface PropuestaVoz { lineas: Eleccion[]; dudas: DudaVoz[]; }
export type Elecciones = Record<number, Eleccion[]>;

export function totalLineas(lineas: Linea[]): number;
export function observacionPrecio(dictado: number, catalogo: number): string;
export function repartirPrecio(lineas: Linea[], total: number, sello: string): Linea[];
export function propuestaACarrito(
  propuesta: PropuestaVoz,
  elecciones: Elecciones,
  productos: Producto[],
  variantesPorProducto: Record<string, Variante[]>,
): { lineas: Linea[]; omitidas: number; recortadas: number };
export function fusionarCarrito(carrito: Linea[], nuevas: Linea[]): Linea[];
export function dudasPendientes(propuesta: PropuestaVoz, elecciones: Elecciones): number;
