import {
  Component, computed, signal, inject, OnInit, OnDestroy,
  HostListener, Output, EventEmitter, input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { Router }       from '@angular/router';
import { MockAdminDataService, Order, Customer } from '../../../core/services/mock-admin-data.service';
import { InventarioService, ProductoEvento }     from '../../../core/services/inventario.service';
import { AdminStateService }                     from '../../../core/services/admin-state.service';

interface SearchResult {
  type: 'pedido' | 'cliente' | 'producto';
  id:    string;
  title: string;
  sub:   string;
  badge?: string;
  badgeTone?: string;
}

@Component({
  selector: 'app-admin-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-search.component.html',
  styleUrl:    './admin-search.component.scss',
})
export class AdminSearchComponent implements OnInit, OnDestroy {
  @Output() closed = new EventEmitter<void>();

  private data   = inject(MockAdminDataService);
  readonly inv   = inject(InventarioService);
  private state  = inject(AdminStateService);
  private router = inject(Router);

  query     = signal('');
  activeIdx = signal(-1);

  // ── Results ──────────────────────────────────────────────────────────────
  pedidos = computed<SearchResult[]>(() => {
    const q = this.query().toLowerCase().trim();
    const list = q
      ? this.data.ORDERS.filter(o =>
          o.id.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.city.toLowerCase().includes(q))
      : this.data.ORDERS.slice(0, 4);
    return list.slice(0, 4).map(o => ({
      type: 'pedido',
      id: o.id,
      title: o.id,
      sub: `${o.customer} · ${o.city}`,
      badge: this.statusLabel(o.status),
      badgeTone: this.statusTone(o.status),
    }));
  });

  clientes = computed<SearchResult[]>(() => {
    const q = this.query().toLowerCase().trim();
    const list = q
      ? this.data.CUSTOMERS.filter(c =>
          c.nombre.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.ciudad.toLowerCase().includes(q))
      : this.data.CUSTOMERS.slice(0, 4);
    return list.slice(0, 4).map(c => ({
      type: 'cliente',
      id: c.id,
      title: c.nombre,
      sub: `${c.email} · ${c.ciudad}`,
      badge: c.tag,
      badgeTone: this.tagTone(c.tag),
    }));
  });

  productos = computed<SearchResult[]>(() => {
    const q = this.query().toLowerCase().trim();
    const list = q
      ? this.inv.productos().filter(p =>
          p.nombre.toLowerCase().includes(q) ||
          (p.categoria ?? '').toLowerCase().includes(q))
      : this.inv.productos().slice(0, 4);
    return list.slice(0, 4).map(p => ({
      type: 'producto',
      id: p.id,
      title: p.nombre,
      sub: `${p.categoria ?? '—'} · $${p.precio.toLocaleString('es-CO')}`,
    }));
  });

  allResults = computed<SearchResult[]>(() => [
    ...this.pedidos(),
    ...this.clientes(),
    ...this.productos(),
  ]);

  ngOnInit() {
    this.inv.cargarTodos();
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { this.close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIdx.update(i => Math.min(i + 1, this.allResults().length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIdx.update(i => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter') {
      const r = this.allResults()[this.activeIdx()];
      if (r) this.select(r);
    }
  }

  onQueryChange(val: string) {
    this.query.set(val);
    this.activeIdx.set(-1);
  }

  select(r: SearchResult) {
    if (r.type === 'pedido') {
      this.state.view.set('pedidos');
      this.router.navigate(['/admin']);
    } else if (r.type === 'cliente') {
      this.state.view.set('clientes');
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/admin/productos']);
    }
    this.close();
  }

  close() { this.closed.emit(); }

  resultIndex(r: SearchResult): number {
    return this.allResults().findIndex(x => x.type === r.type && x.id === r.id);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private statusLabel(s: string): string {
    const m: Record<string, string> = {
      paid: 'Pagado', pending: 'Pendiente',
      shipped: 'Enviado', refunded: 'Reembolso', failed: 'Fallido',
    };
    return m[s] ?? s;
  }

  private statusTone(s: string): string {
    const m: Record<string, string> = {
      paid: 'ok', pending: 'warn', shipped: 'rio',
      refunded: 'lila', failed: 'err',
    };
    return m[s] ?? '';
  }

  private tagTone(t: string): string {
    const m: Record<string, string> = {
      VIP: 'warn', Activo: 'ok', Devolución: 'lila', Fallido: 'err',
    };
    return m[t] ?? '';
  }

  hasResults = computed(() =>
    this.pedidos().length > 0 ||
    this.clientes().length > 0 ||
    this.productos().length > 0
  );
}
