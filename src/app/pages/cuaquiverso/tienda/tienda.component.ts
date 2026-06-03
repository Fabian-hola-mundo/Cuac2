import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

export interface Product {
  id: number;
  ch: string;
  cat: string;
  name: string;
  sub: string;
  price: number;
  color: string;
  flag: string | null;
  mat: string[];
  av: string[];
}

@Component({
  selector: 'app-tienda',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './tienda.component.html',
  styleUrl: './tienda.component.scss',
})
export class TiendaComponent implements OnInit {
  private route = inject(ActivatedRoute);

  // ── UI state ──────────────────────────────────────────────────────────────
  query = signal('');
  selectedCats = signal(new Set<string>());
  selectedChars = signal(new Set<string>());
  selectedMats = signal(new Set<string>());
  selectedAvail = signal(new Set<string>());
  priceMin = signal<number | null>(null);
  priceMax = signal<number | null>(null);
  sortOrder = signal('new');
  viewMode = signal<'comf' | 'dense'>('comf');
  filtersOpen = signal(false);
  cartCount = signal(3);
  searchHasValue = signal(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly PRODUCTS: Product[] = [
    { id:1,  ch:'cuac',       cat:'tee',     name:'El explorador soñador',     sub:'Camiseta · Algodón orgánico',  price:89000,  color:'rio',   flag:'new',  mat:['algodon'],  av:['stock','new'] },
    { id:2,  ch:'cuac',       cat:'tote',    name:'Maleta del viajero',        sub:'Tote · Lona reciclada',        price:54000,  color:'rio',   flag:null,   mat:['lona'],     av:['stock'] },
    { id:3,  ch:'cuac',       cat:'libreta', name:'Diario de viaje',           sub:'Libreta · A5 · 120 pgs',       price:48000,  color:'rio',   flag:null,   mat:['papel'],    av:['stock'] },
    { id:4,  ch:'cuac',       cat:'sticker', name:'Memorias del camino',       sub:'Sticker pack ×6',              price:28000,  color:'rio',   flag:null,   mat:['vinilo'],   av:['stock'] },
    { id:5,  ch:'cuac',       cat:'pin',     name:'Pin pato azul',             sub:'Pin esmaltado',                price:22000,  color:'rio',   flag:null,   mat:['esmalte'],  av:['stock'] },
    { id:6,  ch:'kiki',       cat:'pin',     name:'Kiki la delfín',            sub:'Pin esmaltado',                price:22000,  color:'rosa',  flag:'new',  mat:['esmalte'],  av:['stock','new'] },
    { id:7,  ch:'kiki',       cat:'tee',     name:'Flota con estilo',          sub:'Camiseta · Tie-dye natural',   price:95000,  color:'rosa',  flag:null,   mat:['algodon'],  av:['stock'] },
    { id:8,  ch:'kiki',       cat:'print',   name:'Kiki entre nenúfares',      sub:'Print · 50×70cm',              price:95000,  color:'rosa',  flag:null,   mat:['papel'],    av:['last'] },
    { id:9,  ch:'kiki',       cat:'sticker', name:'Pack del Amazonas',         sub:'Sticker pack ×4',              price:24000,  color:'rosa',  flag:null,   mat:['vinilo'],   av:['stock'] },
    { id:10, ch:'yeison',     cat:'tote',    name:'Yeison al río',             sub:'Tote · Lona reciclada',        price:54000,  color:'sol',   flag:null,   mat:['lona'],     av:['stock'] },
    { id:11, ch:'yeison',     cat:'gorra',   name:'Sombrero llanero',          sub:'Gorra · Sombrero replica',     price:78000,  color:'sol',   flag:null,   mat:['algodon'],  av:['last'] },
    { id:12, ch:'yeison',     cat:'sticker', name:'Atardecer del llano',       sub:'Sticker pack ×6',              price:28000,  color:'sol',   flag:null,   mat:['vinilo'],   av:['stock'] },
    { id:13, ch:'yeison',     cat:'libreta', name:'Cuaderno joropo',           sub:'Libreta · A6 · pauta',         price:38000,  color:'sol',   flag:null,   mat:['papel'],    av:['stock'] },
    { id:14, ch:'roar',       cat:'libreta', name:'Diario de páramo',          sub:'Libreta · A5 · tapa dura',     price:48000,  color:'bone',  flag:'last', mat:['papel'],    av:['last'] },
    { id:15, ch:'roar',       cat:'print',   name:'Cordillera en acuarela',    sub:'Print · A2 · papel mate',      price:82000,  color:'bone',  flag:null,   mat:['papel'],    av:['stock'] },
    { id:16, ch:'roar',       cat:'tee',     name:'Oso poeta',                 sub:'Camiseta · Algodón orgánico',  price:89000,  color:'bone',  flag:null,   mat:['algodon'],  av:['stock'] },
    { id:17, ch:'roar',       cat:'pin',     name:'Pin de anteojos',           sub:'Pin esmaltado',                price:22000,  color:'bone',  flag:null,   mat:['esmalte'],  av:['stock'] },
    { id:18, ch:'abejandro',  cat:'print',   name:'"Si fuera fácil…"',         sub:'Print · A3 · edición 80',      price:72000,  color:'terra', flag:'new',  mat:['papel'],    av:['stock','new'] },
    { id:19, ch:'abejandro',  cat:'tote',    name:'Abeja crítica',             sub:'Tote · Lona reciclada',        price:54000,  color:'terra', flag:null,   mat:['lona'],     av:['stock'] },
    { id:20, ch:'abejandro',  cat:'sticker', name:'Pack del taller',           sub:'Sticker pack ×6',              price:28000,  color:'terra', flag:null,   mat:['vinilo'],   av:['stock'] },
    { id:21, ch:'abejandro',  cat:'libreta', name:'Cuaderno enojón',           sub:'Libreta · A5',                 price:48000,  color:'terra', flag:null,   mat:['papel'],    av:['stock'] },
    { id:22, ch:'atolita',    cat:'sticker', name:'Mareas y mantras',          sub:'Sticker pack ×6 · vinilo',     price:28000,  color:'lila',  flag:null,   mat:['vinilo'],   av:['stock'] },
    { id:23, ch:'atolita',    cat:'tee',     name:'Tortuga en calma',          sub:'Camiseta · Tie-dye natural',   price:95000,  color:'lila',  flag:null,   mat:['algodon'],  av:['stock'] },
    { id:24, ch:'atolita',    cat:'tote',    name:'Mandala del Pacífico',      sub:'Tote · Lona reciclada',        price:54000,  color:'lila',  flag:null,   mat:['lona'],     av:['stock'] },
    { id:25, ch:'atolita',    cat:'pin',     name:'Pin tortuga',               sub:'Pin esmaltado',                price:22000,  color:'lila',  flag:null,   mat:['esmalte'],  av:['stock'] },
    { id:26, ch:'atolita',    cat:'peluche', name:'Atolita peluche',           sub:'Peluche · 24cm',               price:128000, color:'lila',  flag:null,   mat:['algodon'],  av:['last'] },
    { id:27, ch:'colibriana', cat:'gorra',   name:'Café con vuelo',            sub:'Gorra dad-cap · bordado',      price:78000,  color:'selva', flag:'new',  mat:['algodon'],  av:['stock','new'] },
    { id:28, ch:'colibriana', cat:'sticker', name:'Pack cafetero',             sub:'Sticker pack ×6',              price:28000,  color:'selva', flag:null,   mat:['vinilo'],   av:['stock'] },
    { id:29, ch:'colibriana', cat:'tee',     name:'La paisa',                  sub:'Camiseta · Algodón orgánico',  price:89000,  color:'selva', flag:null,   mat:['algodon'],  av:['stock'] },
    { id:30, ch:'colibriana', cat:'pin',     name:'Pin colibrí',               sub:'Pin esmaltado · pluma',        price:22000,  color:'selva', flag:null,   mat:['esmalte'],  av:['stock'] },
    { id:31, ch:'colibriana', cat:'libreta', name:'Cuaderno aroma a tinto',    sub:'Libreta · A5',                 price:48000,  color:'selva', flag:null,   mat:['papel'],    av:['stock'] },
    { id:32, ch:'tiburcio',   cat:'peluche', name:'Tiburcio el vacilón',       sub:'Peluche · 28cm · edición 200', price:148000, color:'cream', flag:'last', mat:['algodon'],  av:['last'] },
    { id:33, ch:'tiburcio',   cat:'tee',     name:'Rayas costeñas',            sub:'Camiseta · Algodón orgánico',  price:89000,  color:'tibu',  flag:null,   mat:['algodon'],  av:['stock'] },
    { id:34, ch:'tiburcio',   cat:'gorra',   name:'Sombrero del carnaval',     sub:'Gorra · Cinta roja',           price:78000,  color:'tibu',  flag:null,   mat:['algodon'],  av:['stock'] },
    { id:35, ch:'tiburcio',   cat:'sticker', name:'Pack carnavalero',          sub:'Sticker pack ×8',              price:32000,  color:'tibu',  flag:null,   mat:['vinilo'],   av:['stock'] },
    { id:36, ch:'cuac',       cat:'peluche', name:'Cuac peluche',              sub:'Peluche · 26cm · edición 200', price:148000, color:'rio',   flag:null,   mat:['algodon'],  av:['stock'] },
    { id:37, ch:'roar',       cat:'tote',    name:'Tote páramo',               sub:'Tote · Lona reciclada',        price:54000,  color:'bone',  flag:null,   mat:['lona'],     av:['stock'] },
    { id:38, ch:'kiki',       cat:'libreta', name:'Cuaderno río',              sub:'Libreta · A5 · pauta',         price:48000,  color:'rosa',  flag:null,   mat:['papel'],    av:['stock'] },
    { id:39, ch:'yeison',     cat:'pin',     name:'Pin chigüiro',              sub:'Pin esmaltado',                price:22000,  color:'sol',   flag:null,   mat:['esmalte'],  av:['stock'] },
    { id:40, ch:'tiburcio',   cat:'pin',     name:'Pin tiburón',               sub:'Pin esmaltado · rayas',        price:24000,  color:'tibu',  flag:null,   mat:['esmalte'],  av:['stock'] },
    { id:41, ch:'colibriana', cat:'tote',    name:'Tote cafetero',             sub:'Tote · Lona reciclada',        price:54000,  color:'selva', flag:null,   mat:['lona'],     av:['stock'] },
    { id:42, ch:'abejandro',  cat:'pin',     name:'Pin abeja enojona',         sub:'Pin esmaltado',                price:22000,  color:'terra', flag:null,   mat:['esmalte'],  av:['stock'] },
  ];

  readonly LABEL_MAP: Record<string, string> = {
    cuac:'Cuac', kiki:'Kiki', roar:'Roar', yeison:'Yeison',
    abejandro:'Abejandro', atolita:'Atolita', colibriana:'Colibriana', tiburcio:'Tiburcio',
  };

  readonly CAT_SHORT: Record<string, string> = {
    tee:'Tee', tote:'Tote', libreta:'Libreta', sticker:'Sticker',
    pin:'Pin', gorra:'Gorra', peluche:'Peluche', print:'Print',
  };

  readonly CATEGORIES = [
    { id:'tee',     label:'Camisetas',  count:7 },
    { id:'tote',    label:'Tote bags',  count:5 },
    { id:'libreta', label:'Libretas',   count:6 },
    { id:'sticker', label:'Stickers',   count:8 },
    { id:'pin',     label:'Pines',      count:5 },
    { id:'gorra',   label:'Gorras',     count:4 },
    { id:'peluche', label:'Peluches',   count:3 },
    { id:'print',   label:'Prints',     count:4 },
  ];

  readonly CHARACTERS = [
    { id:'cuac',       label:'Cuac',       swatch:'var(--rio)',    count:8 },
    { id:'yeison',     label:'Yeison',     swatch:'#B07820',       count:5 },
    { id:'roar',       label:'Roar',       swatch:'var(--carbon)', count:6 },
    { id:'kiki',       label:'Kiki',       swatch:'var(--rosa)',   count:5 },
    { id:'abejandro',  label:'Abejandro',  swatch:'var(--terra)',  count:4 },
    { id:'atolita',    label:'Atolita',    swatch:'var(--lila)',   count:5 },
    { id:'colibriana', label:'Colibriana', swatch:'var(--selva)',  count:5 },
    { id:'tiburcio',   label:'Tiburcio',   swatch:'#2E8FB8',       count:4 },
  ];

  readonly MATERIALS = [
    { id:'algodon', label:'Algodón orgánico' },
    { id:'lona',    label:'Lona reciclada' },
    { id:'papel',   label:'Papel reciclado' },
    { id:'vinilo',  label:'Vinilo mate' },
    { id:'esmalte', label:'Esmalte / metal' },
  ];

  readonly AVAILABILITY = [
    { id:'stock', label:'En stock' },
    { id:'last',  label:'Últimas unidades' },
    { id:'new',   label:'Recién llegado' },
  ];

  // ── Computed ──────────────────────────────────────────────────────────────
  filteredProducts = computed(() => {
    const q     = this.query().toLowerCase().trim();
    const cats  = this.selectedCats();
    const chars = this.selectedChars();
    const mats  = this.selectedMats();
    const avail = this.selectedAvail();
    const pMin  = this.priceMin();
    const pMax  = this.priceMax();
    const sort  = this.sortOrder();

    let list = this.PRODUCTS.filter(p => {
      if (cats.size  && !cats.has(p.cat))                  return false;
      if (chars.size && !chars.has(p.ch))                  return false;
      if (mats.size  && !p.mat.some(m => mats.has(m)))     return false;
      if (avail.size && !p.av.some(a => avail.has(a)))     return false;
      if (pMin !== null && p.price < pMin)                 return false;
      if (pMax !== null && p.price > pMax)                 return false;
      if (q) {
        const hay = `${p.name} ${p.sub} ${this.LABEL_MAP[p.ch] ?? ''} ${this.CAT_SHORT[p.cat] ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sort === 'lo')  return [...list].sort((a, b) => a.price - b.price);
    if (sort === 'hi')  return [...list].sort((a, b) => b.price - a.price);
    if (sort === 'pop') return [...list].sort((a, b) => (b.flag === 'new' ? 1 : 0) - (a.flag === 'new' ? 1 : 0));
    return [...list].sort((a, b) => b.id - a.id);
  });

  activePipCount = computed(() =>
    this.selectedCats().size + this.selectedChars().size +
    this.selectedMats().size + this.selectedAvail().size +
    (this.priceMin() !== null ? 1 : 0) + (this.priceMax() !== null ? 1 : 0)
  );

  // ── Init ──────────────────────────────────────────────────────────────────
  ngOnInit() {
    const p = this.route.snapshot.queryParams;
    if (p['q'])   this.query.set(p['q']);
    if (p['cat']) this.selectedCats.set(new Set([p['cat']]));
    if (p['ch'])  this.selectedChars.set(new Set([p['ch']]));
  }

  // ── Filter toggles ────────────────────────────────────────────────────────
  private toggle(sig: { set(v: Set<string>): void; (): Set<string> }, id: string, checked: boolean) {
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

  addToCart(ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    this.cartCount.update(v => v + 1);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  fmtPrice(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }

  shortLabel(p: Product): string {
    return `${this.CAT_SHORT[p.cat] ?? ''}<br>${this.LABEL_MAP[p.ch] ?? ''}`;
  }

  trackById(_: number, p: Product): number { return p.id; }
}
