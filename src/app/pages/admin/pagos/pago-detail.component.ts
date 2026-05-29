import { Component, Input, Output, EventEmitter, OnChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockAdminDataService, Payment, Order, Customer } from '../../../core/services/mock-admin-data.service';

@Component({
  selector: 'app-pago-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pago-detail.component.html',
  styleUrl: './pago-detail.component.scss',
})
export class PagoDetailComponent implements OnChanges {
  @Input() pagoId!: string;
  @Output() close = new EventEmitter<void>();

  private data = inject(MockAdminDataService);

  payment  = signal<Payment | null>(null);
  order    = signal<Order | null>(null);
  customer = signal<Customer | null>(null);

  actionDone = signal<string | null>(null);

  ngOnChanges() {
    const p = this.data.getPaymentById(this.pagoId) ?? null;
    this.payment.set(p);
    if (p) {
      const o = this.data.getOrderById(p.orderId) ?? null;
      this.order.set(o);
      if (o) {
        this.customer.set(this.data.getCustomer(o.customerId) ?? null);
      }
    }
  }

  async marcarPagado() {
    this.actionDone.set('Pago marcado como pagado');
    setTimeout(() => this.actionDone.set(null), 2500);
  }

  async emitirReembolso() {
    this.actionDone.set('Reembolso iniciado');
    setTimeout(() => this.actionDone.set(null), 2500);
  }

  async cancelar() {
    this.actionDone.set('Pago cancelado');
    setTimeout(() => this.actionDone.set(null), 2500);
  }

  fmtCOP(n: number): string {
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('es-CO');
  }

  sb(s: string) { return this.data.STATUS_BADGE[s] ?? { tone: '', label: s }; }
}
