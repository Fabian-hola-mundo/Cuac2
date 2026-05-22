import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { Router }         from '@angular/router';
import { InventarioService, VentaEvento } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-inventario-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario-ventas.component.html',
  styleUrl: './inventario-ventas.component.scss',
})
export class InventarioVentasComponent implements OnInit {
  private router = inject(Router);
  private inv    = inject(InventarioService);

  readonly ventas    = signal<VentaEvento[]>([]);
  readonly cargando  = signal(false);
  readonly errorMsg  = signal<string | null>(null);

  desde = '';
  hasta = '';

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
      const data = await this.inv.getVentas(
        this.desde || undefined,
        this.hasta  || undefined
      );
      this.ventas.set(data);
    } catch (e: any) {
      this.errorMsg.set(e.message);
    }
    this.cargando.set(false);
  }

  volver() { this.router.navigate(['/admin/inventario']); }

  fmtFecha(iso: string) {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
