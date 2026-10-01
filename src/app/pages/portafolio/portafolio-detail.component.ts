import { Component, HostListener, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  PortfolioService,
  PortfolioProject,
  PORTFOLIO_CATEGORIES,
} from '../../core/services/portfolio.service';
import { SeoService } from '../../core/services/seo.service';
import { ResenasService, Resena } from '../../core/services/resenas.service';
import { ResenaTextoComponent } from '../../shared/resena-texto/resena-texto.component';

type Theme = 'cuac' | 'natalia' | 'nathali';

@Component({
  selector: 'app-portafolio-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ResenaTextoComponent],
  templateUrl: './portafolio-detail.component.html',
  styleUrl: './portafolio-detail.component.scss',
  host: { '[attr.data-theme]': 'theme' },
})
export class PortafolioDetailComponent implements OnInit, OnDestroy {
  private portfolioSvc = inject(PortfolioService);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  private seo          = inject(SeoService);
  private resenasSvc   = inject(ResenasService);

  readonly categorias   = PORTFOLIO_CATEGORIES;
  theme: Theme          = 'cuac';

  readonly project      = signal<PortfolioProject | null>(null);
  readonly resena       = signal<Resena | null>(null);
  readonly cargando     = signal(false);
  readonly notFound     = signal(false);
  readonly lightboxIdx  = signal<number | null>(null);
  readonly nextProject  = signal<PortfolioProject | null>(null);
  readonly prevProject  = signal<PortfolioProject | null>(null);
  private lastFocusedItem: HTMLElement | null = null;
  private paramSub?: Subscription;
  private loadToken = 0;

  // ── Navigation ───────────────────────────────────────────────────────────────
  get backUrl(): string {
    const p = this.project();
    if (!p) return '/portafolio';
    if (p.authors.length === 1 && p.authors[0] === 'natalia') return '/portafolio/natalia';
    if (p.authors.length === 1 && p.authors[0] === 'nathali') return '/portafolio/nathali';
    return '/portafolio';
  }

  get backLabel(): string {
    const p = this.project();
    if (!p) return '← Portafolio';
    if (p.authors.length === 1 && p.authors[0] === 'natalia') return '← Natalia';
    if (p.authors.length === 1 && p.authors[0] === 'nathali') return '← Nathali';
    return '← Portafolio';
  }

  get backCrumb(): string {
    const p = this.project();
    if (!p) return 'Portafolio';
    if (p.authors.length === 1 && p.authors[0] === 'natalia') return 'Natalia';
    if (p.authors.length === 1 && p.authors[0] === 'nathali') return 'Nathali';
    return 'Portafolio';
  }

  // ── Labels ────────────────────────────────────────────────────────────────────
  authorLabel(a: string): string {
    if (a === 'natalia') return 'Natalia Castañeda Caicedo';
    if (a === 'nathali') return 'Nathali Ramírez Ortiz';
    return 'Cuac Design';
  }

  catLabel(id: string): string {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }

  safeBg(url: string | null): string {
    if (!url || !/^https?:\/\//.test(url)) return 'none';
    return `url(${url})`;
  }

  // Contextual contact CTA — mirrors the site-wide mailto conversion pattern
  contactHref(): string {
    const p = this.project();
    const subject = p
      ? `Quiero un proyecto como ${p.title}`
      : 'Quiero empezar un proyecto';
    return `mailto:hola@cuacdesign.com?subject=${encodeURIComponent(subject)}`;
  }

  readonly callHref = 'https://calendar.app.google/9K3XvbmoULftjJFR7';

  // ── Links ─────────────────────────────────────────────────────────────────────
  linkDomain(url: string): string {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return url; }
  }

  // ── Lightbox ──────────────────────────────────────────────────────────────────
  openLightbox(i: number, event?: MouseEvent) {
    this.lastFocusedItem = (event?.currentTarget as HTMLElement) ?? null;
    this.lightboxIdx.set(i);
    document.body.style.overflow = 'hidden';
    setTimeout(() => (document.querySelector('.lb-close') as HTMLElement)?.focus(), 50);
  }

  closeLightbox() {
    this.lightboxIdx.set(null);
    document.body.style.overflow = '';
    setTimeout(() => this.lastFocusedItem?.focus(), 50);
  }

  prevImage() {
    const images = this.project()?.images ?? [];
    const cur = this.lightboxIdx();
    if (cur === null || images.length === 0) return;
    this.lightboxIdx.set((cur - 1 + images.length) % images.length);
  }

  nextImage() {
    const images = this.project()?.images ?? [];
    const cur = this.lightboxIdx();
    if (cur === null || images.length === 0) return;
    this.lightboxIdx.set((cur + 1) % images.length);
  }

  // Deslizar en táctil: izquierda → siguiente, derecha → anterior
  private swipeStart: { x: number; y: number } | null = null;
  private swiped = false;

  onLbTouchStart(e: TouchEvent) {
    const t = e.changedTouches[0];
    this.swipeStart = { x: t.clientX, y: t.clientY };
    this.swiped = false;
  }

  onLbTouchEnd(e: TouchEvent) {
    if (!this.swipeStart) return;
    const t  = e.changedTouches[0];
    const dx = t.clientX - this.swipeStart.x;
    const dy = t.clientY - this.swipeStart.y;
    this.swipeStart = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    this.swiped = true;
    if (dx < 0) this.nextImage(); else this.prevImage();
  }

  // El clic sobre el fondo cierra, salvo que venga justo de un deslizamiento
  onLbBackdrop() {
    if (this.swiped) { this.swiped = false; return; }
    this.closeLightbox();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (this.lightboxIdx() === null) return;
    if (e.key === 'Escape')     this.closeLightbox();
    if (e.key === 'ArrowLeft')  this.prevImage();
    if (e.key === 'ArrowRight') this.nextImage();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  // El router reutiliza este componente al ir de un proyecto a otro (anterior /
  // siguiente), así que el slug se escucha en vez de leerse una sola vez.
  ngOnInit() {
    this.paramSub = this.route.paramMap.subscribe(params => this.load(params.get('slug')));
  }

  private async load(slug: string | null) {
    if (!slug) { this.router.navigate(['/portafolio']); return; }
    const token = ++this.loadToken;

    if (this.lightboxIdx() !== null) this.closeLightbox();
    this.project.set(null);
    this.resena.set(null);
    this.prevProject.set(null);
    this.nextProject.set(null);
    this.notFound.set(false);
    this.cargando.set(true);
    const p = await this.portfolioSvc.getBySlug(slug);
    if (token !== this.loadToken) return;
    this.cargando.set(false);

    if (!p) { this.notFound.set(true); return; }
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    this.project.set(p);
    this.seo.setProject(p);
    this.seo.setJsonLd({
      '@context':   'https://schema.org',
      '@type':      'CreativeWork',
      name:         p.title,
      description:  p.headline ?? p.description ?? '',
      creator:      { '@type': 'Organization', name: 'Cuac Design' },
      image:        p.cover_url ?? '',
      url:          `https://cuacdesign.com/portafolio/${p.slug}`,
    });
    this.theme = this.deriveTheme(p.authors);

    this.resenasSvc.getPorProyecto(p.id).then(r => {
      if (token === this.loadToken) this.resena.set(r[0] ?? null);
    });

    // Hermanos del mismo portafolio; si el proyecto no está en esa lista (p. ej.
    // autoría natalia + nathali sin cuac), se navega por todos los publicados.
    let siblings = await this.portfolioSvc.getPublished(this.theme);
    if (!siblings.some(s => s.id === p.id)) siblings = await this.portfolioSvc.getPublished();
    if (token !== this.loadToken) return;
    const idx = siblings.findIndex(s => s.id === p.id);
    const n = siblings.length;
    if (idx === -1 || n < 2) return;
    this.prevProject.set(siblings[(idx - 1 + n) % n]);
    this.nextProject.set(siblings[(idx + 1) % n]);
  }

  ngOnDestroy() {
    this.paramSub?.unsubscribe();
    document.body.style.overflow = '';
  }

  private deriveTheme(authors: string[]): Theme {
    if (authors.length === 1) {
      if (authors[0] === 'natalia') return 'natalia';
      if (authors[0] === 'nathali') return 'nathali';
    }
    return 'cuac';
  }
}
