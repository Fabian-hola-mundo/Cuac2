import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule }    from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute }  from '@angular/router';
import { InventarioService, CATEGORIAS, CHARACTERS, ProductoEvento } from '../../../core/services/inventario.service';
import { EventosService } from '../../../core/services/eventos.service';

@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './producto-form.component.html',
  styleUrl: './producto-form.component.scss',
})
export class ProductoFormComponent implements OnInit {
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);
  private fb      = inject(FormBuilder);
  private inv     = inject(InventarioService);
  private eventos = inject(EventosService);

  readonly categorias = CATEGORIAS;
  readonly characters = CHARACTERS;
  readonly editId     = signal<string | null>(null);
  readonly guardando  = signal(false);
  readonly errorMsg   = signal<string | null>(null);
  readonly isEdit     = computed(() => this.editId() !== null);

  form = this.fb.group({
    nombre:        ['', [Validators.required, Validators.minLength(2)]],
    categoria:     ['tote', Validators.required],
    precio:        [null as number | null, [Validators.required, Validators.min(1)]],
    stock_inicial: [0, [Validators.required, Validators.min(0)]],
    personaje:     [null as string | null],
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
          personaje:     p.personaje,
          activo:        p.activo,
        });
        // stock_inicial is read-only in edit mode
        this.form.get('stock_inicial')?.disable();
      }
    }
  }

  async guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set(null);

    const v = this.form.getRawValue();
    let result: { error: string | null };

    if (this.isEdit()) {
      const editPayload: Partial<Omit<ProductoEvento, 'id' | 'creado_en' | 'stock_actual'>> = {
        nombre:    v.nombre!,
        categoria: v.categoria!,
        personaje: v.personaje ?? null,
        precio:    v.precio!,
        activo:    v.activo ?? true,
      };
      result = await this.inv.updateProducto(this.editId()!, editPayload);
    } else {
      let eventoId: string = 'Venta-regular';
      try {
        const activo = await this.eventos.getEventoActivo();
        eventoId = activo?.id ?? 'Venta-regular';
      } catch {
        eventoId = 'Venta-regular';
      }
      const createPayload: Omit<ProductoEvento, 'id' | 'creado_en' | 'stock_actual'> = {
        evento_id:     eventoId,
        nombre:        v.nombre!,
        categoria:     v.categoria!,
        personaje:     v.personaje ?? null,
        precio:        v.precio!,
        stock_inicial: v.stock_inicial!,
        activo:        v.activo ?? true,
        cover_url:     null,
        fotos:         [],
        material:      [],
        color:         null,
        flag:          null,
        descripcion:   null,
      };
      result = await this.inv.createProducto(createPayload);
    }

    this.guardando.set(false);
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.router.navigate(['/admin/productos']);
  }

  cancelar() { this.router.navigate(['/admin/productos']); }

  hasError(field: string) {
    const c = this.form.get(field);
    return c?.invalid && c?.touched;
  }
}
