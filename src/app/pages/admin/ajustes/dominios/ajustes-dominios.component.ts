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
  dominios = signal<Dominio[]>([
    { id: 1, dominio: 'cuaquiverso.co',     tipo: 'principal', ssl: true,  activo: true  },
    { id: 2, dominio: 'www.cuaquiverso.co', tipo: 'alias',     ssl: true,  activo: true  },
  ]);

  redirects = signal<Redirect[]>([
    { id: 1, origen: '/tienda-vieja', destino: '/tienda', tipo: '301', activo: true },
  ]);

  newDomain      = signal('');
  newDomainTipo  = signal<TipoDominio>('alias');
  verifState     = signal<VerifState>('idle');
  addingDomain   = signal(false);
  addingRedirect = signal(false);
  newRedOrigen   = signal('');
  newRedDestino  = signal('');
  newRedTipo     = signal<'301' | '302'>('301');
  nextId         = 3;
  nextRedId      = 2;

  readonly DNS_RECORDS = [
    { tipo: 'CNAME', host: 'www',  valor: 'cuaquiverso.co.cdn.provider.com' },
    { tipo: 'A',     host: '@',    valor: '76.223.105.230'                  },
    { tipo: 'TXT',   host: '@',    valor: 'v=cuac-verify abc123def456'      },
  ];

  async verificar() {
    if (!this.newDomain().trim()) return;
    this.verifState.set('checking');
    await new Promise(r => setTimeout(r, 1500));
    this.verifState.set('records');
  }

  async reVerificar() {
    this.verifState.set('checking');
    await new Promise(r => setTimeout(r, 1200));
    this.verifState.set('verified');
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
