import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Zona { id: number; nombre: string; municipios: string; tarifa: number; plazo: string; activa: boolean; }
interface Transportadora { id: string; nombre: string; desc: string; activa: boolean; apiKey: string; keyVisible: boolean; }

@Component({
  selector: 'app-ajustes-envios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-envios.component.html',
  styleUrl: './ajustes-envios.component.scss',
})
export class AjustesEnviosComponent {
  envioGratis      = signal(true);
  montoMinimo      = signal(150000);
  contraEntrega    = signal(true);
  recargoContra    = signal(5000);
  nextZonaId       = 4;

  zonas = signal<Zona[]>([
    { id: 1, nombre: 'Bogotá',       municipios: 'Bogotá D.C.',                     tarifa: 9000,  plazo: '1-2 días',   activa: true  },
    { id: 2, nombre: 'Eje cafetero', municipios: 'Manizales, Pereira, Armenia',      tarifa: 11000, plazo: '2-3 días',   activa: true  },
    { id: 3, nombre: 'Costa Caribe', municipios: 'Barranquilla, Cartagena, Santa Marta', tarifa: 14000, plazo: '3-4 días', activa: true },
  ]);

  transportadoras = signal<Transportadora[]>([
    { id: 'servientrega', nombre: 'Servientrega', desc: 'Cobertura nacional · entrega en 2-4 días',   activa: true,  apiKey: 'SVT-xxxx-yyyy', keyVisible: false },
    { id: 'coordinadora', nombre: 'Coordinadora', desc: 'Cobertura nacional · entrega en 2-3 días',   activa: false, apiKey: '',              keyVisible: false },
    { id: 'envia',        nombre: 'Enviá',         desc: 'Especialista en e-commerce colombiano',      activa: false, apiKey: '',              keyVisible: false },
    { id: 'tcc',          nombre: 'TCC',           desc: 'Transporte de carga y paquetería',           activa: false, apiKey: '',              keyVisible: false },
  ]);

  saving = signal(false);
  saved  = signal(false);

  agregarZona() {
    this.zonas.update(z => [...z, { id: this.nextZonaId++, nombre: '', municipios: '', tarifa: 0, plazo: '', activa: true }]);
  }

  eliminarZona(id: number) { this.zonas.update(z => z.filter(x => x.id !== id)); }

  updateZona(id: number, field: keyof Zona, value: string | number | boolean) {
    this.zonas.update(z => z.map(x => x.id === id ? { ...x, [field]: value } : x));
  }

  toggleTransp(id: string) {
    this.transportadoras.update(t => t.map(x => x.id === id ? { ...x, activa: !x.activa } : x));
  }

  toggleKey(id: string) {
    this.transportadoras.update(t => t.map(x => x.id === id ? { ...x, keyVisible: !x.keyVisible } : x));
  }

  updateKey(id: string, value: string) {
    this.transportadoras.update(t => t.map(x => x.id === id ? { ...x, apiKey: value } : x));
  }

  async guardar() {
    this.saving.set(true);
    await new Promise(r => setTimeout(r, 800));
    this.saving.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
