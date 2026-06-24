import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { Router }       from '@angular/router';
import { InventarioService, ProductoEvento, MovimientoProducto, CATEGORIAS, CAT_TONES } from '../../../core/services/inventario.service';
import { EventosService, Evento } from '../../../core/services/eventos.service';

@Component({
  selector: 'app-productos-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productos-list.component.html',
  styleUrl: './productos-list.component.scss',
})
export class ProductosListComponent implements OnInit {
  private router = inject(Router);
  readonly inv   = inject(InventarioService);
  private eventosSvc = inject(EventosService);
  readonly categorias = CATEGORIAS;

  catFiltro  = signal<string>('all');

  categoriasConProductos = computed(() => {
    const usadas = new Set(this.inv.productos().map(p => p.categoria));
    return this.categorias.filter(c => usadas.has(c.id));
  });
  busqueda   = signal('');
  toast      = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  // Evento activo
  eventoActivo      = signal<Evento | null>(null);

  // Crear evento
  crearEventoOpen   = signal(false);
  nuevoEventoNombre = '';
  creando           = signal(false);
  crearError        = signal<string | null>(null);

  // Finalizar evento
  finalizarOpen     = signal(false);
  finalizando       = signal(false);
  finalizarError    = signal<string | null>(null);

  // Drawer state
  drawerOpen    = signal(false);
  drawerProduct = signal<ProductoEvento | null>(null);

  // Restock
  restockOpen     = signal(false);
  restockTarget   = signal<ProductoEvento | null>(null);
  restockCantidad: number | null = null;
  restockNota     = '';
  restockLoading  = signal(false);
  restockError    = signal<string | null>(null);

  // Historial (drawer)
  historial          = signal<MovimientoProducto[]>([]);
  historialCargando  = signal(false);

  productosFiltrados = computed(() => {
    const cat  = this.catFiltro();
    const q    = this.busqueda().toLowerCase().trim();
    let list   = this.inv.productos();
    if (cat !== 'all') list = list.filter(p => p.categoria === cat);
    if (q) list = list.filter(p => p.nombre.toLowerCase().includes(q));
    return list;
  });

  ngOnInit() {
    this.inv.cargarTodos();
    this.cargarEventoActivo();
  }

  private async cargarEventoActivo() {
    try {
      const e = await this.eventosSvc.getEventoActivo();
      this.eventoActivo.set(e);
    } catch { /* no-op */ }
  }

  nuevo()    { this.router.navigate(['/admin/productos/nuevo']); }
  editar(p: ProductoEvento)  { this.router.navigate(['/admin/productos', p.id, 'editar']); }
  verVentas() { this.router.navigate(['/admin/productos/ventas']); }

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

  async duplicar(p: ProductoEvento, event: Event) {
    event.stopPropagation();
    const { error } = await this.inv.duplicarProducto(p.id);
    this.flash(error ? `Error: ${error}` : `"${p.nombre}" duplicado.`);
  }

  async toggleActivo(p: ProductoEvento, event: Event) {
    event.stopPropagation();
    const { error } = await this.inv.toggleActivo(p.id, !p.activo);
    if (!error) this.flash(p.activo ? 'Producto ocultado.' : 'Producto activado.');
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
    if (this.drawerProduct()?.id === p.id) this.cargarHistorial(p.id);
  }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }

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

  fmtCOP(n: number) { return '$' + n.toLocaleString('es-CO'); }

  labelCategoria(id: string) {
    return this.categorias.find(c => c.id === id)?.label ?? id;
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
