export interface ProductoCat { id: string; nombre: string; categoria: string; precio: number | null; stock_actual: number; }
export interface VarianteCat { id: string; producto_id: string; opciones: Record<string, string> | null; precio: number | null; stock_actual: number; }
export interface Catalogo { productos: ProductoCat[]; variantes: VarianteCat[]; }
export interface Opcion { producto_id: string; variante_id: string | null; }
export interface LineaVoz extends Opcion { cantidad: number; }
export interface DudaVoz { texto: string; cantidad: number; opciones: Opcion[]; }
export interface LineaModelo extends LineaVoz { fragmento: string; }
export interface PropuestaModelo { lineas: LineaModelo[]; dudas: DudaVoz[]; }

export function normalizar(s: string): string;
export function fichas(s: string): string[];
export function puntaje(fichasObjetivo: string[], dichas: string[]): number;
export function validarPropuesta(modelo: PropuestaModelo, catalogo: Catalogo, transcripcion: string): { lineas: LineaVoz[]; dudas: DudaVoz[] };
