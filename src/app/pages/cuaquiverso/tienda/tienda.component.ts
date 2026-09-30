import { Component, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { CartService } from '../services/cart.service';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { CuaquiversoFooterComponent } from '../footer/cuaquiverso-footer.component';
import {
  InventarioService,
  ProductoPublico,
  esEtiquetaPropia,
  etiquetaCategoria,
  etiquetaFlag,
  etiquetaMaterial,
} from '../../../core/services/inventario.service';
import { ENVIO_GRATIS_CORTO, UMBRAL_POCAS_UNIDADES } from '../services/tienda.constants';

/** Disponibilidad real, derivada del stock — no de la etiqueta manual `flag`. */
export type Disponibilidad = 'agotado' | 'last' | 'stock';

@Component({
  selector: 'app-tienda',
  standalone: true,
  imports: [FormsModule, CartModalComponent, RouterLink, CuaquiversoFooterComponent],
  templateUrl: './tienda.component.html',
  styleUrl: './tienda.component.scss',
})
export class TiendaComponent implements OnInit {
  private route    = inject(ActivatedRoute);
  private router   = inject(Router);
  private location = inject(Location);
  private seo      = inject(SeoService);
  private inv    = inject(InventarioService);
  readonly cart  = inject(CartService);

  readonly ENVIO_GRATIS_CORTO = ENVIO_GRATIS_CORTO;

  // ── UI state ──────────────────────────────────────────────────────────────
  query         = signal('');
  selectedCats  = signal(new Set<string>());
  selectedMats  = signal(new Set<string>());
  selectedAvail = signal(new Set<string>());
  priceMin      = signal<number | null>(null);
  priceMax      = signal<number | null>(null);
  sortOrder     = signal('new');
  viewMode      = signal<'comf' | 'dense'>('comf');
  filtersOpen   = signal(false);

  /** Mensaje efímero al agregar al carrito, leído por lectores de pantalla. */
  aviso = signal('');
  private avisoTimer: ReturnType<typeof setTimeout> | null = null;

  /** Se derivaba a mano en tres sitios y había que acordarse de resetearlo. */
  readonly searchHasValue = computed(() => this.query().length > 0);

  readonly CAT_SHORT: Record<string, string> = {
    tee:'Tee', tote:'Tote', libreta:'Libreta', sticker:'Sticker',
    pin:'Pin', gorra:'Gorra', peluche:'Peluche', print:'Print',
    llavero:'Llavero', pañoleta:'Pañoleta', amigurumi:'Amigurumi', charm:'Charm',
  };

  /**
   * Las listas de filtros salen del catálogo, no de un arreglo fijo: si el
   * admin crea una categoría nueva o escribe un material que no estaba
   * previsto, el filtro aparece solo. Antes eran constantes escritas a mano y
   * un producto con algo fuera de la lista era invisible para los filtros.
   */
  readonly CATEGORIES = computed(() => {
    const usadas = new Set(this.activeProducts().map(p => p.categoria).filter(Boolean));
    return [...usadas]
      .map(id => ({ id, label: etiquetaCategoria(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  });

  readonly MATERIALS = computed(() => {
    const usados = new Set(this.activeProducts().flatMap(p => p.material ?? []));
    return [...usados]
      .filter(Boolean)
      .map(id => ({ id, label: etiquetaMaterial(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  });

  readonly AVAILABILITY = [
    { id:'stock', label:'Disponible'      },
    { id:'last',  label:'Últimas unidades' },
    { id:'new',   label:'Recién llegado'   },
  ];

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly activeProducts = computed(() => this.inv.catalogo());
  readonly cargando       = computed(() => this.inv.cargandoCatalogo());
  readonly errorCarga     = computed(() => this.inv.errorCatalogo());

  filteredProducts = computed(() => {
    const q     = this.query().toLowerCase().trim();
    const cats  = this.selectedCats();
    const mats  = this.selectedMats();
    const avail = this.selectedAvail();
    const pMin  = this.priceMin();
    const pMax  = this.priceMax();
    const sort  = this.sortOrder();

    const list = this.activeProducts().filter(p => {
      if (cats.size  && !cats.has(p.categoria))                        return false;
      if (mats.size  && !p.material.some(m => mats.has(m)))            return false;
      if (avail.size && !this.etiquetasDisponibilidad(p).some(a => avail.has(a))) return false;
      if (pMin !== null && p.precio < pMin)                            return false;
      if (pMax !== null && p.precio > pMax)                            return false;
      if (q) {
        const hay = `${p.nombre} ${etiquetaCategoria(p.categoria)} ${(p.material ?? []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const recientes = (a: ProductoPublico, b: ProductoPublico) =>
      new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime();

    // Los agotados nunca encabezan la grilla: se pueden ver, pero al final.
    const porOrden =
      sort === 'lo'  ? (a: ProductoPublico, b: ProductoPublico) => a.precio - b.precio :
      sort === 'hi'  ? (a: ProductoPublico, b: ProductoPublico) => b.precio - a.precio :
      // "Destacados" usa la marca real del admin. Antes esta opción se llamaba
      // "Más vendidos" y ordenaba por la etiqueta `flag === 'new'`, así que
      // devolvía prácticamente la misma grilla que "Recién llegados".
      sort === 'dest' ? (a: ProductoPublico, b: ProductoPublico) =>
        (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0) || recientes(a, b) :
      recientes;

    return [...list].sort((a, b) =>
      (this.agotado(a) ? 1 : 0) - (this.agotado(b) ? 1 : 0) || porOrden(a, b)
    );
  });

  activePipCount = computed(() =>
    this.selectedCats().size + this.selectedMats().size + this.selectedAvail().size +
    (this.priceMin() !== null ? 1 : 0) + (this.priceMax() !== null ? 1 : 0)
  );

  constructor() {
    // Los filtros se leían de la URL al entrar pero nunca se escribían: volver
    // desde una ficha reiniciaba la tienda y no había forma de compartir "la
    // tienda filtrada por Kiki".
    //
    // Se usa replaceState y no router.navigate a propósito: una navegación por
    // cada tecla de la búsqueda dispararía una view transition (la app las tiene
    // activadas) y llenaría el historial de estados intermedios.
    effect(() => {
      const qs = this.filtrosEnUrl();
      this.location.replaceState('/cuaquiverso/tienda' + (qs ? `?${qs}` : ''));
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.seo.set({
      title:       'Tienda — Cuaquiverso',
      description: 'Compra productos del universo Cuaquiverso: camisetas, libretas, stickers y peluches.',
      canonical:   'https://cuacdesign.com/cuaquiverso/tienda',
    });
    this.inv.cargarCatalogo();

    const p = this.route.snapshot.queryParams;
    if (p['q'])    this.query.set(p['q']);
    if (p['cat'])  this.selectedCats.set(new Set(String(p['cat']).split(',').filter(Boolean)));
    if (p['mat'])  this.selectedMats.set(new Set(String(p['mat']).split(',').filter(Boolean)));
    if (p['disp']) this.selectedAvail.set(new Set(String(p['disp']).split(',').filter(Boolean)));
    if (p['min'])  this.priceMin.set(Number(p['min']) || null);
    if (p['max'])  this.priceMax.set(Number(p['max']) || null);
    if (p['ord'])  this.sortOrder.set(p['ord']);
  }

  private filtrosEnUrl(): string {
    const lista = (s: Set<string>) => (s.size ? [...s].join(',') : null);
    const pares: [string, string | null][] = [
      ['q',    this.query() || null],
      ['cat',  lista(this.selectedCats())],
      ['mat',  lista(this.selectedMats())],
      ['disp', lista(this.selectedAvail())],
      ['min',  this.priceMin() !== null ? String(this.priceMin()) : null],
      ['max',  this.priceMax() !== null ? String(this.priceMax()) : null],
      ['ord',  this.sortOrder() === 'new' ? null : this.sortOrder()],
    ];
    const qs = new URLSearchParams();
    for (const [k, v] of pares) if (v) qs.set(k, v);
    return qs.toString();
  }

  reintentar() { this.inv.cargarCatalogo(); }

  // ── Panel de filtros (drawer en móvil) ────────────────────────────────────
  // Se abría a pantalla completa sin overlay, sin botón de cerrar y sin Escape:
  // el propio panel tapaba el botón que lo había abierto y la única salida era
  // recargar la página.
  cerrarFiltros() { this.filtersOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.filtersOpen()) this.cerrarFiltros(); }

  // ── Filter toggles ────────────────────────────────────────────────────────
  private toggle(
    sig: { set(v: Set<string>): void; (): Set<string> },
    id: string,
    checked: boolean
  ) {
    const s = new Set(sig());
    checked ? s.add(id) : s.delete(id);
    sig.set(s);
  }

  toggleCat(id: string, ev: Event)   { this.toggle(this.selectedCats,   id, (ev.target as HTMLInputElement).checked); }
  toggleMat(id: string, ev: Event)   { this.toggle(this.selectedMats,   id, (ev.target as HTMLInputElement).checked); }
  toggleAvail(id: string, ev: Event) { this.toggle(this.selectedAvail,  id, (ev.target as HTMLInputElement).checked); }

  onQueryChange(ev: Event) {
    this.query.set((ev.target as HTMLInputElement).value);
  }

  clearSearch() { this.query.set(''); }

  onPriceMin(ev: Event) {
    const v = (ev.target as HTMLInputElement).value;
    this.priceMin.set(v ? Number(v) : null);
  }

  onPriceMax(ev: Event) {
    const v = (ev.target as HTMLInputElement).value;
    this.priceMax.set(v ? Number(v) : null);
  }

  clearAll() {
    this.query.set('');
    this.selectedCats.set(new Set());
    this.selectedMats.set(new Set());
    this.selectedAvail.set(new Set());
    this.priceMin.set(null);
    this.priceMax.set(null);
  }

  // ── Carrito ───────────────────────────────────────────────────────────────
  addToCart(ev: Event, p: ProductoPublico) {
    ev.preventDefault();
    ev.stopPropagation();
    // Con variantes hay que elegir talla/color: el «+» lleva a la ficha.
    if (p.tieneVariantes) {
      this.router.navigate(['/cuaquiverso/tienda', p.id]);
      return;
    }
    if (this.agotado(p)) return;

    const agregado = this.cart.add({
      id:        p.id,
      name:      p.nombre,
      sub:       this.CAT_SHORT[p.categoria] ?? p.categoria,
      price:     p.precio,
      color:     p.color ?? '#3D4856',
      categoria: p.categoria,
      stock:     p.stock_actual,
    });

    // Abrir el carrito entero en cada "+" cortaba la exploración: cinco
    // productos eran cinco interrupciones. El aviso confirma sin sacar al
    // comprador de la grilla, y el contador del topbar hace el resto.
    this.anunciar(agregado
      ? `${p.nombre} agregado al carrito.`
      : `No quedan más unidades de ${p.nombre}.`);
  }

  private anunciar(mensaje: string) {
    this.aviso.set(mensaje);
    if (this.avisoTimer) clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => this.aviso.set(''), 3200);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  fmtPrice(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }

  shortLabel(p: ProductoPublico): string {
    return etiquetaCategoria(p.categoria);
  }

  /** Forma corta para la tarjeta; una categoría nueva cae en su etiqueta legible. */
  catCorta(categoria: string): string {
    return this.CAT_SHORT[categoria] ?? etiquetaCategoria(categoria);
  }

  etiquetaFlag = etiquetaFlag;
  esEtiquetaPropia = esEtiquetaPropia;

  /** Primer material del producto, con la etiqueta de los ids antiguos. */
  materialCorto(p: ProductoPublico): string {
    const primero = (p.material ?? [])[0];
    return primero ? etiquetaMaterial(primero) : '';
  }

  agotado(p: ProductoPublico): boolean {
    return p.stock_actual <= 0;
  }

  /**
   * La disponibilidad la manda el stock. Antes salía de la columna `flag`, que
   * el admin pone a mano: un producto agotado con flag 'last' aparecía como
   * "Últimas unidades", pasaba el filtro y se podía comprar.
   */
  disponibilidad(p: ProductoPublico): Disponibilidad {
    if (p.stock_actual <= 0) return 'agotado';
    if (p.stock_actual <= UMBRAL_POCAS_UNIDADES) return 'last';
    return 'stock';
  }

  /** Etiquetas por las que un producto pasa el filtro de disponibilidad. */
  private etiquetasDisponibilidad(p: ProductoPublico): string[] {
    const disp = this.disponibilidad(p);
    if (disp === 'agotado') return [];
    const etiquetas = [disp === 'last' ? 'last' : 'stock'];
    if (disp === 'last') etiquetas.push('stock');
    if (p.flag === 'new') etiquetas.push('new');
    return etiquetas;
  }
}
