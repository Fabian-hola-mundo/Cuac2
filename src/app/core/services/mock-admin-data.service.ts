import { Injectable } from '@angular/core';

// ── Interfaces exportadas ────────────────────────────────────────────────────

export interface Customer {
  id: string; nombre: string; email: string; phone: string;
  ciudad: string; direccion: string; tag: string;
  since: string; // ISO date 'YYYY-MM-DD'
  last: string;  // última actividad, para mostrar en tabla
  orders: number; spent: number;
}

export interface Order {
  id: string; customerId: string; customer: string; email: string;
  items: number; total: number; status: string; shipping: string;
  date: string; city: string; method: string;
}

export interface Payment {
  id: string; orderId: string; order: string; date: string;
  method: string; amount: number; fee: number; net: number; status: string;
}

export interface Product {
  id: string; sku: string; name: string; category: string;
  character: string; price: number; stock: number;
  status: string; flag: string | null; color: string; updated: string;
}

export interface Character {
  id: string; name: string; region: string; color: string; accent: string;
}

export interface Category { id: string; label: string; }

export interface ToneStyle { bg: string; fg: string; }

// ── Servicio ─────────────────────────────────────────────────────────────────
// Los arreglos de registros (clientes, pedidos, pagos, productos) arrancan
// vacíos: el admin se llena con datos reales. Solo se conservan las tablas de
// referencia que la interfaz necesita para pintar (categorías, tonos, estados,
// personajes).

@Injectable({ providedIn: 'root' })
export class MockAdminDataService {

  readonly CUSTOMERS: Customer[] = [];

  readonly ORDERS: Order[] = [];

  readonly PAYMENTS: Payment[] = [];

  readonly PRODUCTS: Product[] = [];

  readonly CHARACTERS: Character[] = [
    { id: 'cuac',       name: 'Cuac',       region: '', color: 'rio',   accent: '#2A6FDB' },
    { id: 'yeison',     name: 'Yeison',     region: '', color: 'sol',   accent: '#B07820' },
    { id: 'roar',       name: 'Roar',       region: '', color: 'bone',  accent: '#151F28' },
    { id: 'kiki',       name: 'Kiki',       region: '', color: 'rosa',  accent: '#FF6FA8' },
    { id: 'abejandro',  name: 'Abejandro',  region: '', color: 'terra', accent: '#E8623D' },
    { id: 'atolita',    name: 'Atolita',    region: '', color: 'lila',  accent: '#8B6FD8' },
    { id: 'colibriana', name: 'Colibriana', region: '', color: 'selva', accent: '#1F8A5B' },
    { id: 'tiburcio',   name: 'Tiburcio',   region: '', color: 'cream', accent: '#2E8FB8' },
  ];

  readonly CATEGORIES: Category[] = [
    { id: 'tee',     label: 'Camisetas' },
    { id: 'libreta', label: 'Libretas'  },
    { id: 'sticker', label: 'Stickers'  },
    { id: 'pin',     label: 'Pines'     },
    { id: 'tote',    label: 'Totes'     },
    { id: 'poster',  label: 'Posters'   },
    { id: 'peluche', label: 'Peluches'  },
    { id: 'taza',    label: 'Tazas'     },
  ];

  readonly TONE: Record<string, ToneStyle> = {
    rio:   { bg: '#C9D9F6', fg: '#2A6FDB' },
    rosa:  { bg: '#FCE0EC', fg: '#FF6FA8' },
    sol:   { bg: '#FCEFC2', fg: '#B07820' },
    selva: { bg: '#D7EBDD', fg: '#1F8A5B' },
    terra: { bg: '#FBE0D5', fg: '#E8623D' },
    lila:  { bg: '#E5DDF7', fg: '#8B6FD8' },
    bone:  { bg: '#D4DCE4', fg: '#151F28' },
    cream: { bg: '#DDE3EA', fg: '#151F28' },
  };

  readonly STATUS_BADGE: Record<string, { tone: string; label: string }> = {
    active:    { tone: 'ok',   label: 'Activo'       },
    low:       { tone: 'warn', label: 'Stock bajo'   },
    out:       { tone: 'err',  label: 'Agotado'      },
    draft:     { tone: '',     label: 'Borrador'      },
    paid:      { tone: 'ok',   label: 'Pagado'       },
    pending:   { tone: 'warn', label: 'Pendiente'    },
    refunded:  { tone: 'lila', label: 'Reembolsado'  },
    failed:    { tone: 'err',  label: 'Fallido'      },
    shipped:   { tone: 'rio',  label: 'Enviado'      },
    delivered: { tone: 'ok',   label: 'Entregado'    },
    returned:  { tone: 'err',  label: 'Devuelto'     },
  };

  /** Personaje de respaldo cuando un id no existe en CHARACTERS. */
  readonly FALLBACK_CHARACTER: Character = { id: '', name: '—', region: '', color: 'cream', accent: '#151F28' };

  /** Categoría de respaldo cuando un id no existe en CATEGORIES. */
  readonly FALLBACK_CATEGORY: Category = { id: '', label: '—' };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  getCustomer(id: string): Customer | undefined {
    return this.CUSTOMERS.find(c => c.id === id);
  }

  getOrdersByCustomer(customerId: string): Order[] {
    return this.ORDERS.filter(o => o.customerId === customerId);
  }

  getOrderById(id: string): Order | undefined {
    return this.ORDERS.find(o => o.id === id);
  }

  getPaymentById(pagoId: string): Payment | undefined {
    return this.PAYMENTS.find(p => p.id === pagoId);
  }

  getPaymentByOrder(orderId: string): Payment | undefined {
    return this.PAYMENTS.find(p => p.orderId === orderId);
  }

  getCharacter(id: string): Character {
    return this.CHARACTERS.find(c => c.id === id) ?? this.FALLBACK_CHARACTER;
  }

  getCategory(id: string): Category {
    return this.CATEGORIES.find(c => c.id === id) ?? this.FALLBACK_CATEGORY;
  }

  /** Inicio de la ventana de "últimos 7 días", calculado desde ahora. */
  private kpiCutoff(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 7);
    return d;
  }

  totalIngresos7d(): number {
    const cutoff = this.kpiCutoff();
    return this.ORDERS
      .filter(o => o.status === 'paid' && new Date(o.date) >= cutoff)
      .reduce((sum, o) => sum + o.total, 0);
  }

  totalPedidos7d(): number {
    const cutoff = this.kpiCutoff();
    return this.ORDERS.filter(o => new Date(o.date) >= cutoff).length;
  }

  clientesNuevos7d(): number {
    const cutoff = this.kpiCutoff();
    return this.CUSTOMERS.filter(c => new Date(c.since) >= cutoff).length;
  }

  ticketPromedio7d(): number {
    const cutoff = this.kpiCutoff();
    const paid = this.ORDERS.filter(o => o.status === 'paid' && new Date(o.date) >= cutoff);
    if (!paid.length) return 0;
    return Math.round(paid.reduce((s, o) => s + o.total, 0) / paid.length);
  }

  fmtSince(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return months[d.getMonth()] + ' ' + d.getFullYear();
  }
}
