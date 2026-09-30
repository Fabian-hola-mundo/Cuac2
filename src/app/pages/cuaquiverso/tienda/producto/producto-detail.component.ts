import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  InventarioService,
  ProductoEvento,
  ProductoOpcion,
  VariantePublica,
  esEtiquetaPropia,
  etiquetaCategoria,
  etiquetaFlag,
} from '../../../../core/services/inventario.service';
import { CartService } from '../../services/cart.service';
import { CartModalComponent } from '../../cart-modal/cart-modal.component';
import { SeoService } from '../../../../core/services/seo.service';
import { UMBRAL_POCAS_UNIDADES } from '../../services/tienda.constants';
import {
  Combinacion,
  etiquetaVariante,
  rangoPrecios,
  valorDisponible,
  varianteDeSeleccion,
} from '../../../../../../supabase/functions/_shared/variantes';

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

  readonly opciones   = signal<ProductoOpcion[]>([]);
  readonly variantes  = signal<VariantePublica[]>([]);
  readonly seleccion  = signal<Combinacion>({});

  readonly tieneVariantes = computed(() => this.variantes().length > 0);
  readonly orden = computed(() => this.opciones().map(o => o.nombre));

  readonly variante = computed(() =>
    varianteDeSeleccion(this.variantes(), this.seleccion(), this.orden()));

  /** Stock que manda: el de la combinación elegida o el total del producto. */
  readonly stockVisible = computed(() =>
    this.variante()?.disponible ?? this.producto()?.stock_actual ?? 0);

  readonly precioVisible = computed(() => {
    const p = this.producto();
    if (!p) return 0;
    return this.variante()?.precio ?? p.precio;
  });

  readonly rango = computed(() => {
    const p = this.producto();
    return p && this.tieneVariantes() ? rangoPrecios(this.variantes(), p.precio) : null;
  });

  /** Nombre (en minúscula) de la primera opción sin elegir, para el botón. */
  readonly faltaElegir = computed(() => {
    const n = this.orden().find(o => !this.seleccion()[o]);
    return n ? n.toLocaleLowerCase('es') : null;
  });

  disponible(opcion: string, valor: string): boolean {
    return valorDisponible(this.variantes(), this.seleccion(), opcion, valor);
  }

  elegir(opcion: string, valor: string, foto: string | null): void {
    this.avisoTope.set(false);
    this.seleccion.update(s => ({ ...s, [opcion]: s[opcion] === valor ? '' : valor }));
    if (foto && this.seleccion()[opcion]) this.selectedImg.set(foto);
  }

  readonly agotado = computed(() => this.stockVisible() <= 0);

  readonly pocasUnidades = computed(() => {
    const s = this.stockVisible();
    return s > 0 && s <= UMBRAL_POCAS_UNIDADES;
  });

  readonly allImgs = computed(() => {
    const p = this.producto();
    if (!p) return [];
    const imgs: string[] = [];
    if (p.cover_url) imgs.push(p.cover_url);
    p.fotos.forEach(f => { if (f && f !== p.cover_url) imgs.push(f); });
    this.opciones().forEach(o => o.valores.forEach(v => {
      if (v.foto_url && !imgs.includes(v.foto_url)) imgs.push(v.foto_url);
    }));
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

    const { producto, opciones, variantes, error } = await this.inv.getProductoPublico(id);

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
      this.opciones.set(opciones);
      this.variantes.set(variantes);
      this.seleccion.set({});
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

    const rango = this.rango();
    const availability = p.stock_actual > 0
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock';

    this.seo.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.nombre,
      description: desc,
      image: this.allImgs(),
      brand: { '@type': 'Brand', name: 'Cuaquiverso' },
      offers: rango && rango.min !== rango.max
        ? {
            '@type': 'AggregateOffer',
            priceCurrency: 'COP',
            lowPrice: rango.min,
            highPrice: rango.max,
            offerCount: this.variantes().length,
            availability,
          }
        : {
            '@type': 'Offer',
            url,
            priceCurrency: 'COP',
            price: rango?.min ?? p.precio,
            availability,
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
    const v = this.variante();
    if (this.tieneVariantes() && !v) return;
    const agregado = this.cart.add({
      id:            p.id,
      name:          p.nombre,
      sub:           this.catLabel(p.categoria),
      price:         v?.precio ?? p.precio,
      color:         p.color ?? '#3D4856',
      categoria:     p.categoria,
      stock:         this.stockVisible(),
      varianteId:    v?.id ?? null,
      varianteLabel: v ? etiquetaVariante(v.opciones, this.orden()) : null,
    });
    // En la ficha sí se abre el carrito: es el final del recorrido del producto,
    // no una interrupción de la exploración como en la grilla.
    if (agregado) this.cart.open();
    else this.avisoTope.set(true);
  }

  /** El comprador ya tiene en el carrito todo el stock que queda. */
  readonly avisoTope = signal(false);
}
