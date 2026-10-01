import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  PortfolioService,
  PortfolioProject,
  PORTFOLIO_CATEGORIES,
} from '../../../../core/services/portfolio.service';

@Component({
  selector: 'app-case-study',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './case-study.component.html',
  styleUrl: './case-study.component.scss',
})
export class CaseStudyComponent implements OnInit {
  private portfolioSvc = inject(PortfolioService);

  readonly project      = signal<PortfolioProject | null>(null);
  readonly cargando     = signal(true);
  readonly descExpanded = signal(false);

  readonly descNeedsExpand = computed(() =>
    (this.project()?.description?.length ?? 0) > 280
  );

  /** URLs que fallaron al cargar: se sacan del collage para no dejar huecos. */
  private readonly imagenesRotas = signal<ReadonlySet<string>>(new Set());

  readonly collageImages = computed<string[]>(() => {
    const p = this.project();
    if (!p) return [];
    const rotas = this.imagenesRotas();
    // Sin duplicados (la portada suele repetirse en la galería) ni rotas.
    return [...new Set([p.cover_url, ...(p.images ?? [])])]
      .filter((u): u is string => !!u && !rotas.has(u))
      .slice(0, 5);
  });

  marcarRota(url: string) {
    this.imagenesRotas.update(s => new Set(s).add(url));
  }

  readonly categoryLabel = computed<string>(() => {
    const p = this.project();
    if (!p) return '';
    return PORTFOLIO_CATEGORIES.find(c => c.id === p.category)?.label ?? p.category;
  });

  async ngOnInit() {
    const p = await this.portfolioSvc.getFeatured('cuac');
    this.project.set(p);
    this.cargando.set(false);
  }
}
