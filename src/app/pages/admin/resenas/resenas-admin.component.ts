// src/app/pages/admin/resenas/resenas-admin.component.ts
import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { ResenasService, Resena } from '../../../core/services/resenas.service';
import { PortfolioService } from '../../../core/services/portfolio.service';

@Component({
  selector: 'app-resenas-admin',
  standalone: true,
  imports: [],
  templateUrl: './resenas-admin.component.html',
  styleUrl: './resenas-admin.component.scss',
})
export class ResenasAdminComponent implements OnInit {
  private resenas   = inject(ResenasService);
  private portfolio = inject(PortfolioService);

  cargando     = signal(true);
  error        = signal<string | null>(null);
  items        = signal<Resena[]>([]);
  proyectos    = signal<Array<{ id: string; title: string }>>([]);
  confirmarId  = signal<string | null>(null);
  guardandoId  = signal<string | null>(null);

  pendientes = computed(() => this.items().filter(r => !r.visible).length);
  visibles   = computed(() => this.items().filter(r => r.visible).length);

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    const [resenas, proyectos] = await Promise.all([
      this.resenas.getTodas(),
      this.portfolio.getAll(),
    ]);
    this.items.set(resenas);
    this.proyectos.set(proyectos.map(p => ({ id: p.id, title: p.title })));
    this.cargando.set(false);
  }

  async toggleVisible(r: Resena) {
    await this.guardar(r, { visible: !r.visible });
  }

  async asignarProyecto(r: Resena, proyectoId: string) {
    await this.guardar(r, { proyecto_id: proyectoId || null });
  }

  async eliminar(r: Resena) {
    this.error.set(null);
    const { error } = await this.resenas.eliminar(r.id);
    if (error) { this.error.set('No se pudo eliminar la reseña.'); return; }
    this.items.update(list => list.filter(i => i.id !== r.id));
    this.confirmarId.set(null);
  }

  private async guardar(r: Resena, patch: Partial<Pick<Resena, 'visible' | 'proyecto_id'>>) {
    this.error.set(null);
    this.guardandoId.set(r.id);
    const { error } = await this.resenas.actualizar(r.id, patch);
    this.guardandoId.set(null);
    if (error) { this.error.set('No se pudo guardar el cambio.'); return; }
    this.items.update(list => list.map(i => i.id === r.id ? { ...i, ...patch } : i));
  }

  fecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
