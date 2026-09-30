//
// El pedido con stock apartado sobrevive a recargas: queda en localStorage
// hasta que vence la reserva (15 min), se paga o el cliente lo cancela.
import { BoldCheckoutConfig } from './bold.service';

export const CLAVE_PEDIDO_PENDIENTE = 'cuaquiverso.pedido-pendiente';

export interface PedidoPendiente {
  token: string;
  referencia: string;
  /** ISO: cuándo vence la reserva según el servidor. */
  expiraEn: string;
  /** Huella del formulario + carrito con que se creó: si cambian, es otro pedido. */
  huella: string;
  bold: BoldCheckoutConfig;
  /**
   * Descuento con que se creó el pedido. Al retomarlo se restaura tal cual: el
   * uso del código ya se descontó en el servidor y la huella lo incluye.
   * Opcional: las entradas guardadas antes de existir este campo no lo traen.
   */
  descuento?: DescuentoPendiente;
}

export interface DescuentoPendiente {
  codigo: string;
  monto: number;
}

function esDescuentoValido(d: unknown): d is DescuentoPendiente {
  const x = d as DescuentoPendiente | null;
  return !!x && typeof x.codigo === 'string' && x.codigo !== ''
    && typeof x.monto === 'number' && Number.isFinite(x.monto);
}

export function segundosRestantes(expiraEn: string, ahora = Date.now()): number {
  return Math.max(0, Math.floor((Date.parse(expiraEn) - ahora) / 1000));
}

export function formatoCuenta(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function leerPedidoPendiente(storage: Storage | null, ahora = Date.now()): PedidoPendiente | null {
  if (!storage) return null;
  try {
    const crudo = storage.getItem(CLAVE_PEDIDO_PENDIENTE);
    if (!crudo) return null;
    const p = JSON.parse(crudo) as PedidoPendiente;
    if (!p?.token || !p?.expiraEn || !p?.bold?.integritySignature) return null;
    if (segundosRestantes(p.expiraEn, ahora) <= 0) {
      storage.removeItem(CLAVE_PEDIDO_PENDIENTE);
      return null;
    }
    if (p.descuento !== undefined && !esDescuentoValido(p.descuento)) delete p.descuento;
    return p;
  } catch {
    return null;
  }
}

export function guardarPedidoPendiente(storage: Storage | null, p: PedidoPendiente): void {
  try { storage?.setItem(CLAVE_PEDIDO_PENDIENTE, JSON.stringify(p)); } catch { /* sin persistencia */ }
}

export function limpiarPedidoPendiente(storage: Storage | null): void {
  try { storage?.removeItem(CLAVE_PEDIDO_PENDIENTE); } catch { /* nada */ }
}

/**
 * Borra el pedido pendiente guardado sólo si es el de `token`: la confirmación
 * de un pedido viejo no debe tirar la reserva de uno nuevo.
 */
export function limpiarPedidoPendienteDe(storage: Storage | null, token: string): void {
  const p = leerPedidoPendiente(storage);
  if (p && p.token === token) limpiarPedidoPendiente(storage);
}
