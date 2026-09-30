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
