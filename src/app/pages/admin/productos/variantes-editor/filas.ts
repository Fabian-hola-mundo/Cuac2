// src/app/pages/admin/productos/variantes-editor/filas.ts
//
// Filas de la tabla de combinaciones del admin. Al tocar las opciones la tabla
// se regenera, pero lo que ya existía (id, stock, precio) y lo que el admin ya
// escribió en filas nuevas no se puede perder.
import {
  Combinacion, OpcionDef, claveCombinacion, etiquetaVariante, generarCombinaciones,
} from '../../../../../../supabase/functions/_shared/variantes';
import { ProductoVariante } from '../../../../core/services/inventario.service';

export interface FilaVariante {
  opciones: Combinacion;
  etiqueta: string;
  id: string | null;
  precio: number | null;
  /** Existentes: stock actual (sólo lectura). Nuevas: stock inicial editable. */
  stock: number;
  activo: boolean;
  existente: boolean;
}

export function reconciliarFilas(
  opciones: OpcionDef[],
  previas: FilaVariante[],
  existentes: ProductoVariante[],
): FilaVariante[] {
  const orden = opciones.map(o => o.nombre);
  const porClave = <T extends { opciones: Combinacion }>(xs: T[]) =>
    new Map(xs.map(x => [claveCombinacion(x.opciones, orden), x]));
  const prev = porClave(previas);
  const exist = porClave(existentes);

  return generarCombinaciones(opciones).map(c => {
    const k = claveCombinacion(c, orden);
    const e = exist.get(k);
    const p = prev.get(k);
    return {
      opciones: c,
      etiqueta: etiquetaVariante(c, orden),
      id: e?.id ?? null,
      precio: p ? p.precio : (e?.precio ?? null),
      stock: e ? e.stock_actual : (p?.stock ?? 0),
      activo: p ? p.activo : (e?.activo ?? true),
      existente: !!e,
    };
  });
}

export function contarDesactivadas(existentes: ProductoVariante[], filas: FilaVariante[], orden: string[]): number {
  const claves = new Set(filas.map(f => claveCombinacion(f.opciones, orden)));
  return existentes.filter(e => e.activo && !claves.has(claveCombinacion(e.opciones, orden))).length;
}
