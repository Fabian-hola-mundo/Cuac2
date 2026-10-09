// src/app/pages/admin/productos/variantes-editor/filas.ts
//
// Filas de la tabla de combinaciones del admin. Al tocar las opciones la tabla
// se regenera, pero lo que ya existía (id, stock, precio) y lo que el admin ya
// escribió en filas nuevas no se puede perder.
import {
  Combinacion, OpcionDef, claveCombinacion, etiquetaVariante, generarCombinaciones, normalizarOpciones,
} from '../../../../../../supabase/functions/_shared/variantes';
import { ProductoVariante } from '../../../../core/services/inventario.service';

export interface FilaVariante {
  opciones: Combinacion;
  etiqueta: string;
  id: string | null;
  precio: number | null;
  /** Existentes: stock actual, editable (se guarda como ajuste). Nuevas: el stock con el que nacen. */
  stock: number;
  /** Stock en la base de una existente; null en las nuevas. Contra él se mide el ajuste. */
  stockBase: number | null;
  activo: boolean;
  existente: boolean;
}

/**
 * `claveCombinacion` sólo lee las claves de `orden`, así que { Talla, Color }
 * pasaría por { Color } al quitar Talla. La base compara el JSON exacto: una
 * combinación con claves de más o de menos es otra variante.
 */
function mismasClaves(c: Combinacion, orden: string[]): boolean {
  const claves = Object.keys(c);
  return claves.length === orden.length && orden.every(n => n in c);
}

export function reconciliarFilas(
  opciones: OpcionDef[],
  previas: FilaVariante[],
  existentes: ProductoVariante[],
): FilaVariante[] {
  // Una opción sin nombre o sin valores no existe para la base.
  const ops = normalizarOpciones(opciones);
  const orden = ops.map(o => o.nombre);
  const porClave = <T extends { opciones: Combinacion }>(xs: T[]) =>
    new Map(xs.filter(x => mismasClaves(x.opciones, orden))
      .map(x => [claveCombinacion(x.opciones, orden), x]));
  const prev = porClave(previas);
  const exist = porClave(existentes);

  return generarCombinaciones(ops).map(c => {
    const k = claveCombinacion(c, orden);
    const e = exist.get(k);
    const p = prev.get(k);
    return {
      opciones: c,
      etiqueta: etiquetaVariante(c, orden),
      id: e?.id ?? null,
      precio: p ? p.precio : (e?.precio ?? null),
      // Lo escrito a mano sobrevive a regenerar la tabla, también en las existentes.
      stock: p ? p.stock : (e?.stock_actual ?? 0),
      stockBase: e ? e.stock_actual : null,
      activo: p ? p.activo : (e?.activo ?? true),
      existente: !!e,
    };
  });
}

export function contarDesactivadas(existentes: ProductoVariante[], filas: FilaVariante[], orden: string[]): number {
  const claves = new Set(filas.map(f => claveCombinacion(f.opciones, orden)));
  return existentes.filter(e =>
    e.activo && !(mismasClaves(e.opciones, orden) && claves.has(claveCombinacion(e.opciones, orden))),
  ).length;
}

/**
 * Valores escritos en el campo de una opción sin pulsar Enter: al guardar se
 * suman a su opción en vez de perderse en silencio. Vacíos y repetidos (sin
 * distinguir mayúsculas) se ignoran. Devuelve el mismo arreglo si no cambia nada.
 */
export function agregarValoresPendientes(
  opciones: OpcionDef[], pendientes: Record<number, string>,
): OpcionDef[] {
  let cambio = false;
  const out = opciones.map((o, i) => {
    const valor = (pendientes[i] ?? '').trim();
    const k = valor.toLocaleLowerCase('es');
    if (!valor || o.valores.some(v => v.valor.trim().toLocaleLowerCase('es') === k)) return o;
    cambio = true;
    return { ...o, valores: [...o.valores, { valor, foto_url: null }] };
  });
  return cambio ? out : opciones;
}
