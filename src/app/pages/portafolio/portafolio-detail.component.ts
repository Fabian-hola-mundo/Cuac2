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

  // ── Labels ────────────────────────────────────────────────────────────────────
  authorLabel(a: string): string {
    if (a === 'natalia') return 'Natalia Castañeda Caicedo';
    if (a === 'nathali') return 'Nathali Ramírez Ortiz';
    return 'Cuac Design';
  }

  catLabel(id: string): string {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }

  // ── Lightbox ──────────────────────────────────────────────────────────────────
  openLightbox(i: number) {
    this.lightboxIdx.set(i);
    document.body.style.overflow = 'hidden';
  }

  closeLightbox() {
    this.lightboxIdx.set(null);
    document.body.style.overflow = '';
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
