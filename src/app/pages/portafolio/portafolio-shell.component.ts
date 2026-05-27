import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import {
  PortfolioService,
  PortfolioProject,
  PORTFOLIO_CATEGORIES,
} from '../../core/services/portfolio.service';
import { PortfolioShaderComponent } from './shader/portfolio-shader.component';

type Theme = 'cuac' | 'natalia' | 'nathali';

const THEME_AUTHOR: Record<Theme, string> = {
  cuac:    'cuac',
  natalia: 'natalia',
  nathali: 'nathali',
};

interface HeroData {
  eyebrow:     string;
  h1Main:      string;
  h1Sub:       string;
  rol:         string;
  disciplinas: string;
  height:      string;
}

const HERO_DATA: Record<Theme, HeroData> = {
  cuac: {
    eyebrow:     'Estudio · Cuac Design',
    h1Main:      'Nuestro',
    h1Sub:       'trabajo',
    rol:         'Cuac Design · Bogotá',
    disciplinas: 'Branding · Editorial · Ilustración · Web',
    height:      '100vh',
  },
  natalia: {
    eyebrow:     'Portafolio personal',
    h1Main:      'Natalia',
    h1Sub:       'Castañeda Caicedo',
    rol:         'Diseño editorial, ilustración y branding',
    disciplinas: '',
    height:      '80vh',
  },
  nathali: {
    eyebrow:     'Portafolio personal',
    h1Main:      'Nathali',
    h1Sub:       'Ramírez Ortiz',
    rol:         'Diseño UI/UX, ilustración y branding',
    disciplinas: '',
    height:      '80vh',
  },
};

export type SpanProject = PortfolioProject & { span: number; ar: string };

function assignSpans(projects: PortfolioProject[]): SpanProject[] {
  const out: SpanProject[] = [];
  let i = 0;
  while (i < projects.length) {
    const rem = projects.length - i;
    if (projects[i].featured && rem >= 2) {
      out.push({ ...projects[i],     span: 8, ar: '4/3' });
      out.push({ ...projects[i + 1], span: 4, ar: '3/4' });
      i += 2;
    } else if (rem >= 3) {
      out.push({ ...projects[i],     span: 4, ar: '1/1' });
      out.push({ ...projects[i + 1], span: 4, ar: '1/1' });
      out.push({ ...projects[i + 2], span: 4, ar: '1/1' });
      i += 3;
    } else if (rem === 2) {
      out.push({ ...projects[i],     span: 5, ar: '3/4' });
      out.push({ ...projects[i + 1], span: 7, ar: '4/3' });
      i += 2;
    } else {
      out.push({ ...projects[i], span: 12, ar: '16/9' });
      i += 1;
    }
  }
  return out;
}

@Component({
  selector: 'app-portafolio-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, PortfolioShaderComponent],
  templateUrl: './portafolio-shell.component.html',
  styleUrl: './portafolio-shell.component.scss',
  host: { '[attr.data-theme]': 'theme' },
})
export class PortafolioShellComponent implements OnInit {
  private portfolioSvc = inject(PortfolioService);
  private route        = inject(ActivatedRoute);

  theme: Theme = 'cuac';
  readonly categorias = PORTFOLIO_CATEGORIES;
  readonly cargando   = signal(false);
  readonly projects   = signal<PortfolioProject[]>([]);
  readonly catFiltro  = signal<string>('all');

  get hero(): HeroData  { return HERO_DATA[this.theme]; }
  get isCuac(): boolean { return this.theme === 'cuac'; }

  readonly filteredProjects = computed<SpanProject[]>(() => {
    const cat      = this.catFiltro();
    const list     = this.projects();
    const filtered = cat === 'all' ? list : list.filter(p => p.category === cat);
    return assignSpans(filtered);
  });

  readonly totalCount = computed(() => this.projects().length);

  countFor(catId: string): number {
    return this.projects().filter(p => p.category === catId).length;
  }

  catLabel(id: string): string {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }

  async ngOnInit() {
    this.theme = (this.route.snapshot.data['theme'] as Theme) ?? 'cuac';
    this.cargando.set(true);
    const data = await this.portfolioSvc.getPublished(THEME_AUTHOR[this.theme]);
    this.projects.set(data);
    this.cargando.set(false);
  }
}
