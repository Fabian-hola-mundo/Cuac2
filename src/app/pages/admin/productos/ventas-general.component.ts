import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { Router }         from '@angular/router';
import { InventarioService, VentaEvento } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-ventas-general',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas-general.component.html',
  styleUrl: './ventas-general.component.scss',
})
export class VentasGeneralComponent implements OnInit {
  private router = inject(Router);
  private inv    = inject(InventarioService);

  readonly ventas   = signal<VentaEvento[]>([]);
  readonly cargando = signal(false);
  readonly errorMsg = signal<string | null>(null);

  desde = '';
  hasta = '';
  canalFiltro: '' | 'evento' | 'web' = '';

  totalUnidades = computed(() =>
    this.ventas().reduce((acc, v) => acc + v.cantidad, 0)
  );

  // Total COP — only when precio is available on ventas
  totalCOP = computed(() => {
    const sum = this.ventas().reduce((acc, v) => {
      const p = v.productos_evento?.precio;
      return p ? acc + v.cantidad * p : acc;
    }, 0);
    return sum;
  });

  hasPrecio = computed(() =>
    this.ventas().some(v => v.productos_evento?.precio != null)
  );

  totalesPorProducto = computed(() => {
    const map = new Map<string, { nombre: string; total: number }>();
    for (const v of this.ventas()) {
      const nombre = v.productos_evento?.nombre ?? v.producto_id;
      const prev   = map.get(nombre) ?? { nombre, total: 0 };
      map.set(nombre, { nombre, total: prev.total + v.cantidad });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  });

  ngOnInit() { this.cargar(); }

  async cargar() {
    this.cargando.set(true);
    this.errorMsg.set(null);
    try {
      const canal = this.canalFiltro || undefined;
      const data = await this.inv.getVentas(
        this.desde || undefined,
        this.hasta  || undefined,
        canal as 'evento' | 'web' | undefined,
      );
      this.ventas.set(data);
    } catch (e: any) {
      this.errorMsg.set(e.message);
    }
    this.cargando.set(false);
  }

  volver() { this.router.navigate(['/admin/productos']); }

  fmtFecha(iso: string) {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  fmtCOP(n: number) { return '$' + n.toLocaleString('es-CO'); }
}
