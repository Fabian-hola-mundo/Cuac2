import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  PortfolioService,
  PortfolioProject,
  PORTFOLIO_CATEGORIES,
} from '../../../core/services/portfolio.service';

@Component({
  selector: 'app-admin-portafolio-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-portafolio-list.component.html',
  styleUrl: './admin-portafolio-list.component.scss',
})
export class AdminPortafolioListComponent implements OnInit {
  private router    = inject(Router);
  private portfolio = inject(PortfolioService);

  readonly categorias  = PORTFOLIO_CATEGORIES;
  readonly cargando    = signal(false);
  readonly projects    = signal<PortfolioProject[]>([]);
  readonly catFiltro   = signal<string>('all');
  readonly errorMsg    = signal<string | null>(null);
  readonly confirmId   = signal<string | null>(null);

  readonly filteredProjects = computed(() => {
    const cat  = this.catFiltro();
    const list = this.projects();
    return cat === 'all' ? list : list.filter(p => p.category === cat);
  });

  async ngOnInit() {
    this.cargando.set(true);
    try {
      this.projects.set(await this.portfolio.getAll());
    } catch {
      this.errorMsg.set('Error al cargar proyectos.');
    } finally {
      this.cargando.set(false);
    }
  }

  nuevo()                       { this.router.navigate(['/admin/portafolio/nuevo']); }
  editar(p: PortfolioProject)   { this.router.navigate(['/admin/portafolio', p.id, 'editar']); }

  async togglePublished(p: PortfolioProject) {
    const result = await this.portfolio.update(p.id, { published: !p.published });
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.errorMsg.set(null);
    this.projects.update(list =>
      list.map(x => x.id === p.id ? { ...x, published: !x.published } : x)
    );
  }

  confirmarEliminar(p: PortfolioProject) { this.confirmId.set(p.id); }
  cancelarEliminar()                     { this.confirmId.set(null); }

  async eliminar(p: PortfolioProject) {
    const result = await this.portfolio.remove(p.id);
    this.confirmId.set(null);
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.errorMsg.set(null);
    this.projects.update(list => list.filter(x => x.id !== p.id));
  }

  authorColor(author: string): string {
    if (author === 'natalia') return '#E87A89';
    if (author === 'nathali') return '#8B9ED9';
    return '#011E54';
  }

  catLabel(id: string): string {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }
}
