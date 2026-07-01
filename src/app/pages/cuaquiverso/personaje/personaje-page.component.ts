import { Component, OnInit, OnDestroy, HostListener, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { PersonajesService, Personaje } from '../../../core/services/personajes.service';
import { InventarioService, ProductoEvento } from '../../../core/services/inventario.service';
import { CartService } from '../services/cart.service';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { CuaquiversoFooterComponent } from '../footer/cuaquiverso-footer.component';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-personaje-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CartModalComponent, CuaquiversoFooterComponent],
  templateUrl: './personaje-page.component.html',
  styleUrl: './personaje-page.component.scss',
})
export class PersonajePageComponent implements OnInit, OnDestroy {
  private route              = inject(ActivatedRoute);
  private router             = inject(Router);
  private seo                = inject(SeoService);
  readonly svcP              = inject(PersonajesService);
  readonly svcI              = inject(InventarioService);
  readonly cart              = inject(CartService);
  readonly String            = String;

  personaje    = signal<Personaje | null>(null);
  productos    = signal<ProductoEvento[]>([]);
  selectedIdx  = signal(0);
  lightboxOpen = signal(false);
  lightboxIdx  = signal(0);

  prev = computed(() => {
    const p = this.personaje();
    if (!p) return null;
    const all = this.svcP.activos();
    const idx = all.findIndex(x => x.id === p.id);
    return idx > 0 ? all[idx - 1] : null;
  });

  next = computed(() => {
    const p = this.personaje();
    if (!p) return null;
    const all = this.svcP.activos();
    const idx = all.findIndex(x => x.id === p.id);
    return idx < all.length - 1 ? all[idx + 1] : null;
  });

  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    await this.svcP.load();
    const p = this.svcP.activos().find(x => x.key === slug);
    if (!p) { this.router.navigate(['/cuaquiverso/universo']); return; }
    this.personaje.set(p);
    this.selectedIdx.set(0);

    this.seo.set({
      title:       `${p.nombre} — Cuaquiverso`,
      description: p.bio ? p.bio.slice(0, 160) : `Conoce a ${p.nombre} del Cuaquiverso.`,
      canonical:   `https://cuacdesign.com/cuaquiverso/personaje/${p.key}`,
    });

    await this.svcI.cargarTodos();
    this.productos.set(
      this.svcI.productos().filter(pr => pr.personaje === slug && pr.activo)
    );
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  // ─── Gallery ──────────────────────────────────────────────────────────────
  galleryPrev() {
    const len = this.personaje()?.galeria_urls.length ?? 0;
    if (len > 1) this.selectedIdx.set((this.selectedIdx() - 1 + len) % len);
  }

  galleryNext() {
    const len = this.personaje()?.galeria_urls.length ?? 0;
    if (len > 1) this.selectedIdx.set((this.selectedIdx() + 1) % len);
  }

  // ─── Lightbox ─────────────────────────────────────────────────────────────
  openLightbox(idx: number) {
    this.lightboxIdx.set(idx);
    this.lightboxOpen.set(true);
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      (document.querySelector('.pj-lb-close') as HTMLElement)?.focus();
    }, 40);
  }

  closeLightbox() {
    this.lightboxOpen.set(false);
    document.body.style.overflow = '';
  }

  lightboxPrev() {
    const urls = this.personaje()?.galeria_urls ?? [];
    const newIdx = (this.lightboxIdx() - 1 + urls.length) % urls.length;
    this.lightboxIdx.set(newIdx);
    this.selectedIdx.set(newIdx);
  }

  lightboxNext() {
    const urls = this.personaje()?.galeria_urls ?? [];
    const newIdx = (this.lightboxIdx() + 1) % urls.length;
    this.lightboxIdx.set(newIdx);
    this.selectedIdx.set(newIdx);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (!this.lightboxOpen()) return;
    if (e.key === 'Escape')     { e.preventDefault(); this.closeLightbox(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); this.lightboxPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); this.lightboxNext(); }
  }

  addToCart(event: Event, p: ProductoEvento) {
    event.preventDefault();
    event.stopPropagation();
    this.cart.add({
      id:        p.id,
      name:      p.nombre,
      sub:       p.categoria,
      price:     p.precio,
      color:     p.color ?? '#ccc',
      categoria: p.categoria,
    });
  }

  getTextColor(hex: string | null | undefined): string {
    const h = (hex ?? '#2A6FDB').replace('#', '');
    if (h.length !== 6) return '#ffffff';
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.35 ? '#151F28' : '#ffffff';
  }

  getTextMuted(hex: string | null | undefined): string {
    return this.getTextColor(hex) === '#ffffff'
      ? 'rgba(255,255,255,0.68)'
      : 'rgba(21,31,40,0.52)';
  }
}
