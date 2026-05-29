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
  razonSocial   = signal('Cuaquiverso S.A.S.');
  nit           = signal('901.234.567-8');
  email         = signal('hola@cuaquiverso.co');
  telefono      = signal('+57 311 444 0001');
  direccion     = signal('Cra 11 # 71-30, Bogotá, Colombia');
  regimen       = signal('simple');
  moneda        = signal('COP');
  zona          = signal('America/Bogota');
  idioma        = signal('es');
  nombreTienda  = signal('Cuaquiverso');
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
