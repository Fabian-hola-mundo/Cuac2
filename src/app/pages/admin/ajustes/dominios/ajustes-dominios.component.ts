import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type TipoDominio = 'principal' | 'alias' | 'redirect';
type VerifState  = 'idle' | 'checking' | 'records' | 'verified';

interface Dominio { id: number; dominio: string; tipo: TipoDominio; ssl: boolean; activo: boolean; }
interface Redirect { id: number; origen: string; destino: string; tipo: '301' | '302'; activo: boolean; }

@Component({
  selector: 'app-ajustes-dominios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-dominios.component.html',
  styleUrl: './ajustes-dominios.component.scss',
})
export class AjustesDominiosComponent {
  /** Dominio público real del sitio. */
  readonly DOMINIO_PRINCIPAL = 'cuacdesign.com';

  dominios = signal<Dominio[]>([]);

  redirects = signal<Redirect[]>([]);

  newDomain      = signal('');
  newDomainTipo  = signal<TipoDominio>('alias');
  verifState     = signal<VerifState>('idle');
  addingDomain   = signal(false);
  addingRedirect = signal(false);
  newRedOrigen   = signal('');
  newRedDestino  = signal('');
  newRedTipo     = signal<'301' | '302'>('301');
  nextId         = 1;
  nextRedId      = 1;

  /** Registros DNS a configurar; se llenan con los que indique el hosting. */
  readonly DNS_RECORDS: { tipo: string; host: string; valor: string }[] = [];

  async verificar() {
    if (!this.newDomain().trim()) return;
    this.verifState.set('checking');
    await new Promise(r => setTimeout(r, 1500));
    this.verifState.set('records');
  }

  async reVerificar() {
    this.verifState.set('checking');
    await new Promise(r => setTimeout(r, 1200));
    this.dominios.update(d => [...d, {
      id: this.nextId++,
      dominio: this.newDomain(),
      tipo: this.newDomainTipo(),
      ssl: false,
      activo: true,
    }]);
    this.newDomain.set('');
    this.verifState.set('idle');
    this.addingDomain.set(false);
  }

  eliminarDominio(id: number) { this.dominios.update(d => d.filter(x => x.id !== id)); }

  agregarRedirect() {
    if (!this.newRedOrigen().trim() || !this.newRedDestino().trim()) return;
    this.redirects.update(r => [...r, {
      id: this.nextRedId++,
      origen: this.newRedOrigen(),
      destino: this.newRedDestino(),
      tipo: this.newRedTipo(),
      activo: true,
    }]);
    this.newRedOrigen.set('');
    this.newRedDestino.set('');
    this.addingRedirect.set(false);
  }

  eliminarRedirect(id: number) { this.redirects.update(r => r.filter(x => x.id !== id)); }
}
