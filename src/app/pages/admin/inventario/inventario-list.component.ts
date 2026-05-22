import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router }       from '@angular/router';
import { InventarioService, ProductoEvento, CATEGORIAS } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-inventario-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inventario-list.component.html',
  styleUrl: './inventario-list.component.scss',
})
export class InventarioListComponent implements OnInit {
  private router    = inject(Router);
  readonly inv      = inject(InventarioService);
  readonly categorias = CATEGORIAS;

  catFiltro = signal<string>('all');

  productosFiltrados = computed(() => {
    const cat  = this.catFiltro();
    const list = this.inv.productos();
    return cat === 'all' ? list : list.filter(p => p.categoria === cat);
  });

  ngOnInit() { this.inv.cargarProductos(); }

  nuevo()              { this.router.navigate(['/admin/inventario/nuevo']); }
  editar(p: ProductoEvento) { this.router.navigate(['/admin/inventario', p.id, 'editar']); }
  verVentas()          { this.router.navigate(['/admin/inventario/ventas']); }

  fmtCOP(n: number) { return '$' + n.toLocaleString('es-CO'); }

  labelCategoria(id: string) {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }
}
