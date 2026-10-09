export interface Producto {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: number | null;
  stock_actual: number;
  activo?: boolean;
  fotos?: unknown;
  [k: string]: unknown;
}
export interface Variante {
  id: string;
  producto_id: string;
  opciones: Record<string, string>;
  precio: number | null;
  stock_actual: number;
}
export interface Linea {
  clave: string;
  producto_id: string;
  variante_id: string | null;
  nombre: string;
  etiqueta_variante: string | null;
  cantidad: number;
  precio_unitario: number | null;
  stock_max: number;
}
export type MetodoPago = 'qr' | 'datafono' | 'efectivo' | null;
export interface LineaTransaccion {
  producto_id: string;
  variante_id: string | null;
  cantidad: number;
  precio_unitario: number | null;
}
export interface Transaccion {
  transaccion_id: string;
  metodo_pago: MetodoPago;
  evento_id: string;
  dispositivo: string;
  dispositivo_id: string | null;
  comentario: string | null;
  vendido_en: string;
  lineas: LineaTransaccion[];
}
export interface VentaVieja {
  producto_id: string;
  variante_id?: string | null;
  cantidad: number;
  dispositivo: string;
  dispositivo_id?: string | null;
  comentario?: string | null;
  vendido_en: string;
  sincronizado: boolean;
  evento_id?: string;
}
export interface MasVendido { producto_id: string; unidades: number }
export interface ContextoCobro {
  transaccion_id: string;
  metodo_pago: MetodoPago;
  evento_id: string;
  dispositivo: string;
  dispositivo_id: string | null;
  comentario: string | null;
  vendido_en: string;
}

export function normalizarTexto(s: string): string;
export function coincideBusqueda(producto: { nombre: string; categoria: string | null }, consulta: string): boolean;
export function ordenarCatalogo(productos: Producto[], masVendidos: MasVendido[], limite?: number): { producto: Producto; rango: number | null }[];
export function agregarAlCarrito(carrito: Linea[], producto: Producto, variante: Variante | null, etiqueta?: string | null): Linea[];
export function cambiarCantidad(carrito: Linea[], clave: string, delta: number): Linea[];
export function totalCarrito(carrito: Linea[]): number;
export function unidadesCarrito(carrito: Linea[]): number;
export function restaurarCarrito(guardado: Linea[], productos: Producto[], variantesPorProducto: Record<string, Variante[]>): { carrito: Linea[]; descartadas: number };
export function atajosBilletes(total: number): number[];
export function calcularVueltas(total: number, recibido: number | null): number | null;
export function nuevoCobro(): { transaccion_id: string };
export function armarTransaccion(carrito: Linea[], ctx: ContextoCobro): Transaccion;
export function migrarColaVieja(cola: VentaVieja[], productos: Producto[], variantesPorProducto: Record<string, Variante[]>, uuid: () => string): Transaccion[];
export function sumarPendientes(masVendidos: MasVendido[], cola: Transaccion[]): MasVendido[];
export function resumenPendientes(cola: Transaccion[]): { ventas: number; total: number };
