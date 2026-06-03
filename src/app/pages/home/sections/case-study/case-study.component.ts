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

  readonly project  = signal<PortfolioProject | null>(null);
  readonly cargando = signal(true);

  readonly collageImages = computed<string[]>(() => {
    const p = this.project();
    if (!p) return [];
    return [p.cover_url, ...p.images]
      .filter((u): u is string => !!u)
      .slice(0, 5);
  });

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
