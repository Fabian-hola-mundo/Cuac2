import { Component, computed, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminStateService, ViewId } from '../../core/services/admin-state.service';

interface Character { id: string; name: string; region: string; color: string; accent: string; }
interface Category  { id: string; label: string; }
interface Product   { id: string; sku: string; name: string; category: string; character: string; price: number; stock: number; status: string; flag: string | null; color: string; updated: string; }
interface Order     { id: string; customer: string; email: string; items: number; total: number; status: string; shipping: string; date: string; city: string; method: string; }
interface Customer  { id: string; name: string; email: string; city: string; orders: number; spent: number; last: string; tag: string; }
interface Payment   { id: string; order: string; date: string; method: string; amount: number; fee: number; net: number; status: string; }
interface ToneStyle { bg: string; fg: string; }

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-home.component.html',
  styleUrl: './admin-home.component.scss',
})
export class AdminHomeComponent implements OnDestroy {

  private adminState = inject(AdminStateService);

  // ── Navigation ─────────────────────────────────────────────────────────────
  view = this.adminState.view;

  // ── Drawer states ──────────────────────────────────────────────────────────
  editorOn       = signal(false);
  orderOn        = signal(false);
  manualOrderOn  = signal(false);
  editingProduct = signal<Product | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────
  toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  // ── Pedido manual ──────────────────────────────────────────────────────────
  moClienteNombre    = '';
  moClienteEmail     = '';
  moClienteTel       = '';
  moClienteCiudad    = '';
  moClienteDireccion = '';
  moMetodo           = 'efectivo';
  moCanal            = 'web';
  moNotas            = '';
  moProductSearch    = '';
  moItems            = signal<{ id: string; name: string; price: number; qty: number }[]>([]);

  moProductosFiltrados = computed(() => {
    const q = this.moProductSearch.toLowerCase().trim();
    if (!q) return this.PRODUCTS.slice(0, 6);
    return this.PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 8);
  });

  moSubtotal = computed(() =>
    this.moItems().reduce((acc, i) => acc + i.price * i.qty, 0)
  );

  moTotal = computed(() => this.moSubtotal());

  // ── Filters ───────────────────────────────────────────────────────────────
  productCat   = signal('all');
  productQuery = signal('');
  orderTab     = signal('all');

  // ── Product editor form ────────────────────────────────────────────────────
  editorName      = '';
  editorSku       = '';
  editorCategory  = 'tee';
  editorCharacter = 'cuac';
  editorPrice     = '';
  editorStock     = '';
  editorStatus    = 'draft';
  editorDesc      = 'Tirada corta. Hecho en Bogotá con algodón colombiano y tintas a base de agua. Cada pieza viene firmada por el ilustrador.';
  editorSizes: string[]  = ['S', 'M', 'L'];
  editorColors: string[] = ['#ECEFF3', '#151F28'];
  editorImages: number[] = [0, 1, 2];

  readonly COLOR_OPTS = ['#ECEFF3','#151F28','#E8623D','#FFC93C','#2A6FDB','#1F8A5B','#FF6FA8','#8B6FD8'];

  readonly GATEWAYS: { name: string; state: string; tone: string; fee: string; count: number; color: string }[] = [
    { name: 'Bold',            state: 'Conectado', tone: 'ok',   fee: '3.0% + $300', count: 64, color: 'rio'   },
    { name: 'PSE',             state: 'Conectado', tone: 'ok',   fee: '1.99%',       count: 22, color: 'selva' },
    { name: 'Nequi',           state: 'Conectado', tone: 'ok',   fee: '1.0%',        count: 12, color: 'rosa'  },
    { name: 'Contra-entrega',  state: 'Manual',    tone: 'warn', fee: '—',           count: 4,  color: 'sol'   },
  ];

  // ── Static data ────────────────────────────────────────────────────────────
  readonly CHARACTERS: Character[] = [
    { id: 'cuac',       name: 'Cuac',       region: 'Migratorio · CA',   color: 'rio',   accent: '#2A6FDB' },
    { id: 'yeison',     name: 'Yeison',     region: 'Llanos · Casanare', color: 'sol',   accent: '#B07820' },
    { id: 'roar',       name: 'Roar',       region: 'Andes · Boyacá',    color: 'bone',  accent: '#151F28' },
    { id: 'kiki',       name: 'Kiki',       region: 'Amazonas · Leticia',color: 'rosa',  accent: '#FF6FA8' },
    { id: 'abejandro',  name: 'Abejandro',  region: 'Cundinamarca',      color: 'terra', accent: '#E8623D' },
    { id: 'atolita',    name: 'Atolita',    region: 'Pacífico · Chocó',  color: 'lila',  accent: '#8B6FD8' },
    { id: 'colibriana', name: 'Colibriana', region: 'Eje cafetero',      color: 'selva', accent: '#1F8A5B' },
    { id: 'tiburcio',   name: 'Tiburcio',   region: 'Caribe · BAQ',      color: 'cream', accent: '#2E8FB8' },
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

  readonly SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  readonly PRODUCTS: Product[] = [
    { id: 'CQV-0042', sku: 'TEE-CUAC-EXP', name: 'El explorador soñador',       category: 'tee',     character: 'cuac',       price: 89000,  stock: 64,  status: 'active', flag: 'Drop semana', color: 'rio',   updated: 'Hace 2h' },
    { id: 'CQV-0041', sku: 'PIN-KIKI-001', name: 'Kiki la delfín',               category: 'pin',     character: 'kiki',       price: 22000,  stock: 180, status: 'active', flag: 'Nuevo',       color: 'rosa',  updated: 'Hace 5h' },
    { id: 'CQV-0040', sku: 'TOT-YEI-001', name: 'Yeison al río',                 category: 'tote',    character: 'yeison',     price: 54000,  stock: 22,  status: 'active', flag: null,          color: 'sol',   updated: 'Ayer' },
    { id: 'CQV-0039', sku: 'LIB-ROAR-A5', name: 'Diario de páramo',              category: 'libreta', character: 'roar',       price: 48000,  stock: 6,   status: 'low',    flag: null,          color: 'bone',  updated: 'Hace 3d' },
    { id: 'CQV-0038', sku: 'PEL-TIB-28',  name: 'Tiburcio el vacilón',           category: 'peluche', character: 'tiburcio',   price: 148000, stock: 12,  status: 'active', flag: 'Ed. 200',     color: 'cream', updated: 'Hace 1d' },
    { id: 'CQV-0037', sku: 'STK-ABE-PK',  name: 'Pack stickers Abejandro',       category: 'sticker', character: 'abejandro',  price: 18000,  stock: 240, status: 'active', flag: null,          color: 'terra', updated: 'Hace 4d' },
    { id: 'CQV-0036', sku: 'POS-COL-A2',  name: 'Vuelo de colibrí · A2',         category: 'poster',  character: 'colibriana', price: 38000,  stock: 0,   status: 'out',    flag: 'Agotado',     color: 'selva', updated: 'Hace 6d' },
    { id: 'CQV-0035', sku: 'TZA-ATO-001', name: 'Taza marimbera',                 category: 'taza',    character: 'atolita',    price: 36000,  stock: 48,  status: 'draft',  flag: 'Borrador',    color: 'lila',  updated: 'Hace 1s' },
    { id: 'CQV-0034', sku: 'TEE-KIK-RIO', name: 'Camiseta del río rosado',        category: 'tee',     character: 'kiki',       price: 92000,  stock: 38,  status: 'active', flag: null,          color: 'rosa',  updated: 'Hace 1s' },
    { id: 'CQV-0033', sku: 'LIB-CUA-A6',  name: 'Bitácora migratoria · A6',       category: 'libreta', character: 'cuac',       price: 32000,  stock: 92,  status: 'active', flag: null,          color: 'rio',   updated: 'Hace 2s' },
  ];

  readonly ORDERS: Order[] = [
    { id: '#CQ-2814', customer: 'Mariana Restrepo',      email: 'mariana.r@gmail.com',      items: 3, total: 159000, status: 'paid',     shipping: 'pending',   date: '2026-05-15 14:22', city: 'Medellín',     method: 'Bold · Tarjeta' },
    { id: '#CQ-2813', customer: 'Jhon Sebastián López',  email: 'jslopez@correo.co',         items: 1, total: 89000,  status: 'paid',     shipping: 'shipped',   date: '2026-05-15 11:08', city: 'Bogotá',       method: 'PSE' },
    { id: '#CQ-2812', customer: 'Diana Cárdenas',        email: 'diana@studio.co',           items: 5, total: 312000, status: 'paid',     shipping: 'delivered', date: '2026-05-14 19:44', city: 'Cali',         method: 'Bold · Tarjeta' },
    { id: '#CQ-2811', customer: 'Carolina Mejía',        email: 'caro.mejia@outlook.com',    items: 2, total: 110000, status: 'pending',  shipping: 'pending',   date: '2026-05-14 16:30', city: 'Bucaramanga',  method: 'Contra-entrega' },
    { id: '#CQ-2810', customer: 'Andrés Quintero',       email: 'a.quintero@gmail.com',      items: 1, total: 148000, status: 'paid',     shipping: 'shipped',   date: '2026-05-14 10:12', city: 'Barranquilla', method: 'Nequi' },
    { id: '#CQ-2809', customer: 'Laura Patiño',          email: 'lpatino@correo.co',         items: 4, total: 234000, status: 'refunded', shipping: 'returned',  date: '2026-05-13 09:01', city: 'Bogotá',       method: 'Bold · Tarjeta' },
    { id: '#CQ-2808', customer: 'Camilo Henao',          email: 'camihenao@gmail.com',       items: 2, total: 134000, status: 'paid',     shipping: 'delivered', date: '2026-05-12 18:55', city: 'Manizales',    method: 'PSE' },
    { id: '#CQ-2807', customer: 'Valentina Ruiz',        email: 'valru@correo.co',           items: 3, total: 198000, status: 'failed',   shipping: 'pending',   date: '2026-05-12 15:20', city: 'Pereira',      method: 'Bold · Tarjeta' },
  ];

  readonly ORDER_DETAIL = {
    id: '#CQ-2814', date: '2026-05-15 14:22',
    customer: { name: 'Mariana Restrepo', email: 'mariana.r@gmail.com', phone: '+57 311 444 2891', since: 'Marzo 2026', orders: 4 },
    shipping:  { address: 'Cra 43A # 14-50, Apto 802', city: 'Medellín, Antioquia', zip: '050021', carrier: 'Servientrega', tracking: 'SVT-887412339' },
    items: [
      { sku: 'TEE-CUAC-EXP', name: 'El explorador soñador', variant: 'Talla M · Cream', qty: 1, price: 89000,  color: 'rio',   label: 'Cuac' },
      { sku: 'PIN-KIKI-001', name: 'Kiki la delfín',         variant: 'Único',           qty: 2, price: 22000,  color: 'rosa',  label: 'Kiki' },
      { sku: 'STK-ABE-PK',  name: 'Pack stickers Abejandro', variant: '5 stickers',     qty: 1, price: 18000,  color: 'terra', label: 'Abe'  },
    ],
    totals: { subtotal: 151000, shipping: 12000, discount: 4000, total: 159000 },
    timeline: [
      { time: '14:22', title: 'Orden creada',   desc: 'Cliente completó el checkout',                 state: 'done'   },
      { time: '14:22', title: 'Pago aprobado',  desc: 'Bold · Visa terminada en 4421 · $159.000',    state: 'done'   },
      { time: '15:01', title: 'En preparación', desc: 'Asignado al lote del lunes',                  state: 'active' },
      { time: '—',     title: 'Despacho',        desc: 'Pendiente · Servientrega',                   state: 'wait'   },
      { time: '—',     title: 'Entrega',          desc: 'Estimado 18 mayo',                           state: 'wait'   },
    ],
  };

  readonly CUSTOMERS: Customer[] = [
    { id: 'C-401', name: 'Mariana Restrepo',     email: 'mariana.r@gmail.com',    city: 'Medellín',     orders: 4, spent: 487000, last: 'Hoy',       tag: 'VIP'       },
    { id: 'C-389', name: 'Diana Cárdenas',       email: 'diana@studio.co',        city: 'Cali',         orders: 7, spent: 982000, last: 'Ayer',      tag: 'VIP'       },
    { id: 'C-377', name: 'Jhon Sebastián López', email: 'jslopez@correo.co',      city: 'Bogotá',       orders: 2, spent: 178000, last: 'Hoy',       tag: 'Activo'    },
    { id: 'C-365', name: 'Camilo Henao',         email: 'camihenao@gmail.com',    city: 'Manizales',    orders: 3, spent: 268000, last: 'Hace 3d',   tag: 'Activo'    },
    { id: 'C-358', name: 'Laura Patiño',         email: 'lpatino@correo.co',      city: 'Bogotá',       orders: 1, spent: 0,      last: 'Hace 2s',   tag: 'Devolución'},
    { id: 'C-341', name: 'Andrés Quintero',      email: 'a.quintero@gmail.com',   city: 'Barranquilla', orders: 2, spent: 196000, last: 'Hace 1d',   tag: 'Activo'    },
    { id: 'C-329', name: 'Valentina Ruiz',       email: 'valru@correo.co',        city: 'Pereira',      orders: 1, spent: 0,      last: 'Hace 4d',   tag: 'Fallido'   },
    { id: 'C-318', name: 'Carolina Mejía',       email: 'caro.mejia@outlook.com', city: 'Bucaramanga',  orders: 5, spent: 412000, last: 'Hace 1d',   tag: 'Activo'    },
  ];

  readonly PAYMENTS: Payment[] = [
    { id: 'PAY-09812', order: '#CQ-2814', date: '2026-05-15 14:22', method: 'Bold · Visa •4421',        amount: 159000, fee: 4770, net: 154230,  status: 'paid'     },
    { id: 'PAY-09811', order: '#CQ-2813', date: '2026-05-15 11:08', method: 'PSE · Bancolombia',         amount: 89000,  fee: 1780, net: 87220,   status: 'paid'     },
    { id: 'PAY-09810', order: '#CQ-2812', date: '2026-05-14 19:44', method: 'Bold · Mastercard •8812',   amount: 312000, fee: 9360, net: 302640,  status: 'paid'     },
    { id: 'PAY-09809', order: '#CQ-2811', date: '2026-05-14 16:30', method: 'Contra-entrega',            amount: 110000, fee: 0,    net: 110000,  status: 'pending'  },
    { id: 'PAY-09808', order: '#CQ-2810', date: '2026-05-14 10:12', method: 'Nequi',                     amount: 148000, fee: 1480, net: 146520,  status: 'paid'     },
    { id: 'PAY-09807', order: '#CQ-2809', date: '2026-05-13 09:01', method: 'Bold · Visa •2210',         amount: 234000, fee: 7020, net: -234000, status: 'refunded' },
    { id: 'PAY-09806', order: '#CQ-2808', date: '2026-05-12 18:55', method: 'PSE · Davivienda',          amount: 134000, fee: 2680, net: 131320,  status: 'paid'     },
    { id: 'PAY-09805', order: '#CQ-2807', date: '2026-05-12 15:20', method: 'Bold · Visa •7723',         amount: 198000, fee: 0,    net: 0,       status: 'failed'   },
  ];

  // ── Design tokens ──────────────────────────────────────────────────────────
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

  // ── Computed ───────────────────────────────────────────────────────────────
  filteredProducts = computed(() => {
    const cat = this.productCat();
    const q   = this.productQuery().toLowerCase();
    return this.PRODUCTS.filter(p =>
      (cat === 'all' || p.category === cat) &&
      (q === '' || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    );
  });

  ordersByTab = computed(() => ({
    all:     this.ORDERS,
    paid:    this.ORDERS.filter(o => o.status === 'paid'),
    pending: this.ORDERS.filter(o => o.status === 'pending'),
    shipped: this.ORDERS.filter(o => o.shipping === 'shipped'),
    issues:  this.ORDERS.filter(o => o.status === 'failed' || o.status === 'refunded'),
  }));

  currentOrders = computed(() => {
    const buckets = this.ordersByTab();
    const tab = this.orderTab() as keyof typeof buckets;
    return buckets[tab] ?? this.ORDERS;
  });

  // ── Dashboard chart ────────────────────────────────────────────────────────
  readonly BARS = [42, 58, 36, 71, 95, 64, 88, 102, 76, 124, 158, 142, 187, 220];
  readonly DAYS = ['L 02','M 03','M 04','J 05','V 06','S 07','D 08','L 09','M 10','M 11','J 12','V 13','S 14','D 15'];
  readonly MAX_BAR = Math.max(...[42, 58, 36, 71, 95, 64, 88, 102, 76, 124, 158, 142, 187, 220]);

  barHeight(b: number): number { return (b / this.MAX_BAR) * 100; }

  // ── Methods ────────────────────────────────────────────────────────────────
  go(v: ViewId, opts: { newProduct?: boolean; detail?: boolean } = {}) {
    this.view.set(v);
    if (opts.newProduct) { this.initEditorForm(null); this.editorOn.set(true); }
    if (opts.detail)     { this.orderOn.set(true); }
  }

  openEditor(p: Product | null) {
    this.editingProduct.set(p);
    this.initEditorForm(p);
    this.editorOn.set(true);
  }

  closeEditor() { this.editorOn.set(false); }

  saveEditor() {
    this.editorOn.set(false);
    this.flash(this.editingProduct() ? '✓ Producto actualizado' : '✓ Producto creado');
  }

  openOrder() { this.orderOn.set(true); }
  closeOrder() { this.orderOn.set(false); }

  openManualOrder() {
    this.moClienteNombre    = '';
    this.moClienteEmail     = '';
    this.moClienteTel       = '';
    this.moClienteCiudad    = '';
    this.moClienteDireccion = '';
    this.moMetodo           = 'efectivo';
    this.moCanal            = 'web';
    this.moNotas            = '';
    this.moProductSearch    = '';
    this.moItems.set([]);
    this.manualOrderOn.set(true);
  }

  closeManualOrder() { this.manualOrderOn.set(false); }

  moAddProduct(p: Product) {
    this.moItems.update(items => {
      const existing = items.find(i => i.id === p.id);
      if (existing) {
        return items.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...items, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  }

  moRemoveItem(id: string) {
    this.moItems.update(items => items.filter(i => i.id !== id));
  }

  moChangeQty(id: string, delta: number) {
    this.moItems.update(items =>
      items.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    );
  }

  moCrear() {
    if (this.moItems().length === 0 || !this.moClienteNombre.trim()) return;
    this.closeManualOrder();
    this.flash('Pedido manual creado.');
  }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }

  initEditorForm(p: Product | null) {
    this.editorName      = p?.name     ?? '';
    this.editorSku       = p?.sku      ?? '';
    this.editorCategory  = p?.category ?? 'tee';
    this.editorCharacter = p?.character?? 'cuac';
    this.editorPrice     = p?.price    != null ? String(p.price)  : '';
    this.editorStock     = p?.stock    != null ? String(p.stock)  : '';
    this.editorStatus    = p?.status   ?? 'draft';
    this.editorDesc      = 'Tirada corta. Hecho en Bogotá con algodón colombiano y tintas a base de agua. Cada pieza viene firmada por el ilustrador.';
    this.editorSizes     = ['S', 'M', 'L'];
    this.editorColors    = ['#ECEFF3', '#151F28'];
    this.editorImages    = [0, 1, 2];
  }

  toggleSize(s: string)  { this._toggle(this.editorSizes, s); }
  toggleColor(c: string) { this._toggle(this.editorColors, c); }
  private _toggle(arr: string[], v: string) {
    const i = arr.indexOf(v);
    i > -1 ? arr.splice(i, 1) : arr.push(v);
  }

  removeImage(idx: number) { this.editorImages.splice(idx, 1); }
  addImage()               { if (this.editorImages.length < 8) this.editorImages.push(this.editorImages.length); }

  fmtCOP(n: number): string {
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('es-CO');
  }

  tone(key: string): ToneStyle  { return this.TONE[key] ?? this.TONE['cream']; }
  sb(s: string): { tone: string; label: string } { return this.STATUS_BADGE[s] ?? { tone: '', label: s }; }

  char(id: string): Character { return this.CHARACTERS.find(c => c.id === id) ?? this.CHARACTERS[0]; }
  cat(id: string):  Category  { return this.CATEGORIES.find(c => c.id === id) ?? this.CATEGORIES[0]; }

  prodCountForCat(catId: string) { return this.PRODUCTS.filter(p => p.category === catId).length; }
  prodCountForChar(charId: string) { return this.PRODUCTS.filter(p => p.character === charId).length; }

  get editorSlug(): string { return this.editorName.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''); }
  get editorVariants(): number { return this.editorSizes.length * this.editorColors.length; }

  initials(name: string, n = 2): string {
    return name.split(' ').map(s => s[0] ?? '').slice(0, n).join('').toUpperCase();
  }

  stockColor(stock: number): string {
    if (stock === 0) return 'var(--terra)';
    if (stock < 10)  return '#B07820';
    return 'var(--carbon)';
  }

  ngOnDestroy() { if (this.toastTimer) clearTimeout(this.toastTimer); }
}
