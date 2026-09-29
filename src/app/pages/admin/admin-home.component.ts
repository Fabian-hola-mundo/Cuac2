import { Component, computed, signal, inject, OnDestroy, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AdminStateService, ViewId } from '../../core/services/admin-state.service';
import { MockAdminDataService, Customer, Order, Payment, Product, Character, Category, ToneStyle } from '../../core/services/mock-admin-data.service';
import { GoogleAnalyticsService, GaPageView, GaPortfolioView } from '../../core/services/google-analytics.service';
import { ClienteDetailComponent } from './clientes/cliente-detail.component';
import { PagoDetailComponent }    from './pagos/pago-detail.component';
import { PagosExportService }    from './pagos/pagos-export.service';
import { DescuentosTabComponent } from './descuentos/descuentos-tab.component';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ClienteDetailComponent, PagoDetailComponent, DescuentosTabComponent],
  templateUrl: './admin-home.component.html',
  styleUrl: './admin-home.component.scss',
})
export class AdminHomeComponent implements OnInit, OnDestroy {

  private adminState  = inject(AdminStateService);
  private data        = inject(MockAdminDataService);
  private ga          = inject(GoogleAnalyticsService);
  private exportSvc   = inject(PagosExportService);
  private router      = inject(Router);

  // ── Navigation ─────────────────────────────────────────────────────────────
  view = this.adminState.view;

  // ── Drawer states ──────────────────────────────────────────────────────────
  editorOn       = signal(false);
  orderOn        = signal(false);
  manualOrderOn  = signal(false);
  editingProduct = signal<Product | null>(null);

  // ── Export dropdown ────────────────────────────────────────────────────────
  exportOpen = signal(false);

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
  moEstado           = 'pendiente';
  moReferencia       = '';
  moEnvio            = signal(0);
  moDescuento        = signal(0);
  moItems            = signal<{ id: string; name: string; sku: string; price: number; qty: number; variant: string }[]>([]);

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

  moTotal = computed(() => this.moSubtotal() + this.moEnvio() - this.moDescuento());

  // ── Filters ───────────────────────────────────────────────────────────────
  productCat      = signal('all');
  productQuery    = signal('');
  orderTab        = signal('all');
  pedidosSubTab   = signal<'pedidos' | 'descuentos'>('pedidos');

  // ── Product editor form ────────────────────────────────────────────────────
  editorName      = '';
  editorSku       = '';
  editorCategory  = 'tee';
  editorCharacter = 'cuac';
  editorPrice     = '';
  editorStock     = '';
  editorStatus    = 'draft';
  editorDesc      = '';
  editorSizes: string[]  = ['S', 'M', 'L'];
  editorColors: string[] = ['#ECEFF3', '#151F28'];
  editorImages: number[] = [0, 1, 2];

  readonly COLOR_OPTS = ['#ECEFF3','#151F28','#E8623D','#FFC93C','#2A6FDB','#1F8A5B','#FF6FA8','#8B6FD8'];

  // ── Data from service ─────────────────────────────────────────────────────
  readonly CHARACTERS  = this.data.CHARACTERS;
  readonly CATEGORIES  = this.data.CATEGORIES;
  readonly PRODUCTS    = this.data.PRODUCTS;
  readonly ORDERS      = this.data.ORDERS;
  readonly CUSTOMERS   = this.data.CUSTOMERS;
  readonly PAYMENTS    = this.data.PAYMENTS;
  readonly SIZES       = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  readonly gaLoading    = signal(true);
  readonly gaConfigured = signal(false);
  readonly gaError      = signal<string | undefined>(undefined);
  readonly PAGE_VIEWS      = signal<GaPageView[]>([]);
  readonly PORTFOLIO_VIEWS = signal<GaPortfolioView[]>([]);

  @HostListener('document:click')
  onDocClick() {
    this.exportOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onExportEscape() {
    this.exportOpen.set(false);
  }

  async ngOnInit() {
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 60_000);

    const report = await this.ga.getReport();
    this.gaConfigured.set(report.configured);
    this.gaError.set(report.fetchError);
    this.PAGE_VIEWS.set(report.pages);
    this.PORTFOLIO_VIEWS.set(report.portfolios);
    this.gaLoading.set(false);
  }

  /** Pasarelas con el número de pagos reales que pasaron por cada una. */
  readonly GATEWAYS: { name: string; state: string; tone: string; count: number; color: string }[] = [
    { name: 'Bold',           state: 'Conectado', tone: 'ok',   color: 'rio'   },
    { name: 'PSE',            state: 'Vía Bold',  tone: 'ok',   color: 'selva' },
    { name: 'Nequi',          state: 'Vía Bold',  tone: 'ok',   color: 'rosa'  },
    { name: 'Contra-entrega', state: 'Manual',    tone: 'warn', color: 'sol'   },
  ].map(g => ({
    ...g,
    count: this.data.PAYMENTS.filter(p => p.method.toLowerCase().startsWith(g.name.toLowerCase())).length,
  }));

  // ── Live clock & greeting ──────────────────────────────────────────────────
  nowTime     = signal('');
  nowDatetime = signal('');
  nowGreeting = signal('Hola');
  private clockTimer?: ReturnType<typeof setInterval>;

  private updateClock(): void {
    const now = new Date();
    const h   = now.getHours();
    this.nowGreeting.set(h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches');
    this.nowTime.set(now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }));
    this.nowDatetime.set(now.toISOString());
  }

  // ── Detalle del pedido seleccionado ────────────────────────────────────────
  selectedOrder = signal<Order | null>(null);

  readonly orderCustomer = computed(() => {
    const o = this.selectedOrder();
    return o ? this.data.getCustomer(o.customerId) ?? null : null;
  });

  readonly orderPayment = computed(() => {
    const o = this.selectedOrder();
    return o ? this.data.getPaymentByOrder(o.id) ?? null : null;
  });

  /** Línea de tiempo derivada del estado real de pago y envío del pedido. */
  readonly orderTimeline = computed<{ time: string; title: string; desc: string; state: string }[]>(() => {
    const o = this.selectedOrder();
    if (!o) return [];

    const hora = o.date.slice(11) || '—';
    const rows = [
      { time: hora, title: 'Orden creada', desc: 'Cliente completó el checkout', state: 'done' },
    ];

    const pay = this.orderPayment();
    const monto = this.fmtCOP(o.total);
    switch (o.status) {
      case 'paid':
        rows.push({ time: hora, title: 'Pago aprobado', desc: `${o.method} · ${monto}`, state: 'done' });
        break;
      case 'pending':
        rows.push({ time: '—', title: 'Pago pendiente', desc: `${o.method} · ${monto}`, state: 'active' });
        break;
      case 'failed':
        rows.push({ time: hora, title: 'Pago rechazado', desc: `${o.method} · ${monto}`, state: 'done' });
        break;
      case 'refunded':
        rows.push({ time: hora, title: 'Pago aprobado', desc: `${o.method} · ${monto}`, state: 'done' });
        rows.push({ time: pay?.date.slice(11) ?? '—', title: 'Reembolso emitido', desc: `Devolución de ${monto}`, state: 'done' });
        break;
    }

    if (o.status === 'paid' || o.status === 'refunded') {
      switch (o.shipping) {
        case 'pending':
          rows.push({ time: '—', title: 'En preparación', desc: 'Pendiente de despacho', state: 'active' });
          break;
        case 'shipped':
          rows.push({ time: '—', title: 'Despachado', desc: `En camino a ${o.city}`, state: 'done' });
          rows.push({ time: '—', title: 'Entrega', desc: 'Pendiente de confirmación', state: 'wait' });
          break;
        case 'delivered':
          rows.push({ time: '—', title: 'Despachado', desc: `Enviado a ${o.city}`, state: 'done' });
          rows.push({ time: '—', title: 'Entregado', desc: `Recibido en ${o.city}`, state: 'done' });
          break;
        case 'returned':
          rows.push({ time: '—', title: 'Devuelto', desc: 'El pedido regresó a bodega', state: 'done' });
          break;
      }
    }

    return rows;
  });

  fmtSince(iso: string): string { return this.data.fmtSince(iso); }

  // ── Drawer signals para Cliente y Pago ─────────────────────────────────────
  clienteId = signal<string | null>(null);
  pagoId    = signal<string | null>(null);

  openCliente(id: string) { this.clienteId.set(id); }
  closeCliente()          { this.clienteId.set(null); }
  openPago(id: string)    { this.pagoId.set(id); }
  closePago()             { this.pagoId.set(null); }

  // ── Export helpers ─────────────────────────────────────────────────────────
  toggleExport() {
    this.exportOpen.update(v => !v);
  }

  filterPayments(rango: string): Payment[] {
    const hoy = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const mesActual = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}`;
    const prevMonth = hoy.getMonth() === 0 ? 11 : hoy.getMonth() - 1;
    const prevYear  = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
    const mesPasado = `${prevYear}-${pad(prevMonth + 1)}`;
    const hace90 = new Date(hoy.getTime() - 90 * 24 * 60 * 60 * 1000);

    switch (rango) {
      case 'mes':        return this.PAYMENTS.filter(p => p.date.substring(0, 7) === mesActual);
      case 'mes-pasado': return this.PAYMENTS.filter(p => p.date.substring(0, 7) === mesPasado);
      case '3meses':     return this.PAYMENTS.filter(p => new Date(p.date) >= hace90);
      default:           return [...this.PAYMENTS];
    }
  }

  periodoSlug(rango: string): string {
    const hoy = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const mesActualSlug = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}`;
    const prevMonth = hoy.getMonth() === 0 ? 11 : hoy.getMonth() - 1;
    const prevYear  = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
    const mesPasadoSlug = `${prevYear}-${pad(prevMonth + 1)}`;
    switch (rango) {
      case 'mes':        return mesActualSlug;
      case 'mes-pasado': return mesPasadoSlug;
      case '3meses':     return `${mesActualSlug}-3m`;
      default:           return 'todo';
    }
  }

  periodoLabel(rango: string): string {
    const hoy = new Date();
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    switch (rango) {
      case 'mes':
        return `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`;
      case 'mes-pasado': {
        const m = hoy.getMonth() === 0 ? 11 : hoy.getMonth() - 1;
        const y = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
        return `${MESES[m]} ${y}`;
      }
      case '3meses': return 'Últimos 3 meses';
      default:       return 'Historial completo';
    }
  }

  descargarContador(rango: string) {
    const pagos = this.filterPayments(rango);
    this.exportSvc.exportCsv(pagos, this.periodoSlug(rango));
    this.exportOpen.set(false);
    this.flash(`✓ Exportado · ${pagos.length} movimientos · ${this.periodoLabel(rango)}`);
  }

  descargarReporte(rango: string) {
    const pagos = this.filterPayments(rango);
    this.exportSvc.exportXlsx(pagos, this.periodoSlug(rango));
    this.exportOpen.set(false);
    this.flash(`✓ Exportado · ${pagos.length} movimientos · ${this.periodoLabel(rango)}`);
  }

  // ── KPI computados desde el servicio ────────────────────────────────────────
  readonly kpiIngresos7d  = computed(() => this.data.totalIngresos7d());
  readonly kpiPedidos7d   = computed(() => this.data.totalPedidos7d());
  readonly kpiClientes7d  = computed(() => this.data.clientesNuevos7d());
  readonly kpiTicket7d    = computed(() => this.data.ticketPromedio7d());

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

  // ── KPI de clientes y pagos, calculados desde los registros reales ─────────
  readonly lowStockCount = this.PRODUCTS.filter(p => p.status === 'low' || (p.stock > 0 && p.stock < 10)).length;
  readonly pendingShipCount = this.ORDERS.filter(o => o.status === 'paid' && o.shipping === 'pending').length;

  readonly customersByTag = {
    vip:     this.CUSTOMERS.filter(c => c.tag === 'VIP').length,
    activos: this.CUSTOMERS.filter(c => c.tag === 'Activo').length,
    issues:  this.CUSTOMERS.filter(c => c.tag === 'Devolución' || c.tag === 'Fallido').length,
  };
  readonly kpiVip = this.CUSTOMERS.filter(c => c.orders >= 3).length;
  readonly kpiGastoPromedio = this.CUSTOMERS.length
    ? Math.round(this.CUSTOMERS.reduce((s, c) => s + c.spent, 0) / this.CUSTOMERS.length)
    : 0;

  private readonly paymentsMes = this.filterPayments('mes');
  readonly kpiNetoMes     = this.paymentsMes.filter(p => p.status === 'paid').reduce((s, p) => s + p.net, 0);
  readonly kpiComisiones  = this.paymentsMes.filter(p => p.status === 'paid').reduce((s, p) => s + p.fee, 0);
  readonly kpiPendiente   = this.PAYMENTS.filter(p => p.status === 'pending');
  readonly kpiReembolsos  = this.paymentsMes.filter(p => p.status === 'refunded');
  sumAmount(list: Payment[]): number { return list.reduce((s, p) => s + p.amount, 0); }

  // ── Dashboard chart: ingresos pagados de los últimos 14 días ───────────────
  private readonly chartDays = (() => {
    const DOW = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    const pad = (n: number) => String(n).padStart(2, '0');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const days: { key: string; label: string; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - i);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      days.push({ key, label: `${DOW[d.getDay()]} ${pad(d.getDate())}`, total: 0 });
    }
    for (const o of this.ORDERS) {
      if (o.status !== 'paid') continue;
      const day = days.find(x => x.key === o.date.slice(0, 10));
      if (day) day.total += o.total;
    }
    return days;
  })();

  /** Ingresos por día, en miles de COP. */
  readonly BARS = this.chartDays.map(d => Math.round(d.total / 1000));
  readonly DAYS = this.chartDays.map(d => d.label);
  readonly MAX_BAR = Math.max(0, ...this.BARS);
  readonly hasChartData = this.MAX_BAR > 0;

  /** Marcas del eje Y (de mayor a menor), en miles de COP. */
  readonly Y_TICKS = [1, 0.75, 0.5, 0.25, 0].map(f => Math.round(this.MAX_BAR * f));

  readonly bestDay = (() => {
    if (!this.hasChartData) return null;
    const i = this.BARS.indexOf(this.MAX_BAR);
    return { label: this.DAYS[i], value: this.MAX_BAR };
  })();

  readonly avgDaily = Math.round(this.BARS.reduce((s, b) => s + b, 0) / this.BARS.length);

  barHeight(b: number): number { return this.MAX_BAR > 0 ? (b / this.MAX_BAR) * 100 : 0; }

  trendPoints(): string {
    const n = this.BARS.length;
    return this.BARS.map((b, i) => {
      const x = ((i + 0.5) / n) * 100;
      const y = 100 - this.barHeight(b);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  trendArea(): string {
    const n = this.BARS.length;
    const pts = this.BARS.map((b, i) => {
      const x = ((i + 0.5) / n) * 100;
      const y = 100 - this.barHeight(b);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `0,100 ${pts} 100,100`;
  }

  // ── Methods ────────────────────────────────────────────────────────────────
  go(v: ViewId, opts: { newProduct?: boolean } = {}) {
    this.view.set(v);
    if (opts.newProduct) { this.initEditorForm(null); this.editorOn.set(true); }
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

  openOrder(o: Order) { this.selectedOrder.set(o); this.orderOn.set(true); }
  closeOrder() { this.orderOn.set(false); this.selectedOrder.set(null); }

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
    this.moEstado           = 'pendiente';
    this.moReferencia       = '';
    this.moEnvio.set(0);
    this.moDescuento.set(0);
    this.moItems.set([]);
    this.manualOrderOn.set(true);
  }

  closeManualOrder() { this.manualOrderOn.set(false); }

  nuevoEvento() {
    this.router.navigate(['/admin/eventos'], { state: { abrirNuevo: true } });
  }

  moAddProduct(p: Product) {
    this.moItems.update(items => {
      const existing = items.find(i => i.id === p.id);
      if (existing) {
        return items.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...items, { id: p.id, name: p.name, sku: p.sku, price: p.price, qty: 1, variant: '' }];
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
    this.flash(`Pedido creado · ${this.fmtCOP(this.moTotal())}`);
  }

  moUpdatePrice(id: string, price: number) {
    this.moItems.update(items =>
      items.map(i => i.id === id ? { ...i, price: isNaN(price) || price < 0 ? 0 : price } : i)
    );
  }

  moUpdateVariant(id: string, variant: string) {
    this.moItems.update(items =>
      items.map(i => i.id === id ? { ...i, variant } : i)
    );
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
    this.editorDesc      = '';
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

  fmtViews(n: number): string { return n.toLocaleString('es-CO'); }

  fmtDelta(d: number): string { return (d > 0 ? '+' : '') + d.toFixed(1) + '%'; }

  /** Valor ya expresado en miles → "$220k". */
  fmtK(n: number): string { return '$' + n.toLocaleString('es-CO') + 'k'; }

  fmtCOP(n: number): string {
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('es-CO');
  }

  tone(key: string): ToneStyle  { return this.data.TONE[key] ?? this.data.TONE['cream']; }
  sb(s: string): { tone: string; label: string } { return this.data.STATUS_BADGE[s] ?? { tone: '', label: s }; }

  char(id: string): Character { return this.data.getCharacter(id); }
  cat(id: string):  Category  { return this.data.getCategory(id); }

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

  ngOnDestroy() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.clockTimer) clearInterval(this.clockTimer);
  }
}
