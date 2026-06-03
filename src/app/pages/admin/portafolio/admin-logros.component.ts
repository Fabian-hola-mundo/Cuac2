import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  PortfolioService,
  Achievement,
  ACHIEVEMENT_TYPES,
  AUTHORS,
  PortfolioOwner,
} from '../../../core/services/portfolio.service';

interface Draft {
  id:           string | null;
  owners:       PortfolioOwner[];
  title:        string;
  organization: string;
  year:         number | null;
  type:         Achievement['type'];
  url:          string;
  sort_order:   number;
  published:    boolean;
}

@Component({
  selector: 'app-admin-logros',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-logros.component.html',
  styleUrl: './admin-logros.component.scss',
})
export class AdminLogrosComponent implements OnInit {
  private portfolio = inject(PortfolioService);

  readonly types   = ACHIEVEMENT_TYPES;
  readonly owners   = AUTHORS;
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly items    = signal<Achievement[]>([]);
  readonly ownerFiltro = signal<'all' | PortfolioOwner>('all');
  readonly confirmId   = signal<string | null>(null);

  readonly draft     = signal<Draft | null>(null);

  readonly filtered = computed(() => {
    const o = this.ownerFiltro();
    const list = this.items();
    return o === 'all' ? list : list.filter(i => (i.owners ?? []).includes(o as PortfolioOwner));
  });

  async ngOnInit() { await this.load(); }

  async load() {
    this.cargando.set(true);
    try { this.items.set(await this.portfolio.getAchievements()); }
    catch { this.errorMsg.set('Error al cargar los reconocimientos.'); }
    finally { this.cargando.set(false); }
  }

  private emptyDraft(): Draft {
    return {
      id: null, owners: ['cuac'], title: '', organization: '',
      year: new Date().getFullYear(), type: 'award', url: '',
      sort_order: 0, published: true,
    };
  }

  nuevo()  { this.draft.set(this.emptyDraft()); }
  cancelar() { this.draft.set(null); }

  editar(a: Achievement) {
    this.draft.set({
      id: a.id, owners: a.owners?.length ? a.owners : ['cuac'], title: a.title,
      organization: a.organization ?? '', year: a.year,
      type: a.type, url: a.url ?? '', sort_order: a.sort_order,
      published: a.published,
    });
  }

  draftHasOwner(owner: string): boolean {
    return this.draft()?.owners.includes(owner as PortfolioOwner) ?? false;
  }

  toggleOwner(owner: PortfolioOwner) {
    this.draft.update(d => {
      if (!d) return d;
      const has = d.owners.includes(owner);
      const next = has ? d.owners.filter(o => o !== owner) : [...d.owners, owner];
      return { ...d, owners: next.length ? next : [owner] };
    });
  }

  async guardar() {
    const d = this.draft();
    if (!d || !d.title.trim()) { this.errorMsg.set('El título es obligatorio.'); return; }
    this.guardando.set(true);
    this.errorMsg.set(null);

    const payload = {
      owners:       d.owners,
      title:        d.title.trim(),
      organization: d.organization.trim() || null,
      year:         d.year ? Number(d.year) : null,
      type:         d.type,
      url:          d.url.trim() || null,
      sort_order:   Number(d.sort_order) || 0,
      published:    d.published,
    };

    const result = d.id
      ? await this.portfolio.updateAchievement(d.id, payload)
      : await this.portfolio.createAchievement(payload);

    this.guardando.set(false);
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.draft.set(null);
    await this.load();
  }

  async togglePublished(a: Achievement) {
    const result = await this.portfolio.updateAchievement(a.id, { published: !a.published });
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.items.update(list => list.map(x => x.id === a.id ? { ...x, published: !x.published } : x));
  }

  confirmarEliminar(a: Achievement) { this.confirmId.set(a.id); }
  cancelarEliminar()                { this.confirmId.set(null); }

  async eliminar(a: Achievement) {
    const result = await this.portfolio.removeAchievement(a.id);
    this.confirmId.set(null);
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.items.update(list => list.filter(x => x.id !== a.id));
  }

  ownerLabel(id: string): string { return this.owners.find(o => o.id === id)?.label ?? id; }
  ownerColor(id: string): string { return this.owners.find(o => o.id === id)?.textColor ?? '#011E54'; }
  typeLabel(id: string): string  { return this.types.find(t => t.id === id)?.label ?? id; }
}
