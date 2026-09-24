import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  InventarioService,
  ProductoEvento,
  esEtiquetaPropia,
  etiquetaCategoria,
  etiquetaFlag,
} from '../../../../core/services/inventario.service';
import { CartService } from '../../services/cart.service';
import { CartModalComponent } from '../../cart-modal/cart-modal.component';
import { SeoService } from '../../../../core/services/seo.service';
import { UMBRAL_POCAS_UNIDADES } from '../../services/tienda.constants';

const CAT_SHORT: Record<string, string> = {
  tee:'Camiseta', tote:'Tote bag', libreta:'Libreta', sticker:'Sticker',
  pin:'Pin', gorra:'Gorra', peluche:'Peluche', print:'Print',
  llavero:'Llavero', pañoleta:'Pañoleta', amigurumi:'Amigurumi', charm:'Charm',
};

@Component({
  selector: 'app-producto-detail',
  standalone: true,
  imports: [RouterLink, CartModalComponent],
  templateUrl: './producto-detail.component.html',
  styleUrl: './producto-detail.component.scss',
})
export class ProductoDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private inv   = inject(InventarioService);
  readonly cart = inject(CartService);
  private seo   = inject(SeoService);

  readonly loading     = signal(true);
  readonly notFound    = signal(false);
  /** Fallo de lectura, distinto de "no existe": el primero se puede reintentar. */
  readonly errorCarga  = signal<string | null>(null);
  readonly producto    = signal<ProductoEvento | null>(null);
  readonly selectedImg = signal<string | null>(null);

  readonly agotado = computed(() => (this.producto()?.stock_actual ?? 0) <= 0);

  readonly pocasUnidades = computed(() => {
    const s = this.producto()?.stock_actual ?? 0;
    return s > 0 && s <= UMBRAL_POCAS_UNIDADES;
  });

  readonly allImgs = computed(() => {
    const p = this.producto();
    if (!p) return [];
    const imgs: string[] = [];
    if (p.cover_url) imgs.push(p.cover_url);
    p.fotos.forEach(f => { if (f && f !== p.cover_url) imgs.push(f); });
    return imgs;
  });

  readonly mainImg = computed(() => {
    const imgs = this.allImgs();
    return this.selectedImg() ?? imgs[0] ?? null;
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/cuaquiverso/tienda']); return; }
    await this.cargar(id);
  }

  async cargar(id = this.route.snapshot.paramMap.get('id')!): Promise<void> {
    this.loading.set(true);
    this.errorCarga.set(null);
    this.notFound.set(false);

    const { producto, error } = await this.inv.getProductoPublico(id);

    if (error) {
      // Antes cualquier fallo de PostgREST —incluido un fetch caído— se
      // mostraba como "este producto no existe o ya no está disponible".
      this.errorCarga.set(error);
    } else if (!producto) {
      this.notFound.set(true);
      // Un id inexistente heredaba el título de la página anterior: soft-404.
      this.seo.set({
        title:       'Producto no encontrado — Cuaquiverso',
        description: 'Este producto no existe o ya no está disponible en la tienda del Cuaquiverso.',
        canonical:   `https://cuacdesign.com/cuaquiverso/tienda/${id}`,
        noindex:     true,
      });
    } else {
      this.producto.set(producto);
      this.aplicarSeo(producto, id);
    }
    this.loading.set(false);
  }

  /**
   * La ficha compartía la OG genérica del estudio: quien pegaba el link de un
   * peluche en WhatsApp o Instagram no veía ni el nombre ni la foto ni el
   * precio del producto.
   */
  private aplicarSeo(p: ProductoEvento, id: string): void {
    const url  = `https://cuacdesign.com/cuaquiverso/tienda/${id}`;
    const desc = p.descripcion ?? `${CAT_SHORT[p.categoria] ?? p.categoria} del Cuaquiverso. Hecho en Colombia.`;

    this.seo.set({
      title:       `${p.nombre} — Cuaquiverso`,
      description: desc,
      canonical:   url,
      ogImage:     p.cover_url ?? undefined,
      ogType:      'article',
    });

    this.seo.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.nombre,
      description: desc,
      image: this.allImgs(),
      brand: { '@type': 'Brand', name: 'Cuaquiverso' },
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: 'COP',
        price: p.precio,
        availability: p.stock_actual > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      },
    });
  }

  etiquetaFlag = etiquetaFlag;
  esEtiquetaPropia = esEtiquetaPropia;

  catLabel(cat: string): string  { return CAT_SHORT[cat] ?? etiquetaCategoria(cat); }
  fmtPrice(n: number): string    { return '$' + n.toLocaleString('es-CO'); }

  addToCart(): void {
    const p = this.producto();
    if (!p || this.agotado()) return;
    const agregado = this.cart.add({
      id:        p.id,
      name:      p.nombre,
      sub:       this.catLabel(p.categoria),
      price:     p.precio,
      color:     p.color ?? '#3D4856',
      categoria: p.categoria,
      stock:     p.stock_actual,
    });
    // En la ficha sí se abre el carrito: es el final del recorrido del producto,
    // no una interrupción de la exploración como en la grilla.
    if (agregado) this.cart.open();
    else this.avisoTope.set(true);
  }

  /** El comprador ya tiene en el carrito todo el stock que queda. */
  readonly avisoTope = signal(false);
}
