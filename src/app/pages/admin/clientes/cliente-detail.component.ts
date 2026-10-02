import { Component, Input, Output, EventEmitter, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminDataService } from '../../../core/services/admin-data.service';

@Component({
  selector: 'app-cliente-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cliente-detail.component.html',
  styleUrl: './cliente-detail.component.scss',
})
export class ClienteDetailComponent {
  private readonly id = signal('');
  @Input() set clienteId(v: string) { this.id.set(v); }
  @Output() close = new EventEmitter<void>();

  private data = inject(AdminDataService);

  // Derivados de las señales del servicio: si entra otro pedido del cliente
  // con el drawer abierto, el historial y los totales se actualizan solos.
  readonly customer = computed(() => this.data.CUSTOMERS.find(c => c.id === this.id()) ?? null);
  readonly orders   = computed(() => this.data.ORDERS.filter(o => o.customerId === this.id()));

  ticketPromedio(): number {
    const pagadas = this.orders().filter(o => o.status === 'paid');
    if (!pagadas.length) return 0;
    return Math.round(pagadas.reduce((s, o) => s + o.total, 0) / pagadas.length);
  }

  /** Celular en formato wa.me: sin espacios ni signos, con el 57 de Colombia si falta. */
  whatsapp(phone: string): string {
    const n = phone.replace(/\D/g, '');
    return n.length === 10 ? `57${n}` : n;
  }

  initials(nombre: string): string {
    return nombre.split(' ').map(s => s[0] ?? '').slice(0, 2).join('').toUpperCase();
  }

  fmtCOP(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }

  fmtSince(iso: string): string {
    return this.data.fmtSince(iso);
  }

  tagTone(tag: string): string {
    const map: Record<string, string> = { VIP: 'warn', Activo: 'ok', Devolución: 'lila', Fallido: 'err' };
    return map[tag] ?? '';
  }

  sb(s: string) { return this.data.STATUS_BADGE[s] ?? { tone: '', label: s }; }
}
