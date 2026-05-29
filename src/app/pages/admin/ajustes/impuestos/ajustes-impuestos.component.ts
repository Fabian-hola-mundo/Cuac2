import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Tasa { id: number; nombre: string; porcentaje: number; aplicaA: string; activa: boolean; }

@Component({
  selector: 'app-ajustes-impuestos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-impuestos.component.html',
  styleUrl: './ajustes-impuestos.component.scss',
})
export class AjustesImpuestosComponent {
  cobrarIva    = signal(true);
  ivaIncluido  = signal(true);
  tasas        = signal<Tasa[]>([
    { id: 1, nombre: 'IVA',          porcentaje: 19, aplicaA: 'todos',     activa: true  },
    { id: 2, nombre: 'IVA reducido', porcentaje: 5,  aplicaA: 'libros',    activa: false },
    { id: 3, nombre: 'Exento',       porcentaje: 0,  aplicaA: 'alimentos', activa: false },
  ]);
  nextId = 4;

  prefijoFactura     = signal('FE-');
  numeracionInicial  = signal(1001);
  resolucionDIAN     = signal('18764021912345');
  fechaResolucion    = signal('2027-12-31');

  saving = signal(false);
  saved  = signal(false);

  agregarTasa() {
    this.tasas.update(t => [...t, { id: this.nextId++, nombre: '', porcentaje: 0, aplicaA: 'todos', activa: true }]);
  }

  eliminarTasa(id: number) {
    this.tasas.update(t => t.filter(x => x.id !== id));
  }

  updateTasa(id: number, field: keyof Tasa, value: string | number | boolean) {
    this.tasas.update(t => t.map(x => x.id === id ? { ...x, [field]: value } : x));
  }

  async guardar() {
    this.saving.set(true);
    await new Promise(r => setTimeout(r, 800));
    this.saving.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
