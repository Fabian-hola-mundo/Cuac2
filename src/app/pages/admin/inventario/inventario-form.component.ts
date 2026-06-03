import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule }    from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute }  from '@angular/router';
import { InventarioService, CATEGORIAS, EVENTO_ACTIVO } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-inventario-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './inventario-form.component.html',
  styleUrl: './inventario-form.component.scss',
})
export class InventarioFormComponent implements OnInit {
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private fb     = inject(FormBuilder);
  private inv    = inject(InventarioService);

  readonly categorias   = CATEGORIAS;
  readonly eventoActivo = EVENTO_ACTIVO;
  readonly editId       = signal<string | null>(null);
  readonly guardando  = signal(false);
  readonly errorMsg   = signal<string | null>(null);
  readonly isEdit     = computed(() => this.editId() !== null);

  form = this.fb.group({
    nombre:        ['', [Validators.required, Validators.minLength(2)]],
    categoria:     ['tote', Validators.required],
    precio:        [null as number | null, [Validators.required, Validators.min(1)]],
    stock_inicial: [0, [Validators.required, Validators.min(0)]],
    activo:        [true],
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      const p = await this.inv.getProducto(id);
      if (p) {
        this.form.patchValue({
          nombre:        p.nombre,
          categoria:     p.categoria,
          precio:        p.precio,
          stock_inicial: p.stock_inicial,
          activo:        p.activo,
        });
      }
    }
  }

  async guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set(null);

    const v = this.form.value;
    const payload = {
      evento_id:     EVENTO_ACTIVO,
      nombre:        v.nombre!,
      categoria:     v.categoria!,
      personaje:     null as string | null,
      precio:        v.precio!,
      stock_inicial: v.stock_inicial!,
      activo:        v.activo ?? true,
    };

    const result = this.isEdit()
      ? await this.inv.updateProducto(this.editId()!, payload)
      : await this.inv.createProducto(payload);

    this.guardando.set(false);
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.router.navigate(['/admin/inventario']);
  }

  cancelar() { this.router.navigate(['/admin/inventario']); }

  hasError(field: string) {
    const c = this.form.get(field);
    return c?.invalid && c?.touched;
  }
}
