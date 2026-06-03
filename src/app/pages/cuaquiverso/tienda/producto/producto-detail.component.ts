import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InventarioService, ProductoEvento } from '../../../../core/services/inventario.service';
import { CartService } from '../../services/cart.service';
import { CartModalComponent } from '../../cart-modal/cart-modal.component';
import { SeoService } from '../../../../core/services/seo.service';

const CAT_SHORT: Record<string, string> = {
  tee:'Camiseta', tote:'Tote bag', libreta:'Libreta', sticker:'Sticker',
  pin:'Pin', gorra:'Gorra', peluche:'Peluche', print:'Print',
  llavero:'Llavero', pañoleta:'Pañoleta', amigurumi:'Amigurumi', charm:'Charm',
};

const CHAR_LABEL: Record<string, string> = {
  cuac:'Cuac', kiki:'Kiki', roar:'Roar', yeison:'Yeison',
  abejandro:'Abejandro', atolita:'Atolita', colibriana:'Colibriana', tiburcio:'Tiburcio',
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
  readonly producto    = signal<ProductoEvento | null>(null);
  readonly selectedImg = signal<string | null>(null);

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

    const data = await this.inv.getProducto(id);
    if (!data) {
      this.notFound.set(true);
    } else {
      this.producto.set(data);
      this.seo.set({
        title:       `${data.nombre} — Cuaquiverso`,
        description: data.descripcion ?? `${CAT_SHORT[data.categoria] ?? data.categoria} del Cuaquiverso. Hecho en Colombia.`,
        canonical:   `https://cuacdesign.com/cuaquiverso/tienda/${id}`,
      });
    }
    this.loading.set(false);
  }

  catLabel(cat: string): string  { return CAT_SHORT[cat] ?? cat; }
  charLabel(ch: string): string  { return CHAR_LABEL[ch] ?? ch; }
  fmtPrice(n: number): string    { return '$' + n.toLocaleString('es-CO'); }

  addToCart(): void {
    const p = this.producto();
    if (!p) return;
    this.cart.add({
      id:    p.id,
      name:  p.nombre,
      sub:   this.catLabel(p.categoria),
      price: p.precio,
      color: p.color ?? '#3D4856',
    });
    this.cart.open();
  }
}
