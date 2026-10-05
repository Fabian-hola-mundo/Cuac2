// src/app/pages/admin/resenas/resenas-admin.component.ts
import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { ResenasService, Resena } from '../../../core/services/resenas.service';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { ResenaTextoComponent } from '../../../shared/resena-texto/resena-texto.component';
import { ResenasNuevasService } from './resenas-nuevas.service';
import { NotificationsService } from '../notifications/notifications.service';

type Filtro = 'todas' | 'pendientes' | 'publicadas' | 'nuevas';
type Orden  = 'recientes' | 'antiguas';

const POR_PAGINA = 20;

@Component({
  selector: 'app-resenas-admin',
  standalone: true,
  imports: [ResenaTextoComponent],
  templateUrl: './resenas-admin.component.html',
  styleUrl: './resenas-admin.component.scss',
})
export class ResenasAdminComponent implements OnInit {
  private resenas   = inject(ResenasService);
  private portfolio = inject(PortfolioService);
  private nuevasSvc = inject(ResenasNuevasService);
  private notifs    = inject(NotificationsService);

  cargando     = signal(true);
  error        = signal<string | null>(null);
  items        = signal<Resena[]>([]);
  proyectos    = signal<Array<{ id: string; title: string }>>([]);
  confirmarId  = signal<string | null>(null);
  guardandoId  = signal<string | null>(null);

  filtro       = signal<Filtro>('todas');
  busqueda     = signal('');
  proyectoSel  = signal<string>('');   // '' = todos · 'ninguno' = sin proyecto · id
  orden        = signal<Orden>('recientes');
  limite       = signal(POR_PAGINA);

  // Las que estaban sin leer al entrar; se fijan para que la etiqueta «Nueva»
  // siga visible mientras se revisa la página, aunque ya queden marcadas.
  private idsNuevos = signal<ReadonlySet<string>>(new Set());

  pendientes = computed(() => this.items().filter(r => !r.visible).length);
  visibles   = computed(() => this.items().filter(r => r.visible).length);
  nuevas     = computed(() => this.items().filter(r => this.esNueva(r)).length);

  filtradas = computed(() => {
    const q    = this.normalizar(this.busqueda().trim());
    const f    = this.filtro();
    const proy = this.proyectoSel();
    const list = this.items().filter(r => {
      if (f === 'pendientes' && r.visible)        return false;
      if (f === 'publicadas' && !r.visible)       return false;
      if (f === 'nuevas'     && !this.esNueva(r)) return false;
      if (proy === 'ninguno' && r.proyecto_id)    return false;
      if (proy && proy !== 'ninguno' && r.proyecto_id !== proy) return false;
      if (q) {
        const texto = this.normalizar([r.nombre, r.cargo_empresa, r.comentario, r.correo].filter(Boolean).join(' '));
        if (!texto.includes(q)) return false;
      }
      return true;
    });
    const dir = this.orden() === 'recientes' ? -1 : 1;
    return list.sort((a, b) => dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
  });

  /** Página actual agrupada por mes, para ubicarse rápido en listas largas. */
  grupos = computed(() => {
    const out: Array<{ mes: string; items: Resena[] }> = [];
    for (const r of this.filtradas().slice(0, this.limite())) {
      const mes = new Date(r.created_at).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
      const ultimo = out[out.length - 1];
      if (ultimo?.mes === mes) ultimo.items.push(r);
      else out.push({ mes, items: [r] });
    }
    return out;
  });

  restantes = computed(() => Math.max(0, this.filtradas().length - this.limite()));

  hayFiltros = computed(() =>
    this.filtro() !== 'todas' || !!this.busqueda().trim() || !!this.proyectoSel());

  async ngOnInit() {
    await this.cargar();
    this.idsNuevos.set(new Set(this.items().filter(r => r.leida === false).map(r => r.id)));
    this.notifs.quitarTipo('resena');
    void this.nuevasSvc.marcarVistas();
    if (this.nuevas() > 0) this.filtro.set('nuevas');
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

  setFiltro(f: Filtro)       { this.filtro.set(f);        this.limite.set(POR_PAGINA); }
  setBusqueda(q: string)     { this.busqueda.set(q);      this.limite.set(POR_PAGINA); }
  setProyecto(id: string)    { this.proyectoSel.set(id);  this.limite.set(POR_PAGINA); }
  setOrden(o: string)        { this.orden.set(o as Orden); }
  mostrarMas()               { this.limite.update(n => n + POR_PAGINA); }

  limpiarFiltros() {
    this.filtro.set('todas');
    this.busqueda.set('');
    this.proyectoSel.set('');
    this.limite.set(POR_PAGINA);
  }

  esNueva(r: Resena): boolean {
    return this.idsNuevos().has(r.id);
  }

  nombreProyecto(id: string | null): string | null {
    return id ? this.proyectos().find(p => p.id === id)?.title ?? null : null;
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

  private normalizar(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
}
