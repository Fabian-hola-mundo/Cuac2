import { Injectable, signal } from '@angular/core';

export type ViewId = 'dashboard' | 'productos' | 'pedidos' | 'clientes' | 'pagos' | 'contenido' | 'ajustes';

@Injectable({ providedIn: 'root' })
export class AdminStateService {
  readonly view = signal<ViewId>('dashboard');
}
