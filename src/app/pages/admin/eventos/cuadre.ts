import type { VentaEvento } from '../../../core/services/inventario.service';

export type MetodoCuadre = 'efectivo' | 'qr' | 'datafono' | 'sin_registrar';

export interface TransaccionAdmin {
  id: string;
  vendido_en: string;
  caja: string;
  cajaNombre: string;
  metodo: MetodoCuadre;
  lineas: { nombre: string; variante: string | null; cantidad: number }[];
  comentario: string | null;
  total: number;
}

const FMT_DIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });

export function montoLinea(v: VentaEvento): number {
  return v.cantidad * (v.precio_unitario ?? v.productos_evento?.precio ?? 0);
}

export function diaLocal(iso: string): string {
  return FMT_DIA.format(new Date(iso));
}

export function claveCaja(v: VentaEvento): string {
  return v.dispositivo_id ?? 'nombre:' + (v.dispositivo ?? 'Sin caja');
}

/** jsonb no conserva el orden de las claves: se ordena por nombre de opción. */
function etiquetaVariante(v: VentaEvento): string | null {
  const o = v.producto_variantes?.opciones as Record<string, string> | undefined;
  if (!o) return null;
  const valores = Object.keys(o).sort().map(k => o[k]);
  return valores.length ? valores.join(' / ') : null;
}

export function agruparTransacciones(ventas: VentaEvento[]): TransaccionAdmin[] {
  const mapa = new Map<string, TransaccionAdmin>();
  for (const v of ventas) {
    if (v.canal === 'web') continue;
    const id = v.transaccion_id ?? v.id;
    let t = mapa.get(id);
    if (!t) {
      t = {
        id, vendido_en: v.vendido_en, caja: claveCaja(v), cajaNombre: v.dispositivo ?? 'Sin caja',
        metodo: v.metodo_pago ?? 'sin_registrar', lineas: [], comentario: null, total: 0,
      };
      mapa.set(id, t);
    }
    t.lineas.push({
      nombre: v.productos_evento?.nombre ?? '—',
      variante: etiquetaVariante(v),
      cantidad: v.cantidad,
    });
    t.total += montoLinea(v);
    if (!t.comentario && v.comentario) t.comentario = v.comentario;
  }
  return [...mapa.values()].sort((a, b) => b.vendido_en.localeCompare(a.vendido_en));
}

export function filtrar(
  tx: TransaccionAdmin[], f: { caja: string | null; dia: string | null },
): TransaccionAdmin[] {
  return tx.filter(t => (!f.caja || t.caja === f.caja) && (!f.dia || diaLocal(t.vendido_en) === f.dia));
}

export function cuadre(tx: TransaccionAdmin[]): Record<MetodoCuadre, { total: number; ventas: number }> {
  const r: Record<MetodoCuadre, { total: number; ventas: number }> = {
    efectivo: { total: 0, ventas: 0 }, qr: { total: 0, ventas: 0 },
    datafono: { total: 0, ventas: 0 }, sin_registrar: { total: 0, ventas: 0 },
  };
  for (const t of tx) { r[t.metodo].total += t.total; r[t.metodo].ventas++; }
  return r;
}

export function cajas(tx: TransaccionAdmin[]): { clave: string; nombre: string }[] {
  const m = new Map<string, string>();
  for (const t of tx) if (!m.has(t.caja)) m.set(t.caja, t.cajaNombre);
  return [...m].map(([clave, nombre]) => ({ clave, nombre }));
}

export function dias(tx: TransaccionAdmin[]): string[] {
  return [...new Set(tx.map(t => diaLocal(t.vendido_en)))].sort().reverse();
}
