import { Component, Input, Output, EventEmitter, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminDataService } from '../../../core/services/admin-data.service';

@Component({
  selector: 'app-pago-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pago-detail.component.html',
  styleUrl: './pago-detail.component.scss',
})
export class PagoDetailComponent {
  private readonly id = signal('');
  @Input() set pagoId(v: string) { this.id.set(v); }
  @Output() close = new EventEmitter<void>();

  private data = inject(AdminDataService);

  // Derivados: cuando Bold aprueba o rechaza el pago, el drawer abierto cambia de estado solo.
  readonly payment  = computed(() => this.data.PAYMENTS.find(p => p.id === this.id()) ?? null);
  readonly order    = computed(() => {
    const p = this.payment();
    return p ? this.data.getOrderById(p.orderId) ?? null : null;
  });
  readonly customer = computed(() => {
    const o = this.order();
    return o ? this.data.getCustomer(o.customerId) ?? null : null;
  });

  fmtCOP(n: number): string {
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('es-CO');
  }

  sb(s: string) { return this.data.STATUS_BADGE[s] ?? { tone: '', label: s }; }
}
