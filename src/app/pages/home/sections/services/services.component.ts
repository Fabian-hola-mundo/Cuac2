import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-services',
  standalone: true,
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class ServicesComponent {
  // En móvil la lista de cada tarjeta va plegada; en escritorio el botón no se muestra.
  private readonly abiertos = signal<ReadonlySet<string>>(new Set());

  abierto(id: string): boolean {
    return this.abiertos().has(id);
  }

  toggle(id: string) {
    this.abiertos.update(s => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  }
}
