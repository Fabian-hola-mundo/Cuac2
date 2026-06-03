import { Component, HostListener, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import {
  PortfolioService,
  PortfolioProject,
  PORTFOLIO_CATEGORIES,
} from '../../core/services/portfolio.service';

type Theme = 'cuac' | 'natalia' | 'nathali';

@Component({
  selector: 'app-portafolio-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portafolio-detail.component.html',
  styleUrl: './portafolio-detail.component.scss',
  host: { '[attr.data-theme]': 'theme' },
})
export class PortafolioDetailComponent implements OnInit, OnDestroy {
  private portfolioSvc = inject(PortfolioService);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);

  readonly categorias   = PORTFOLIO_CATEGORIES;
  theme: Theme          = 'cuac';

  readonly project      = signal<PortfolioProject | null>(null);
  readonly cargando     = signal(false);
  readonly notFound     = signal(false);
  readonly lightboxIdx  = signal<number | null>(null);
  readonly nextProject  = signal<PortfolioProject | null>(null);
  readonly prevProject  = signal<PortfolioProject | null>(null);
  private lastFocusedItem: HTMLElement | null = null;

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

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (this.lightboxIdx() === null) return;
    if (e.key === 'Escape')     this.closeLightbox();
    if (e.key === 'ArrowLeft')  this.prevImage();
    if (e.key === 'ArrowRight') this.nextImage();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) { this.router.navigate(['/portafolio']); return; }

    this.cargando.set(true);
    const p = await this.portfolioSvc.getBySlug(slug);
    this.cargando.set(false);

    if (!p) { this.notFound.set(true); return; }
    this.project.set(p);
    this.theme = this.deriveTheme(p.authors);

    const siblings = await this.portfolioSvc.getPublished(this.theme);
    const idx = siblings.findIndex(s => s.id === p.id);
    this.prevProject.set(siblings[idx - 1] ?? null);
    this.nextProject.set(siblings[idx + 1] ?? null);
  }

  ngOnDestroy() {
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
