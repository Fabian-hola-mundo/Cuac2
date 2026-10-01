import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  PortfolioService,
  PortfolioProject,
  PORTFOLIO_CATEGORIES,
} from '../../../../core/services/portfolio.service';
import { Foco, varsFoco } from '../../../../core/utils/encuadre-foco';

/** Una celda del collage: la foto y el encuadre que se le dio en el admin. */
interface CollageImg { url: string; foco: Foco | null; }

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

  readonly collageImages = computed<CollageImg[]>(() => {
    const p = this.project();
    if (!p) return [];
    const rotas = this.imagenesRotas();
    // La portada lleva el encuadre de la tarjeta; cada foto de la galería, el suyo.
    const todas: CollageImg[] = [
      ...(p.cover_url ? [{ url: p.cover_url, foco: p.cover_focus_card }] : []),
      ...(p.images ?? []).map((url, i) => ({ url, foco: p.images_focus?.[i] ?? null })),
    ];
    // Sin duplicados (la portada suele repetirse en la galería) ni rotas.
    const vistas = new Set<string>();
    return todas
      .filter(img => {
        if (!img.url || rotas.has(img.url) || vistas.has(img.url)) return false;
        vistas.add(img.url);
        return true;
      })
      .slice(0, 5);
  });

  /** Encuadre guardado (punto y zoom), como variables CSS. */
  readonly varsFoco = varsFoco;

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
