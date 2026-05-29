import { Component, Input, Output, EventEmitter, OnChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MockAdminDataService, Customer, Order } from '../../../core/services/mock-admin-data.service';

@Component({
  selector: 'app-cliente-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cliente-detail.component.html',
  styleUrl: './cliente-detail.component.scss',
})
export class ClienteDetailComponent implements OnChanges {
  @Input() clienteId!: string;
  @Output() close = new EventEmitter<void>();

  private data = inject(MockAdminDataService);

  customer  = signal<Customer | null>(null);
  orders    = signal<Order[]>([]);

  editEmail     = signal('');
  editPhone     = signal('');
  editCiudad    = signal('');
  editDireccion = signal('');
  saving        = signal(false);
  saved         = signal(false);

  ngOnChanges() {
    const c = this.data.getCustomer(this.clienteId) ?? null;
    this.customer.set(c);
    this.orders.set(this.data.getOrdersByCustomer(this.clienteId));
    if (c) {
      this.editEmail.set(c.email);
      this.editPhone.set(c.phone);
      this.editCiudad.set(c.ciudad);
      this.editDireccion.set(c.direccion);
    }
  }

  async guardar() {
    this.saving.set(true);
    await new Promise(r => setTimeout(r, 800));
    this.saving.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }

  ticketPromedio(): number {
    const pagadas = this.orders().filter(o => o.status === 'paid');
    if (!pagadas.length) return 0;
    return Math.round(pagadas.reduce((s, o) => s + o.total, 0) / pagadas.length);
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
