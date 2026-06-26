import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SiteSettingsService } from '../../../../core/services/site-settings.service';

type Estado = 'conectado' | 'disponible' | 'proximo';

interface Integracion {
  id: string; nombre: string; desc: string; categoria: string;
  estado: Estado; color: string;
  config: { apiKey?: string; secretKey?: string; webhookUrl?: string; sandbox?: boolean;
            audienceId?: string; measurementId?: string; pixelId?: string; };
  keyVisible: boolean;
  expanded: boolean;
}

@Component({
  selector: 'app-ajustes-integraciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-integraciones.component.html',
  styleUrl: './ajustes-integraciones.component.scss',
})
export class AjustesIntegracionesComponent implements OnInit {
  private siteSettings = inject(SiteSettingsService);

  integraciones = signal<Integracion[]>([
    { id: 'bold',       nombre: 'Bold',             desc: 'Pasarela de pagos colombiana',        categoria: 'Pagos',      estado: 'conectado',  color: '#2A6FDB', config: { apiKey: 'pk_live_xxxxx', secretKey: '', webhookUrl: '', sandbox: false }, keyVisible: false, expanded: false },
    { id: 'pse',        nombre: 'PSE',              desc: 'Débito directo a cuentas bancarias',  categoria: 'Pagos',      estado: 'conectado',  color: '#1F8A5B', config: { apiKey: 'pse_live_xxxxx', secretKey: '',                  sandbox: false }, keyVisible: false, expanded: false },
    { id: 'nequi',      nombre: 'Nequi',            desc: 'Pagos con billetera digital',         categoria: 'Pagos',      estado: 'conectado',  color: '#8B6FD8', config: { apiKey: 'nq_live_xxxxx',  secretKey: '',                  sandbox: false }, keyVisible: false, expanded: false },
    { id: 'mailchimp',  nombre: 'Mailchimp',        desc: 'Email marketing y newsletters',       categoria: 'Email',      estado: 'disponible', color: '#FFD43B', config: { apiKey: '', audienceId: '' },                                              keyVisible: false, expanded: false },
    { id: 'ga',         nombre: 'Google Analytics', desc: 'Analítica de tráfico y conversiones', categoria: 'Analytics',  estado: 'disponible', color: '#E8623D', config: { measurementId: '' },                                                      keyVisible: false, expanded: false },
    { id: 'meta',       nombre: 'Meta Pixel',       desc: 'Seguimiento de conversiones de Meta', categoria: 'Marketing',  estado: 'disponible', color: '#151F28', config: { pixelId: '' },                                                            keyVisible: false, expanded: false },
    { id: 'servi',      nombre: 'Servientrega',     desc: 'Cotización y guías automáticas',      categoria: 'Envíos',     estado: 'conectado',  color: '#E8623D', config: { apiKey: 'SVT-xxxx', sandbox: false },                                     keyVisible: false, expanded: false },
    { id: 'coordinad',  nombre: 'Coordinadora',     desc: 'Cobertura nacional, envío exprés',    categoria: 'Envíos',     estado: 'proximo',    color: '#2E8FB8', config: {},                                                                         keyVisible: false, expanded: false },
  ]);

  saving = signal(false);
  saved  = signal(false);

  async ngOnInit() {
    const measurementId = await this.siteSettings.get('ga_measurement_id');
    if (!measurementId) return;
    this.integraciones.update(list => list.map(i => i.id === 'ga'
      ? { ...i, estado: 'conectado', config: { ...i.config, measurementId } }
      : i));
  }

  toggle(id: string) {
    this.integraciones.update(list => list.map(i => i.id === id ? { ...i, expanded: !i.expanded } : { ...i, expanded: false }));
  }

  toggleKey(id: string) {
    this.integraciones.update(list => list.map(i => i.id === id ? { ...i, keyVisible: !i.keyVisible } : i));
  }

  updateConfig(id: string, field: string, value: string | boolean) {
    this.integraciones.update(list => list.map(i => i.id === id ? { ...i, config: { ...i.config, [field]: value } } : i));
  }

  async guardar(id: string) {
    this.saving.set(true);
    if (id === 'ga') {
      const measurementId = this.integraciones().find(i => i.id === 'ga')?.config.measurementId ?? '';
      const { error } = await this.siteSettings.set('ga_measurement_id', measurementId);
      this.saving.set(false);
      if (error) return;
      this.integraciones.update(list => list.map(i => i.id === 'ga'
        ? { ...i, estado: measurementId ? 'conectado' : 'disponible', expanded: false }
        : i));
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 2000);
      return;
    }
    await new Promise(r => setTimeout(r, 800));
    this.saving.set(false);
    this.saved.set(true);
    this.integraciones.update(list => list.map(i => i.id === id ? { ...i, expanded: false } : i));
    setTimeout(() => this.saved.set(false), 2000);
  }

  estadoTone(e: Estado): string {
    return e === 'conectado' ? 'ok' : e === 'disponible' ? 'rio' : '';
  }
  estadoLabel(e: Estado): string {
    return e === 'conectado' ? 'Conectado' : e === 'disponible' ? 'Disponible' : 'Próximamente';
  }
}
