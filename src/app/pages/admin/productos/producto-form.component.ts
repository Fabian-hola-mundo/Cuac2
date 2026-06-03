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

  readonly coverPreview    = signal<string | null>(null);
  readonly galleryPreviews = signal<string[]>([]);
  readonly material        = signal<string[]>([]);
  private coverFile?: File;
  private galleryFiles: File[] = [];
  private existingFotos: string[] = [];

  form = this.fb.group({
    nombre:        ['', [Validators.required, Validators.minLength(2)]],
    categoria:     ['tote', Validators.required],
    precio:        [null as number | null, [Validators.required, Validators.min(1)]],
    stock_inicial: [0, [Validators.required, Validators.min(0)]],
    personaje:     [null as string | null],
    activo:        [true],
    color:         [null as string | null],
    flag:          [null as string | null],
    descripcion:   [''],
    destacado:     [false],
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
          color:         p.color,
          flag:          p.flag,
          destacado:     p.destacado ?? false,
          descripcion:   p.descripcion ?? '',
        });
        this.form.get('stock_inicial')?.disable();
        this.coverPreview.set(p.cover_url);
        this.galleryPreviews.set(p.fotos ?? []);
        this.existingFotos = [...(p.fotos ?? [])];
        this.material.set(p.material ?? []);
      }
    }
  }

  async guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set(null);
    try {
      const v = this.form.getRawValue();
      const tempId = this.editId() ?? `tmp_${Date.now()}`;

      let coverUrl: string | null = this.coverPreview();
      if (this.coverFile) {
        const ext = this.coverFile.name.split('.').pop() ?? 'jpg';
        const { url } = await this.inv.uploadProductoImage(tempId, this.coverFile, `cover.${ext}`);
        if (url) coverUrl = url;
      }

      let fotosUrls: string[] = [...this.existingFotos];
      for (let i = 0; i < this.galleryFiles.length; i++) {
        const file = this.galleryFiles[i];
        const ext = file.name.split('.').pop() ?? 'jpg';
        const { url } = await this.inv.uploadProductoImage(tempId, file, `foto_${i}.${ext}`);
        if (url) fotosUrls.push(url);
      }

      let result: { error: string | null };

      if (this.isEdit()) {
        const editPayload: Partial<Omit<ProductoEvento, 'id' | 'creado_en' | 'stock_actual'>> = {
          nombre:      v.nombre!,
          categoria:   v.categoria!,
          personaje:   v.personaje ?? null,
          precio:      v.precio!,
          activo:      v.activo ?? true,
          cover_url:   coverUrl,
          fotos:       fotosUrls,
          material:    this.material(),
          color:       v.color ?? null,
          flag:        v.flag ?? null,
          destacado:   v.destacado ?? false,
          descripcion: v.descripcion || null,
        };
        result = await this.inv.updateProducto(this.editId()!, editPayload);
      } else {
        let eventoId = 'Venta-regular';
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
          cover_url:     coverUrl,
          fotos:         fotosUrls,
          material:      this.material(),
          color:         v.color ?? null,
          flag:          v.flag ?? null,
          destacado:     v.destacado ?? false,
          descripcion:   v.descripcion || null,
        };
        result = await this.inv.createProducto(createPayload);
      }

      if (result.error) { this.errorMsg.set(result.error); return; }
      this.router.navigate(['/admin/productos']);
    } catch (e: unknown) {
      this.errorMsg.set(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar() { this.router.navigate(['/admin/productos']); }

  hasError(field: string) {
    const c = this.form.get(field);
    return c?.invalid && c?.touched;
  }

  onCoverChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const prev = this.coverPreview();
    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
    this.coverFile = file;
    this.coverPreview.set(URL.createObjectURL(file));
  }

  onGalleryChange(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.galleryFiles = files;
    this.galleryPreviews.set([
      ...this.existingFotos,
      ...files.map(f => URL.createObjectURL(f)),
    ]);
  }

  removeGalleryItem(index: number) {
    if (index < this.existingFotos.length) {
      this.existingFotos = this.existingFotos.filter((_, i) => i !== index);
    } else {
      const fileIndex = index - this.existingFotos.length;
      this.galleryFiles = this.galleryFiles.filter((_, i) => i !== fileIndex);
    }
    this.galleryPreviews.update(list => list.filter((_, i) => i !== index));
  }

  toggleMaterial(mat: string, checked: boolean) {
    const current = this.material();
    this.material.set(
      checked ? [...current, mat] : current.filter(m => m !== mat)
    );
  }

  readonly COLORES = [
    { id: 'rio',   label: 'Río (azul)'    },
    { id: 'rosa',  label: 'Rosa'          },
    { id: 'sol',   label: 'Sol (amarillo)'},
    { id: 'bone',  label: 'Bone (gris)'   },
    { id: 'terra', label: 'Terra (rojo)'  },
    { id: 'lila',  label: 'Lila'          },
    { id: 'selva', label: 'Selva (verde)' },
    { id: 'tibu',  label: 'Tibu (celeste)'},
    { id: 'cream', label: 'Cream'         },
  ];

  readonly MATERIALES = [
    { id: 'algodon', label: 'Algodón orgánico' },
    { id: 'lona',    label: 'Lona reciclada'   },
    { id: 'papel',   label: 'Papel reciclado'  },
    { id: 'vinilo',  label: 'Vinilo mate'       },
    { id: 'esmalte', label: 'Esmalte / metal'  },
  ];
}
