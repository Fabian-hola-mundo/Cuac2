import { Injectable, inject, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

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
  /** uuid de la fila en `pedidos`: `id` es la referencia que ve el cliente. */
  dbId: string;
  /** Número de guía de la transportadora, si ya se despachó. */
  guia: string | null;
  enviadoEn: string | null;
  entregadoEn: string | null;
  /** Los artículos tal como se compraron: nombre y precio del momento de la compra. */
  lines: OrderLine[];
}

export interface OrderLine {
  name: string; detail: string; variant: string | null;
  price: number; qty: number;
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

/** Fila de `pedidos` con lo que el admin necesita, incluida la suma de unidades. */
interface PedidoFila {
  id: string;
  referencia: string | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado';
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  celular: string | null;
  ciudad: string | null;
  direccion: string | null;
  total: number;
  bold_payment_id: string | null;
  creado_en: string;
  envio_estado?: EnvioEstado | null;
  guia?: string | null;
  enviado_en?: string | null;
  entregado_en?: string | null;
  pedido_items: PedidoItemFila[] | null;
}

interface PedidoItemFila {
  nombre: string;
  sub: string | null;
  variante_label: string | null;
  precio: number;
  cantidad: number;
}

export type EnvioEstado = 'preparando' | 'enviado' | 'entregado' | 'devuelto';

const ENVIO_A_SHIPPING: Record<EnvioEstado, string> = {
  preparando: 'pending',
  enviado:    'shipped',
  entregado:  'delivered',
  devuelto:   'returned',
};

const SHIPPING_A_ENVIO: Record<string, EnvioEstado> = {
  pending:   'preparando',
  shipped:   'enviado',
  delivered: 'entregado',
  returned:  'devuelto',
};

const ESTADO_A_STATUS: Record<PedidoFila['estado'], string> = {
  aprobado:  'paid',
  pendiente: 'pending',
  rechazado: 'failed',
  cancelado: 'cancelled',
};

/** 'YYYY-MM-DD HH:mm' en hora local: la tabla corta el día con slice(0, 10) y la hora con slice(11). */
function fechaLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Pasa las filas de `pedidos` a los modelos que pintan Dashboard, Pedidos, Clientes y Pagos. */
export function mapearPedidos(filas: PedidoFila[]): { orders: Order[]; customers: Customer[]; payments: Payment[] } {
  const orders: Order[] = filas.map(p => {
    const email = (p.email ?? '').trim().toLowerCase();
    const status = ESTADO_A_STATUS[p.estado] ?? p.estado;
    return {
      id:         p.referencia ?? p.id.slice(0, 8).toUpperCase(),
      customerId: email || p.celular || p.id,
      customer:   [p.nombre, p.apellido].filter(Boolean).join(' ') || 'Sin nombre',
      email,
      items:      (p.pedido_items ?? []).reduce((s, i) => s + i.cantidad, 0),
      total:      p.total,
      status,
      shipping:   ENVIO_A_SHIPPING[p.envio_estado ?? 'preparando'] ?? 'pending',
      dbId:       p.id,
      guia:       p.guia ?? null,
      enviadoEn:  p.enviado_en ? fechaLocal(p.enviado_en) : null,
      entregadoEn: p.entregado_en ? fechaLocal(p.entregado_en) : null,
      date:       fechaLocal(p.creado_en),
      city:       p.ciudad ?? '—',
      method:     'Bold',
      lines:      (p.pedido_items ?? []).map(i => ({
        name:    i.nombre,
        detail:  i.sub ?? '',
        variant: i.variante_label,
        price:   i.precio,
        qty:     i.cantidad,
      })),
    };
  });

  const porCliente = new Map<string, { filas: PedidoFila[]; orders: Order[] }>();
  filas.forEach((p, i) => {
    const o = orders[i];
    const g = porCliente.get(o.customerId) ?? { filas: [], orders: [] };
    g.filas.push(p);
    g.orders.push(o);
    porCliente.set(o.customerId, g);
  });

  const customers: Customer[] = [...porCliente].map(([id, g]) => {
    // Las filas vienen de la más nueva a la más vieja.
    const reciente = g.filas[0];
    const pagados  = g.orders.filter(o => o.status === 'paid');
    const tag = pagados.length >= 3 ? 'VIP'
      : pagados.length > 0 ? 'Activo'
      : g.orders.some(o => o.status === 'failed') ? 'Fallido'
      : 'Nuevo';
    return {
      id,
      nombre:    g.orders[0].customer,
      email:     g.orders[0].email,
      phone:     reciente.celular ?? '',
      ciudad:    reciente.ciudad ?? '',
      direccion: reciente.direccion ?? '',
      tag,
      since:     g.filas[g.filas.length - 1].creado_en.slice(0, 10),
      last:      g.orders[0].date.slice(0, 10),
      orders:    g.orders.length,
      spent:     pagados.reduce((s, o) => s + o.total, 0),
    };
  });

  const payments: Payment[] = filas.map((p, i) => {
    const o = orders[i];
    return {
      id:      p.bold_payment_id ?? `PAG-${o.id}`,
      orderId: o.id,
      order:   o.id,
      date:    o.date,
      method:  'Bold',
      amount:  o.total,
      // Bold no reporta la comisión por pedido: se muestra el bruto como neto.
      fee:     0,
      net:     o.total,
      status:  o.status,
    };
  });

  return { orders, customers, payments };
}

// ── Servicio ─────────────────────────────────────────────────────────────────
// Pedidos, clientes y pagos salen de la tabla `pedidos` y se recargan solos
// cuando un pedido entra o cambia (realtime) y al volver a la pestaña. Las
// tablas de referencia (tonos, estados) siguen siendo fijas porque son de
// presentación, no datos del negocio.

@Injectable({ providedIn: 'root' })
export class AdminDataService {
  private sb = inject(SupabaseService);

  readonly orders    = signal<Order[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly payments  = signal<Payment[]>([]);
  readonly cargando  = signal(false);
  readonly error     = signal<string | null>(null);

  get CUSTOMERS(): Customer[] { return this.customers(); }
  get ORDERS():    Order[]    { return this.orders(); }
  get PAYMENTS():  Payment[]  { return this.payments(); }

  readonly PRODUCTS: Product[] = [];

  private canal: RealtimeChannel | null = null;
  private recarga?: ReturnType<typeof setTimeout>;

  /** Carga los pedidos y empieza a escuchar cambios. Llamarlo varias veces es inofensivo. */
  iniciar(): void {
    void this.cargar();
    if (this.canal || typeof window === 'undefined') return;
    this.canal = this.sb.db
      .channel(`admin-pedidos-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => this.programarRecarga())
      .subscribe();
    // Si la conexión realtime se cae con la pestaña en segundo plano, al volver se recarga igual.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.programarRecarga();
    });
  }

  /** Un pago aprobado dispara varios UPDATE seguidos: se agrupan en una sola lectura. */
  private programarRecarga(): void {
    clearTimeout(this.recarga);
    this.recarga = setTimeout(() => void this.cargar(), 400);
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    const { data, error } = await this.sb.db
      .from('pedidos')
      .select('id, referencia, estado, nombre, apellido, email, celular, ciudad, direccion, total, bold_payment_id, creado_en, envio_estado, guia, enviado_en, entregado_en, pedido_items(nombre, sub, variante_label, precio, cantidad)')
      .order('creado_en', { ascending: false });
    this.cargando.set(false);
    if (error) {
      this.error.set(error.message);
      return;
    }
    this.error.set(null);
    this.setPedidos((data ?? []) as PedidoFila[]);
  }

  /**
   * Cambia el estado de envío de un pedido. Solo toca las columnas de despacho:
   * el estado de pago sigue en manos de Bold. Devuelve el mensaje de error, o null.
   */
  async actualizarEnvio(o: Order, shipping: string, guia: string | null): Promise<string | null> {
    const envio = SHIPPING_A_ENVIO[shipping];
    if (!envio) return 'Estado de envío desconocido';
    const ahora = new Date().toISOString();
    const cambios: Record<string, string | null> = { envio_estado: envio, guia: guia?.trim() || null };
    // Las fechas se fijan la primera vez que el pedido llega a cada paso y se
    // borran si vuelve a uno anterior, para que la línea de tiempo no mienta.
    if (envio === 'preparando') { cambios['enviado_en'] = null; cambios['entregado_en'] = null; }
    if (envio === 'enviado')    { if (!o.enviadoEn) cambios['enviado_en'] = ahora; cambios['entregado_en'] = null; }
    if (envio === 'entregado')  { if (!o.enviadoEn) cambios['enviado_en'] = ahora; if (!o.entregadoEn) cambios['entregado_en'] = ahora; }

    const { error } = await this.sb.db.from('pedidos').update(cambios).eq('id', o.dbId);
    if (error) return error.message;
    await this.cargar();
    return null;
  }

  private setPedidos(filas: PedidoFila[]): void {
    const { orders, customers, payments } = mapearPedidos(filas);
    this.orders.set(orders);
    this.customers.set(customers);
    this.payments.set(payments);
  }

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
    cancelled: { tone: '',     label: 'Cancelado'    },
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
