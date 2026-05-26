import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  PortfolioService,
  PortfolioProject,
  PORTFOLIO_CATEGORIES,
} from '../../core/services/portfolio.service';

type Theme = 'cuac' | 'natalia' | 'nathali';

// Maps theme key → author name used in portfolio_projects.authors[]
const THEME_AUTHOR: Record<Theme, string> = {
  cuac:    'cuac',
  natalia: 'natalia',
  nathali: 'nathali',
};

const HERO_DATA: Record<Theme, { name: string; role: string; tagline: string }> = {
  cuac: {
    name: 'Nuestro trabajo',
    role: 'Cuac Design · Bogotá',
    tagline: 'Branding, diseño editorial, ilustración y diseño digital.',
  },
  natalia: {
    name: 'Natalia Castañeda Caicedo',
    role: 'Diseño editorial, ilustración y branding',
    tagline: 'tagline provisional',
  },
  nathali: {
    name: 'Nathali Ramírez Ortiz',
    role: 'Diseño UI/UX, ilustración y branding',
    tagline: 'tagline provisional',
  },
};

@Component({
  selector: 'app-portafolio-shell',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portafolio-shell.component.html',
  styleUrl: './portafolio-shell.component.scss',
  host: { '[attr.data-theme]': 'theme' },
})
export class PortafolioShellComponent implements OnInit {
  private portfolioSvc = inject(PortfolioService);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);

  theme: Theme = 'cuac';
  readonly categorias = PORTFOLIO_CATEGORIES;
  readonly cargando   = signal(false);
  readonly projects   = signal<PortfolioProject[]>([]);
  readonly catFiltro  = signal<string>('all');

  get hero() { return HERO_DATA[this.theme]; }
  get isCuac() { return this.theme === 'cuac'; }

  filteredProjects = computed(() => {
    const cat  = this.catFiltro();
    const list = this.projects();
    return cat === 'all' ? list : list.filter(p => p.category === cat);
  });

  async ngOnInit() {
    this.theme = (this.route.snapshot.data['theme'] as Theme) ?? 'cuac';
    this.cargando.set(true);
    const author = THEME_AUTHOR[this.theme];
    const data = await this.portfolioSvc.getPublished(author);
    this.projects.set(data);
    this.cargando.set(false);
  }
}
