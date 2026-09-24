import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { Router }       from '@angular/router';
import { InventarioService, ProductoEvento, MovimientoProducto, CATEGORIAS, CAT_TONES } from '../../../core/services/inventario.service';
import { EventosService, Evento } from '../../../core/services/eventos.service';
import {
  EstadoFiltro,
  OrdenCampo,
  OrdenDir,
  UMBRAL_STOCK_BAJO,
  calcularKpis,
  contarPorEstado,
  filtrarProductos,
  ordenarProductos,
} from './productos-filtros';

const ESTADOS: { id: EstadoFiltro; label: string }[] = [
  { id: 'all',      label: 'Todos'     },
  { id: 'activo',   label: 'Activos'   },
  { id: 'inactivo', label: 'Ocultos'   },
  { id: 'bajo',     label: 'Stock bajo'},
  { id: 'agotado',  label: 'Agotados'  },
];

@Component({
  selector: 'app-productos-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productos-list.component.html',
  styleUrl: './productos-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class ProductosListComponent implements OnInit {
  private router     = inject(Router);
  readonly inv       = inject(InventarioService);
  private eventosSvc = inject(EventosService);

  readonly categorias   = CATEGORIAS;
  readonly estados      = ESTADOS;
  readonly umbralBajo   = UMBRAL_STOCK_BAJO;

  // ── Filtros y orden ───────────────────────────────────────────────────────
  readonly catFiltro    = signal<string>('all');
  readonly estadoFiltro = signal<EstadoFiltro>('all');
  readonly busqueda     = signal('');
  readonly ordenCampo   = signal<OrdenCampo>('creado_en');
  readonly ordenDir     = signal<OrdenDir>('desc');

  readonly categoriasConProductos = computed(() => {
    const usadas = new Set(this.inv.productos().map(p => p.categoria));
    return this.categorias.filter(c => usadas.has(c.id));
  });

  readonly kpis      = computed(() => calcularKpis(this.inv.productos()));
  readonly conteos   = computed(() => contarPorEstado(this.inv.productos()));

  readonly productosFiltrados = computed(() =>
    ordenarProductos(
      filtrarProductos(
        this.inv.productos(),
        { categoria: this.catFiltro(), estado: this.estadoFiltro(), busqueda: this.busqueda() },
        id => this.labelCategoria(id),
      ),
      this.ordenCampo(),
      this.ordenDir(),
    ),
  );

  readonly hayFiltroActivo = computed(() =>
    this.catFiltro() !== 'all' || this.estadoFiltro() !== 'all' || this.busqueda().trim() !== '',
  );

  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  // ── Evento ────────────────────────────────────────────────────────────────
  readonly eventoActivo   = signal<Evento | null>(null);
  readonly crearEventoOpen = signal(false);
  nuevoEventoNombre = '';
  readonly creando    = signal(false);
  readonly crearError = signal<string | null>(null);
  readonly finalizarOpen  = signal(false);
  readonly finalizando    = signal(false);
  readonly finalizarError = signal<string | null>(null);

  // ── Drawer ────────────────────────────────────────────────────────────────
  readonly drawerOpen    = signal(false);
  readonly drawerProduct = signal<ProductoEvento | null>(null);
  readonly historial         = signal<MovimientoProducto[]>([]);
  readonly historialCargando = signal(false);

  // ── Restock / ajuste ──────────────────────────────────────────────────────
  readonly restockOpen    = signal(false);
  readonly restockTarget  = signal<ProductoEvento | null>(null);
  restockCantidad: number | null = null;
  restockNota = '';
  readonly restockLoading = signal(false);
  readonly restockError   = signal<string | null>(null);

  readonly ajusteOpen    = signal(false);
  readonly ajusteTarget  = signal<ProductoEvento | null>(null);
  /** Señal, no propiedad: ajusteDelta se recalcula mientras se teclea. */
  readonly ajusteStock   = signal<number | null>(null);
  ajusteNota = '';
  readonly ajusteLoading = signal(false);
  readonly ajusteError   = signal<string | null>(null);

  readonly ajusteDelta = computed(() => {
    const p = this.ajusteTarget();
    const nuevo = this.ajusteStock();
    if (!p || nuevo === null) return 0;
    return nuevo - p.stock_actual;
  });

  /** Cualquier capa por encima de la página: bloquea el scroll de fondo. */
  readonly hayOverlay = computed(() =>
    this.drawerOpen() || this.crearEventoOpen() || this.finalizarOpen() ||
    this.restockOpen() || this.ajusteOpen(),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      document.body.style.overflow = this.hayOverlay() ? 'hidden' : '';
    });
    destroyRef.onDestroy(() => { document.body.style.overflow = ''; });
  }

  ngOnInit() {
    this.inv.cargarTodos();
    this.cargarEventoActivo();
  }

  /** Escape cierra la capa más superficial primero. */
  onEscape() {
    if (this.restockOpen())      { this.cerrarRestock(); return; }
    if (this.ajusteOpen())       { this.cerrarAjuste(); return; }
    if (this.crearEventoOpen())  { this.cerrarCrearEvento(); return; }
    if (this.finalizarOpen())    { this.cerrarFinalizarEvento(); return; }
    if (this.drawerOpen())       { this.cerrarDrawer(); }
  }

  private async cargarEventoActivo() {
    try {
      this.eventoActivo.set(await this.eventosSvc.getEventoActivo());
    } catch { /* no-op: la lista funciona sin evento */ }
  }

  // ── Navegación ────────────────────────────────────────────────────────────
  nuevo()     { this.router.navigate(['/admin/productos/nuevo']); }
  editar(p: ProductoEvento) { this.router.navigate(['/admin/productos', p.id, 'editar']); }
  verVentas() { this.router.navigate(['/admin/productos/ventas']); }

  // ── Orden ─────────────────────────────────────────────────────────────────
  ordenarPor(campo: OrdenCampo) {
    if (this.ordenCampo() === campo) {
      this.ordenDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.ordenCampo.set(campo);
    // Los textos se leen mejor de la A a la Z; los números, de mayor a menor.
    this.ordenDir.set(campo === 'nombre' ? 'asc' : 'desc');
  }

  ariaSort(campo: OrdenCampo): 'ascending' | 'descending' | 'none' {
    if (this.ordenCampo() !== campo) return 'none';
    return this.ordenDir() === 'asc' ? 'ascending' : 'descending';
  }

  limpiarFiltros() {
    this.catFiltro.set('all');
    this.estadoFiltro.set('all');
    this.busqueda.set('');
  }

  // ── Drawer ────────────────────────────────────────────────────────────────
  verDetalle(p: ProductoEvento, event: Event) {
    event.stopPropagation();
    this.drawerProduct.set(p);
    this.drawerOpen.set(true);
    this.cargarHistorial(p.id);
  }

  private async cargarHistorial(productoId: string) {
    this.historialCargando.set(true);
    try {
      this.historial.set(await this.inv.getHistorialProducto(productoId));
    } catch (err) {
      console.error('Error cargando historial:', err);
      this.historial.set([]);
    } finally {
      this.historialCargando.set(false);
    }
  }

  cerrarDrawer() { this.drawerOpen.set(false); }

  // ── Acciones de fila ──────────────────────────────────────────────────────
  async duplicar(p: ProductoEvento, event: Event) {
    event.stopPropagation();
    const { error, aviso } = await this.inv.duplicarProducto(p.id);
    this.flash(error ? `Error: ${error}` : (aviso ?? `"${p.nombre}" duplicado.`));
  }

  async toggleActivo(p: ProductoEvento, event: Event) {
    event.stopPropagation();
    const { error } = await this.inv.toggleActivo(p.id, !p.activo);
    // Antes el fallo era mudo: el botón no hacía nada y nadie sabía por qué.
    this.flash(error ? `Error: ${error}` : (p.activo ? 'Producto ocultado.' : 'Producto activado.'));
  }

  abrirRestock(p: ProductoEvento, event: Event) {
    event.stopPropagation();
    this.restockTarget.set(p);
    this.restockCantidad = null;
    this.restockNota = '';
    this.restockError.set(null);
    this.restockOpen.set(true);
  }

  cerrarRestock() { this.restockOpen.set(false); }

  async confirmarRestock() {
    const p = this.restockTarget();
    if (!p) return;
    const cantidad = this.restockCantidad;
    if (!cantidad || cantidad <= 0) {
      this.restockError.set('Ingresa una cantidad mayor a 0.');
      return;
    }
    this.restockLoading.set(true);
    this.restockError.set(null);
    const { error } = await this.inv.restockProducto(p.id, cantidad, this.restockNota.trim() || undefined);
    this.restockLoading.set(false);
    if (error) { this.restockError.set(error); return; }
    this.cerrarRestock();
    this.flash(`+${cantidad} unidades agregadas a "${p.nombre}".`);
    this.refrescarDrawer(p.id);
  }

  abrirAjuste(p: ProductoEvento, event: Event) {
    event.stopPropagation();
    this.ajusteTarget.set(p);
    this.ajusteStock.set(p.stock_actual);
    this.ajusteNota = '';
    this.ajusteError.set(null);
    this.ajusteOpen.set(true);
  }

  cerrarAjuste() { this.ajusteOpen.set(false); }

  async confirmarAjuste() {
    const p = this.ajusteTarget();
    if (!p) return;
    const nuevo = this.ajusteStock();
    if (nuevo === null || nuevo < 0 || !Number.isInteger(nuevo)) {
      this.ajusteError.set('Ingresa un número entero de 0 o más.');
      return;
    }
    // El ajuste corrige la realidad física del inventario: sin motivo escrito,
    // el historial no sirve para auditar después.
    if (!this.ajusteNota.trim()) {
      this.ajusteError.set('Explica el motivo del ajuste.');
      return;
    }
    if (nuevo === p.stock_actual) {
      this.ajusteError.set('El stock es el mismo; no hay nada que ajustar.');
      return;
    }
    this.ajusteLoading.set(true);
    this.ajusteError.set(null);
    const { error } = await this.inv.ajustarStock(p.id, nuevo, this.ajusteNota.trim());
    this.ajusteLoading.set(false);
    if (error) { this.ajusteError.set(error); return; }
    this.cerrarAjuste();
    this.flash(`Stock de "${p.nombre}" ajustado a ${nuevo}.`);
    this.refrescarDrawer(p.id);
  }

  /** Mantiene el drawer al día si el producto tocado es el que está abierto. */
  private refrescarDrawer(productoId: string) {
    if (this.drawerProduct()?.id !== productoId) return;
    const actualizado = this.inv.productos().find(p => p.id === productoId);
    if (actualizado) this.drawerProduct.set(actualizado);
    this.cargarHistorial(productoId);
  }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }

  // ── Eventos ───────────────────────────────────────────────────────────────
  abrirCrearEvento()  { this.nuevoEventoNombre = ''; this.crearError.set(null); this.crearEventoOpen.set(true); }
  cerrarCrearEvento() { this.crearEventoOpen.set(false); }

  async crearEvento() {
    const nombre = this.nuevoEventoNombre.trim();
    if (!nombre) { this.crearError.set('El nombre es obligatorio.'); return; }
    this.creando.set(true);
    this.crearError.set(null);
    const { error } = await this.eventosSvc.crearEvento(nombre);
    this.creando.set(false);
    if (error) { this.crearError.set(error); return; }
    this.cerrarCrearEvento();
    await this.cargarEventoActivo();
    this.flash(`Evento "${nombre}" creado.`);
  }

  abrirFinalizarEvento()  { this.finalizarError.set(null); this.finalizarOpen.set(true); }
  cerrarFinalizarEvento() { this.finalizarOpen.set(false); }

  async finalizarEvento() {
    const e = this.eventoActivo();
    if (!e) return;
    this.finalizando.set(true);
    this.finalizarError.set(null);
    const { error } = await this.eventosSvc.finalizarEvento(e.id);
    this.finalizando.set(false);
    if (error) { this.finalizarError.set(error); return; }
    this.cerrarFinalizarEvento();
    this.eventoActivo.set(null);
    this.flash(`Evento "${e.nombre}" finalizado.`);
  }

  // ── Formato ───────────────────────────────────────────────────────────────
  fmtCOP(n: number) { return '$' + n.toLocaleString('es-CO'); }

  /** Los valores de inventario grandes se leen mejor abreviados en el KPI. */
  fmtCOPCorto(n: number) {
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
    if (n >= 10_000)    return '$' + Math.round(n / 1000) + 'k';
    return this.fmtCOP(n);
  }

  labelCategoria(id: string) {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }

  labelPersonaje(id: string | null) {
    if (!id) return '—';
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  toneForCat(cat: string) { return CAT_TONES[cat] ?? '#DDE3EA'; }

  historialLabel(tipo: MovimientoProducto['tipo']): string {
    return { creacion: 'Creación', restock: 'Restock', ajuste: 'Ajuste', venta: 'Venta' }[tipo];
  }

  historialBadgeClass(tipo: MovimientoProducto['tipo']): string {
    return { creacion: 'rio', restock: 'ok', ajuste: 'warn', venta: 'lila' }[tipo];
  }

  fmtFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
