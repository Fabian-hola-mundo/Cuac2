import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { CartService } from '../services/cart.service';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { CuaquiversoFooterComponent } from '../footer/cuaquiverso-footer.component';
import { InventarioService, ProductoEvento } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-tienda',
  standalone: true,
  imports: [FormsModule, CartModalComponent, RouterLink, CuaquiversoFooterComponent],
  templateUrl: './tienda.component.html',
  styleUrl: './tienda.component.scss',
})
export class TiendaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private seo   = inject(SeoService);
  private inv   = inject(InventarioService);
  readonly cart = inject(CartService);

  // ── UI state ──────────────────────────────────────────────────────────────
  query         = signal('');
  selectedCats  = signal(new Set<string>());
  selectedChars = signal(new Set<string>());
  selectedMats  = signal(new Set<string>());
  selectedAvail = signal(new Set<string>());
  priceMin      = signal<number | null>(null);
  priceMax      = signal<number | null>(null);
  sortOrder     = signal('new');
  viewMode      = signal<'comf' | 'dense'>('comf');
  filtersOpen   = signal(false);
  searchHasValue = signal(false);

  readonly LABEL_MAP: Record<string, string> = {
    cuac:'Cuac', kiki:'Kiki', roar:'Roar', yeison:'Yeison',
    abejandro:'Abejandro', atolita:'Atolita', colibriana:'Colibriana', tiburcio:'Tiburcio',
  };

  readonly CAT_SHORT: Record<string, string> = {
    tee:'Tee', tote:'Tote', libreta:'Libreta', sticker:'Sticker',
    pin:'Pin', gorra:'Gorra', peluche:'Peluche', print:'Print',
    llavero:'Llavero', pañoleta:'Pañoleta', amigurumi:'Amigurumi', charm:'Charm',
  };

  readonly CATEGORIES = [
    { id:'tee',      label:'Camisetas'  },
    { id:'tote',     label:'Tote bags'  },
    { id:'libreta',  label:'Libretas'   },
    { id:'sticker',  label:'Stickers'   },
    { id:'pin',      label:'Pines'      },
    { id:'gorra',    label:'Gorras'     },
    { id:'peluche',  label:'Peluches'   },
    { id:'print',    label:'Prints'     },
    { id:'llavero',  label:'Llaveros'   },
    { id:'pañoleta', label:'Pañoletas'  },
    { id:'amigurumi',label:'Amigurumis' },
    { id:'charm',    label:'Charms'     },
  ];

  readonly CHARACTERS = [
    { id:'cuac',       label:'Cuac',       swatch:'var(--rio)'    },
    { id:'yeison',     label:'Yeison',     swatch:'#B07820'       },
    { id:'roar',       label:'Roar',       swatch:'var(--carbon)' },
    { id:'kiki',       label:'Kiki',       swatch:'var(--rosa)'   },
    { id:'abejandro',  label:'Abejandro',  swatch:'var(--terra)'  },
    { id:'atolita',    label:'Atolita',    swatch:'var(--lila)'   },
    { id:'colibriana', label:'Colibriana', swatch:'var(--selva)'  },
    { id:'tiburcio',   label:'Tiburcio',   swatch:'#2E8FB8'       },
  ];

  readonly MATERIALS = [
    { id:'algodon', label:'Algodón orgánico' },
    { id:'lona',    label:'Lona reciclada'   },
    { id:'papel',   label:'Papel reciclado'  },
    { id:'vinilo',  label:'Vinilo mate'       },
    { id:'esmalte', label:'Esmalte / metal'  },
  ];

  readonly AVAILABILITY = [
    { id:'stock', label:'En stock'         },
    { id:'last',  label:'Últimas unidades' },
    { id:'new',   label:'Recién llegado'   },
  ];

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly activeProducts = computed(() =>
    this.inv.productos().filter(p => p.activo)
  );

  filteredProducts = computed(() => {
    const q     = this.query().toLowerCase().trim();
    const cats  = this.selectedCats();
    const chars = this.selectedChars();
    const mats  = this.selectedMats();
    const avail = this.selectedAvail();
    const pMin  = this.priceMin();
    const pMax  = this.priceMax();
    const sort  = this.sortOrder();

    let list = this.activeProducts().filter(p => {
      if (cats.size  && !cats.has(p.categoria))                              return false;
      if (chars.size && !chars.has(p.personaje ?? ''))                       return false;
      if (mats.size  && !p.material.some(m => mats.has(m)))                 return false;
      if (avail.size && !this.avFromFlag(p.flag).some(a => avail.has(a)))   return false;
      if (pMin !== null && p.precio < pMin)                                  return false;
      if (pMax !== null && p.precio > pMax)                                  return false;
      if (q) {
        const hay = `${p.nombre} ${this.CAT_SHORT[p.categoria] ?? ''} ${this.LABEL_MAP[p.personaje ?? ''] ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sort === 'lo')  return [...list].sort((a, b) => a.precio - b.precio);
    if (sort === 'hi')  return [...list].sort((a, b) => b.precio - a.precio);
    if (sort === 'pop') return [...list].sort((a, b) =>
      (b.flag === 'new' ? 1 : 0) - (a.flag === 'new' ? 1 : 0)
    );
    return [...list].sort((a, b) =>
      new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
    );
  });

  activePipCount = computed(() =>
    this.selectedCats().size + this.selectedChars().size +
    this.selectedMats().size + this.selectedAvail().size +
    (this.priceMin() !== null ? 1 : 0) + (this.priceMax() !== null ? 1 : 0)
  );

  readonly cargando = computed(() => this.inv.cargando());

  // ── Init ──────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.seo.set({
      title:       'Tienda — Cuaquiverso',
      description: 'Compra productos del universo Cuaquiverso: camisetas, libretas, stickers y peluches.',
      canonical:   'https://cuacdesign.com/cuaquiverso/tienda',
    });
    this.inv.cargarTodos();
    const p = this.route.snapshot.queryParams;
    if (p['q'])   this.query.set(p['q']);
    if (p['cat']) this.selectedCats.set(new Set([p['cat']]));
    if (p['ch'])  this.selectedChars.set(new Set([p['ch']]));
  }

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
  toggleChar(id: string, ev: Event)  { this.toggle(this.selectedChars,  id, (ev.target as HTMLInputElement).checked); }
  toggleMat(id: string, ev: Event)   { this.toggle(this.selectedMats,   id, (ev.target as HTMLInputElement).checked); }
  toggleAvail(id: string, ev: Event) { this.toggle(this.selectedAvail,  id, (ev.target as HTMLInputElement).checked); }

  onQueryChange(ev: Event) {
    const val = (ev.target as HTMLInputElement).value;
    this.query.set(val);
    this.searchHasValue.set(!!val);
  }

  clearSearch() {
    this.query.set('');
    this.searchHasValue.set(false);
  }

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
    this.searchHasValue.set(false);
    this.selectedCats.set(new Set());
    this.selectedChars.set(new Set());
    this.selectedMats.set(new Set());
    this.selectedAvail.set(new Set());
    this.priceMin.set(null);
    this.priceMax.set(null);
  }

  addToCart(ev: Event, p: ProductoEvento) {
    ev.preventDefault();
    ev.stopPropagation();
    this.cart.add({
      id:        p.id,
      name:      p.nombre,
      sub:       this.CAT_SHORT[p.categoria] ?? p.categoria,
      price:     p.precio,
      color:     p.color ?? '#3D4856',
      categoria: p.categoria,
    });
    this.cart.open();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  fmtPrice(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }

  shortLabel(p: ProductoEvento): string {
    return `${this.CAT_SHORT[p.categoria] ?? ''}<br>${this.LABEL_MAP[p.personaje ?? ''] ?? ''}`;
  }

  avFromFlag(flag: string | null): string[] {
    if (flag === 'new')  return ['stock', 'new'];
    if (flag === 'last') return ['last'];
    return ['stock'];
  }
}
