import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DescuentosAdminService,
  CodigoDescuento,
  CodigoDescuentoInput,
  UsoDescuento,
} from '../../../core/services/descuentos-admin.service';
import { CATEGORIAS } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-descuentos-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './descuentos-tab.component.html',
  styleUrl:    './descuentos-tab.component.scss',
})
export class DescuentosTabComponent implements OnInit {
  private svc = inject(DescuentosAdminService);

  readonly CATEGORIAS = CATEGORIAS;

  codigos      = signal<CodigoDescuento[]>([]);
  loading      = signal(false);
  drawerOn     = signal(false);
  saving       = signal(false);
  errorMsg     = signal<string | null>(null);
  toastMsg     = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  editingId    = signal<string | null>(null);
  deleteConfirmId = signal<string | null>(null);

  expandedId   = signal<string | null>(null);
  usos         = signal<UsoDescuento[]>([]);
  usosLoading  = signal(false);

  // Form fields
  dcCodigo    = '';
  dcTipo      = signal<'porcentaje' | 'fijo'>('porcentaje');
  dcValor     = '';
  dcMinimo    = '';
  dcLimite    = '';
  dcExpira    = '';
  dcActivo    = signal(true);
  dcCategorias: string[] = [];
  dcProductos = '';   // comma-separated UUIDs

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.loading.set(true);
    try {
      this.codigos.set(await this.svc.listar());
    } catch { /* silent */ }
    this.loading.set(false);
  }

  abrirNuevo(): void {
    this.editingId.set(null);
    this.dcCodigo    = '';
    this.dcTipo.set('porcentaje');
    this.dcValor     = '';
    this.dcMinimo    = '';
    this.dcLimite    = '';
    this.dcExpira    = '';
    this.dcActivo.set(true);
    this.dcCategorias = [];
    this.dcProductos  = '';
    this.errorMsg.set(null);
    this.drawerOn.set(true);
  }

  abrirEditar(c: CodigoDescuento): void {
    this.editingId.set(c.id);
    this.dcCodigo    = c.codigo;
    this.dcTipo.set(c.tipo);
    this.dcValor     = String(c.valor);
    this.dcMinimo    = c.minimo_orden > 0 ? String(c.minimo_orden) : '';
    this.dcLimite    = c.limite_usos !== null ? String(c.limite_usos) : '';
    this.dcExpira    = c.expira_en ? c.expira_en.substring(0, 10) : '';
    this.dcActivo.set(c.activo);
    this.dcCategorias = c.categorias_ids ? [...c.categorias_ids] : [];
    this.dcProductos  = c.productos_ids ? c.productos_ids.join(', ') : '';
    this.errorMsg.set(null);
    this.drawerOn.set(true);
  }

  cerrarDrawer(): void {
    this.drawerOn.set(false);
    this.errorMsg.set(null);
  }

  get todasSeleccionadas(): boolean {
    return this.dcCategorias.length === CATEGORIAS.length;
  }

  toggleTodasCategorias(): void {
    if (this.todasSeleccionadas) {
      this.dcCategorias = [];
    } else {
      this.dcCategorias = CATEGORIAS.map(c => c.id);
    }
  }

  toggleCategoria(id: string): void {
    if (this.dcCategorias.includes(id)) {
      this.dcCategorias = this.dcCategorias.filter(c => c !== id);
    } else {
      this.dcCategorias = [...this.dcCategorias, id];
    }
  }

  async guardar(): Promise<void> {
    if (!this.dcCodigo.trim() || !this.dcValor) {
      this.errorMsg.set('Código y valor son obligatorios.');
      return;
    }
    const valor = parseInt(this.dcValor, 10);
    if (isNaN(valor) || valor <= 0) {
      this.errorMsg.set('El valor debe ser un número positivo.');
      return;
    }

    const productos_ids = this.dcProductos.trim()
      ? this.dcProductos.split(',').map(s => s.trim()).filter(Boolean)
      : null;

    const input: CodigoDescuentoInput = {
      codigo:         this.dcCodigo.toUpperCase().trim(),
      tipo:           this.dcTipo(),
      valor,
      minimo_orden:   this.dcMinimo ? parseInt(this.dcMinimo, 10) : 0,
      limite_usos:    this.dcLimite ? parseInt(this.dcLimite, 10) : null,
      productos_ids,
      categorias_ids: this.dcCategorias.length > 0 ? [...this.dcCategorias] : null,
      activo:         this.dcActivo(),
      expira_en:      this.dcExpira ? new Date(this.dcExpira + 'T23:59:59').toISOString() : null,
    };

    this.saving.set(true);
    this.errorMsg.set(null);
    try {
      const id = this.editingId();
      if (id) {
        await this.svc.actualizar(id, input);
        this.flash('Código actualizado');
      } else {
        await this.svc.crear(input);
        this.flash('Código creado');
      }
      this.drawerOn.set(false);
      await this.cargar();
    } catch (e: any) {
      this.errorMsg.set(e.message ?? 'Error al guardar. Intenta de nuevo.');
    }
    this.saving.set(false);
  }

  async toggleActivo(c: CodigoDescuento): Promise<void> {
    try {
      await this.svc.actualizar(c.id, { activo: !c.activo });
      await this.cargar();
      this.flash(c.activo ? 'Código desactivado' : 'Código activado');
    } catch { /* silent */ }
  }

  confirmarEliminar(id: string): void {
    this.deleteConfirmId.set(id);
  }

  async eliminar(id: string): Promise<void> {
    try {
      await this.svc.eliminar(id);
      this.deleteConfirmId.set(null);
      await this.cargar();
      this.flash('Código eliminado');
    } catch { /* silent */ }
  }

  async toggleExpand(c: CodigoDescuento): Promise<void> {
    if (this.expandedId() === c.id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(c.id);
    this.usosLoading.set(true);
    this.usos.set(await this.svc.usosPorCodigo(c.codigo));
    this.usosLoading.set(false);
  }

  flash(msg: string): void {
    this.toastMsg.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMsg.set(null), 2400);
  }

  fmtCOP(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }

  fmtFecha(s: string | null): string {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
