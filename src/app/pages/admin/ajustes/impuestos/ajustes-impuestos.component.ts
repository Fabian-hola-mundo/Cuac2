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
  tasas        = signal<Tasa[]>([]);
  nextId = 1;

  // Sin configurar: se llenan con la resolución DIAN real.
  prefijoFactura     = signal('');
  numeracionInicial  = signal<number | null>(null);
  resolucionDIAN     = signal('');
  fechaResolucion    = signal('');

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
