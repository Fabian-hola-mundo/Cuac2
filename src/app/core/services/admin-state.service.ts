import { Injectable, signal } from '@angular/core';

export type ViewId = 'dashboard' | 'productos' | 'pedidos' | 'clientes' | 'pagos' | 'contenido' | 'ajustes';

@Injectable({ providedIn: 'root' })
export class AdminStateService {
  readonly view = signal<ViewId>('dashboard');
  /** Referencia de un pedido que el dashboard debe abrir en cuanto lo tenga cargado. */
  readonly abrirPedido = signal<string | null>(null);
}
