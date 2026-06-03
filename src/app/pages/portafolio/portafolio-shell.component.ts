import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import {
  PortfolioService,
  PortfolioProject,
  Achievement,
  PortfolioProfile,
  PortfolioOwner,
  ACHIEVEMENT_TYPES,
  PORTFOLIO_CATEGORIES,
} from '../../core/services/portfolio.service';
import { PortfolioShaderComponent } from './shader/portfolio-shader.component';

type Theme = 'cuac' | 'natalia' | 'nathali';

const THEME_AUTHOR: Record<Theme, PortfolioOwner> = {
  cuac:    'cuac',
  natalia: 'natalia',
  nathali: 'nathali',
};

interface HeroData {
  eyebrow:     string;
  h1Main:      string;
  h1Sub:       string;
  lede:        string;
  rol:         string;
  disciplinas: string[];
  height:      string;
}

const HERO_DATA: Record<Theme, HeroData> = {
  cuac: {
    eyebrow:     'Estudio · Cuac Design',
    h1Main:      'Nuestro',
    h1Sub:       'trabajo',
    lede:        'Diseño que defiende un punto de vista.',
    rol:         'Bogotá · desde 2024',
    disciplinas: ['Branding', 'Editorial', 'Ilustración', 'Web'],
    height:      '88vh',
  },
  natalia: {
    eyebrow:     'Portafolio personal',
    h1Main:      'Natalia',
    h1Sub:       'Castañeda Caicedo',
    lede:        '',
    rol:         'Diseño editorial, ilustración y branding',
    disciplinas: [],
    height:      '76vh',
  },
  nathali: {
    eyebrow:     'Portafolio personal',
    h1Main:      'Nathali',
    h1Sub:       'Ramírez Ortiz',
    lede:        '',
    rol:         'Diseño UI/UX, ilustración y branding',
    disciplinas: [],
    height:      '76vh',
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
      // featured flag intentionally ignored when only 2 remain — use generic 2-item layout
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
  host: { '[attr.data-theme]': 'theme()' },
})
export class PortafolioShellComponent implements OnInit {
  private portfolioSvc = inject(PortfolioService);
  private route        = inject(ActivatedRoute);

  readonly theme        = signal<Theme>('cuac');
  readonly categorias   = PORTFOLIO_CATEGORIES;
  readonly cargando     = signal(false);
  readonly projects     = signal<PortfolioProject[]>([]);
  readonly catFiltro    = signal<string>('all');
  readonly profile      = signal<PortfolioProfile | null>(null);
  readonly achievements = signal<Achievement[]>([]);
  readonly bioExpanded  = signal(false);

  get bioNeedsExpand(): boolean {
    return (this.profile()?.bio?.length ?? 0) > 280;
  }

  get hero(): HeroData  { return HERO_DATA[this.theme()]; }
  get isCuac(): boolean { return this.theme() === 'cuac'; }

  get aboutKicker(): string { return this.isCuac ? 'El colectivo' : 'El perfil'; }
  get aboutName(): string {
    const h = this.hero;
    return this.isCuac ? 'Cuac Design' : `${h.h1Main} ${h.h1Sub}`;
  }

  achTypeLabel(type: string): string {
    return ACHIEVEMENT_TYPES.find(t => t.id === type)?.label ?? type;
  }

  readonly filteredProjects = computed<SpanProject[]>(() => {
    const cat      = this.catFiltro();
    const list     = this.projects();
    const filtered = cat === 'all' ? list : list.filter(p => p.category === cat);
    return assignSpans(filtered);
  });

  readonly totalCount = computed(() => this.projects().length);

  readonly countPerCat = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const p of this.projects()) {
      map[p.category] = (map[p.category] ?? 0) + 1;
    }
    return map;
  });

  countFor(catId: string): number {
    return this.countPerCat()[catId] ?? 0;
  }

  catLabel(id: string): string {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }

  safeBg(url: string | null): string {
    if (!url || !/^https?:\/\//.test(url)) return 'none';
    return `url(${url})`;
  }

  async ngOnInit() {
    this.theme.set((this.route.snapshot.data['theme'] as Theme) ?? 'cuac');
    const owner = THEME_AUTHOR[this.theme()];
    this.cargando.set(true);
    try {
      const [data, profile, achievements] = await Promise.all([
        this.portfolioSvc.getPublished(owner),
        this.portfolioSvc.getProfile(owner),
        this.portfolioSvc.getAchievements(owner, true),
      ]);
      this.projects.set(data);
      this.profile.set(profile);
      this.achievements.set(achievements);
    } finally {
      this.cargando.set(false);
    }
  }
}
