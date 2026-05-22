import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-inventario-ventas',
  standalone: true,
  imports: [CommonModule],
  template: `<p style="padding:24px;color:var(--mid)">Log de ventas — próximamente.</p>`,
})
export class InventarioVentasComponent {}
