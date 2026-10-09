import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ajustes-negocio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes-negocio.component.html',
  styleUrl: './ajustes-negocio.component.scss',
})
export class AjustesNegocioComponent {
  // Sin configurar: se llenan con los datos reales del negocio.
  razonSocial   = signal('');
  nit           = signal('');
  email         = signal('');
  telefono      = signal('');
  direccion     = signal('');
  regimen       = signal('simple');
  moneda        = signal('COP');
  zona          = signal('America/Bogota');
  idioma        = signal('es');
  nombreTienda  = signal('');
  colorPrimario = signal('#2A6FDB');

  saving = signal(false);
  saved  = signal(false);

  async guardar() {
    this.saving.set(true);
    await new Promise(r => setTimeout(r, 800));
    this.saving.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
