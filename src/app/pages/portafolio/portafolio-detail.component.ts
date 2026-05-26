import { Component, signal, inject, OnInit } from '@angular/core';
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
export class PortafolioDetailComponent implements OnInit {
  private portfolioSvc = inject(PortfolioService);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);

  readonly categorias = PORTFOLIO_CATEGORIES;
  theme: Theme        = 'cuac';

  readonly project  = signal<PortfolioProject | null>(null);
  readonly cargando = signal(false);
  readonly notFound = signal(false);

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

  authorLabel(a: string): string {
    if (a === 'natalia') return 'Natalia Castañeda Caicedo';
    if (a === 'nathali') return 'Nathali Ramírez Ortiz';
    return 'Cuac Design';
  }

  catLabel(id: string): string {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }

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

  private deriveTheme(authors: string[]): Theme {
    if (authors.length === 1) {
      if (authors[0] === 'natalia') return 'natalia';
      if (authors[0] === 'nathali') return 'nathali';
    }
    return 'cuac';
  }
}
