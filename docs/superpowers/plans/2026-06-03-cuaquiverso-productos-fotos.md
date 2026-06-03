# Cuaquiverso — Productos con fotos + tienda conectada

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar fotos y campos visuales al formulario de productos del admin, y conectar la tienda de Cuaquiverso a los productos reales de Supabase.

**Architecture:** Se extiende la tabla `productos_evento` con 6 columnas nuevas (cover_url, fotos, material, color, flag, descripcion). El `InventarioService` gana un método `uploadProductoImage` que sube al bucket `productos`. El admin product form añade UI para fotos + campos visuales. La tienda reemplaza sus 42 productos hardcodeados por una carga reactiva desde Supabase.

**Tech Stack:** Angular 17 (signals, standalone components), Supabase (PostgreSQL + Storage), TypeScript, SCSS.

---

## Archivos que cambian

| Archivo | Tipo | Qué cambia |
|---------|------|-----------|
| `src/app/core/services/inventario.service.ts` | Modificar | Interfaz `ProductoEvento` + método `uploadProductoImage` |
| `src/app/pages/admin/productos/producto-form.component.ts` | Modificar | Señales de fotos, material, color, flag, descripcion; lógica guardar |
| `src/app/pages/admin/productos/producto-form.component.html` | Modificar | Secciones fotos, apariencia, detalles |
| `src/app/pages/cuaquiverso/tienda/tienda.component.ts` | Modificar | Cargar desde Supabase, quitar hardcode |
| `src/app/pages/cuaquiverso/tienda/tienda.component.html` | Modificar | Texto hero, imágenes reales, campos actualizados |

---

## Task 1: DB Migration — nuevas columnas en `productos_evento`

**Files:**
- Supabase SQL (aplicar via MCP tool `mcp__claude_ai_Supabase__apply_migration`)

- [ ] **Step 1: Obtener el project_id de Supabase**

  Usar el MCP tool `mcp__claude_ai_Supabase__list_projects` para encontrar el proyecto `cuaquiverso-pos` y anotar su `id`.

- [ ] **Step 2: Aplicar la migración**

  Usar `mcp__claude_ai_Supabase__apply_migration` con el project_id obtenido y el siguiente SQL:

  ```sql
  ALTER TABLE productos_evento
    ADD COLUMN IF NOT EXISTS cover_url   TEXT,
    ADD COLUMN IF NOT EXISTS fotos       TEXT[]  NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS material    TEXT[]  NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS color       TEXT,
    ADD COLUMN IF NOT EXISTS flag        TEXT,
    ADD COLUMN IF NOT EXISTS descripcion TEXT;
  ```

  Nombre de migración: `add_product_media_fields`

- [ ] **Step 3: Verificar**

  Usar `mcp__claude_ai_Supabase__execute_sql` con:
  ```sql
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'productos_evento'
    AND column_name IN ('cover_url','fotos','material','color','flag','descripcion')
  ORDER BY column_name;
  ```
  Esperado: 6 filas, una por cada columna.

- [ ] **Step 4: Commit**

  ```bash
  git add -A
  git commit -m "feat(db): add media and visual fields to productos_evento"
  ```

---

## Task 2: Supabase Storage — bucket `productos`

**Files:**
- Supabase dashboard (manual) o Storage API

- [ ] **Step 1: Crear el bucket**

  En el dashboard de Supabase → Storage → New bucket:
  - Name: `productos`
  - Public: **sí** (igual que el bucket `portfolio`)

  Alternativamente via SQL con `mcp__claude_ai_Supabase__execute_sql`:
  ```sql
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('productos', 'productos', true)
  ON CONFLICT (id) DO NOTHING;
  ```

- [ ] **Step 2: Verificar**

  Ir a Storage en el dashboard y confirmar que `productos` aparece como bucket público.

  O via SQL:
  ```sql
  SELECT id, name, public FROM storage.buckets WHERE id = 'productos';
  ```
  Esperado: 1 fila con `public = true`.

---

## Task 3: `InventarioService` — interfaz y upload

**Files:**
- Modify: `src/app/core/services/inventario.service.ts`

- [ ] **Step 1: Actualizar la interfaz `ProductoEvento`**

  En `inventario.service.ts`, reemplazar la interfaz actual por:

  ```typescript
  export interface ProductoEvento {
    id: string;
    evento_id: string | null;
    nombre: string;
    categoria: string;
    personaje: string | null;
    precio: number;
    stock_inicial: number;
    stock_actual: number;
    activo: boolean;
    creado_en: string;
    cover_url: string | null;
    fotos: string[];
    material: string[];
    color: string | null;
    flag: string | null;
    descripcion: string | null;
  }
  ```

- [ ] **Step 2: Agregar `uploadProductoImage` al servicio**

  Añadir este método al final de la clase `InventarioService`, antes del cierre `}`:

  ```typescript
  async uploadProductoImage(
    productoId: string,
    file: File,
    name: string
  ): Promise<{ url: string | null; error: string | null }> {
    const safeName = name.replace(/[^a-z0-9._-]/gi, '_');
    const path = `${productoId}/${safeName}`;
    const { error } = await this.sb.db.storage
      .from('productos')
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) return { url: null, error: error.message };
    const { data } = this.sb.db.storage
      .from('productos')
      .getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }
  ```

- [ ] **Step 3: Verificar compilación**

  ```bash
  npx ng build --configuration=development 2>&1 | tail -20
  ```
  Esperado: sin errores de TypeScript.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/core/services/inventario.service.ts
  git commit -m "feat(inventario): extend ProductoEvento interface + uploadProductoImage"
  ```

---

## Task 4: Admin `producto-form.component.ts` — fotos y campos visuales

**Files:**
- Modify: `src/app/pages/admin/productos/producto-form.component.ts`

- [ ] **Step 1: Agregar señales de fotos y campos visuales**

  Después de `readonly isEdit = computed(...)`, añadir:

  ```typescript
  readonly coverPreview    = signal<string | null>(null);
  readonly galleryPreviews = signal<string[]>([]);
  readonly material        = signal<string[]>([]);
  private coverFile?: File;
  private galleryFiles: File[] = [];
  private existingFotos: string[] = [];
  ```

- [ ] **Step 2: Actualizar el FormGroup**

  Reemplazar la definición del `form` completa:

  ```typescript
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
  });
  ```

- [ ] **Step 3: Actualizar `ngOnInit` para cargar datos en edición**

  Reemplazar el bloque `if (p) { this.form.patchValue({...}) }` dentro de `ngOnInit`:

  ```typescript
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
      descripcion:   p.descripcion ?? '',
    });
    this.form.get('stock_inicial')?.disable();
    this.coverPreview.set(p.cover_url);
    this.galleryPreviews.set(p.fotos ?? []);
    this.existingFotos = [...(p.fotos ?? [])];
    this.material.set(p.material ?? []);
  }
  ```

- [ ] **Step 4: Agregar handlers de fotos y material**

  Añadir estos métodos al final de la clase, antes del cierre `}`:

  ```typescript
  onCoverChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
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
  ```

- [ ] **Step 5: Actualizar el método `guardar()`**

  Reemplazar el método `guardar()` completo:

  ```typescript
  async guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set(null);

    const v = this.form.getRawValue();

    let coverUrl: string | null = this.coverPreview();
    if (this.coverFile) {
      const tempId = this.editId() ?? `tmp_${Date.now()}`;
      const ext = this.coverFile.name.split('.').pop() ?? 'jpg';
      const { url } = await this.inv.uploadProductoImage(tempId, this.coverFile, `cover.${ext}`);
      if (url) coverUrl = url;
    }

    let fotosUrls: string[] = [...this.existingFotos];
    for (let i = 0; i < this.galleryFiles.length; i++) {
      const file = this.galleryFiles[i];
      const tempId = this.editId() ?? `tmp_${Date.now()}`;
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
        descripcion: v.descripcion ?? null,
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
        descripcion:   v.descripcion ?? null,
      };
      result = await this.inv.createProducto(createPayload);
    }

    this.guardando.set(false);
    if (result.error) { this.errorMsg.set(result.error); return; }
    this.router.navigate(['/admin/productos']);
  }
  ```

- [ ] **Step 6: Verificar compilación**

  ```bash
  npx ng build --configuration=development 2>&1 | tail -20
  ```
  Esperado: sin errores.

- [ ] **Step 7: Commit**

  ```bash
  git add src/app/pages/admin/productos/producto-form.component.ts
  git commit -m "feat(admin): add photo upload and visual fields to product form"
  ```

---

## Task 5: Admin `producto-form.component.html` — UI de fotos, apariencia y detalles

**Files:**
- Modify: `src/app/pages/admin/productos/producto-form.component.html`

- [ ] **Step 1: Añadir secciones nuevas dentro del panel**

  Localizar el cierre de `</form>` (actualmente es la última línea antes de `</div></div>` del primer panel). Insertar las tres secciones **antes** del `</form>`:

  ```html
  <!-- ── FOTOS ─────────────────────────────────────────────── -->
  <div class="section-sep"></div>
  <h4 style="font-size:13px;font-weight:600;margin-bottom:var(--s-4);color:var(--carbon-60)">Fotos</h4>

  <div class="field">
    <label>Foto de portada</label>
    @if (coverPreview()) {
      <div class="img-preview">
        <img [src]="coverPreview()!" alt="Portada" />
      </div>
    }
    <label class="upload-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:14px;height:14px">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      {{ coverPreview() ? 'Cambiar portada' : 'Subir portada' }}
      <input type="file" accept="image/*" (change)="onCoverChange($event)" hidden />
    </label>
    <span class="help">JPG, PNG o WebP. Proporción 4:3 recomendada.</span>
  </div>

  <div class="field">
    <label>Galería de fotos</label>
    @if (galleryPreviews().length > 0) {
      <div class="gallery-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
        @for (url of galleryPreviews(); track url; let i = $index) {
          <div style="position:relative">
            <div class="gallery-thumb" [style.backgroundImage]="'url(' + url + ')'"></div>
            <button type="button" class="gallery-remove" (click)="removeGalleryItem(i)"
              style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:var(--carbon);color:#fff;border:none;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center">×</button>
          </div>
        }
      </div>
    }
    <label class="upload-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:14px;height:14px">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      Agregar fotos
      <input type="file" accept="image/*" multiple (change)="onGalleryChange($event)" hidden />
    </label>
    <span class="help">Hasta 8 imágenes adicionales del producto.</span>
  </div>

  <!-- ── APARIENCIA ─────────────────────────────────────────── -->
  <div class="section-sep"></div>
  <h4 style="font-size:13px;font-weight:600;margin-bottom:var(--s-4);color:var(--carbon-60)">Apariencia en tienda</h4>

  <div class="grid-2">
    <div class="field">
      <label>Color de tarjeta</label>
      <select class="input select" formControlName="color">
        <option [value]="null">Sin color</option>
        @for (c of COLORES; track c.id) {
          <option [value]="c.id">{{ c.label }}</option>
        }
      </select>
    </div>
    <div class="field">
      <label>Etiqueta especial</label>
      <select class="input select" formControlName="flag">
        <option [value]="null">Ninguna</option>
        <option value="new">Nuevo</option>
        <option value="last">Últimas unidades</option>
      </select>
    </div>
  </div>

  <!-- ── DETALLES ───────────────────────────────────────────── -->
  <div class="section-sep"></div>
  <h4 style="font-size:13px;font-weight:600;margin-bottom:var(--s-4);color:var(--carbon-60)">Detalles</h4>

  <div class="field">
    <label>Descripción <span class="opt">opcional</span></label>
    <textarea class="input" formControlName="descripcion" rows="3"
      placeholder="Materiales, dimensiones, cuidados…"></textarea>
  </div>

  <div class="field">
    <label>Material</label>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
      @for (m of MATERIALES; track m.id) {
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
          <input type="checkbox"
            [checked]="material().includes(m.id)"
            (change)="toggleMaterial(m.id, $any($event.target).checked)" />
          {{ m.label }}
        </label>
      }
    </div>
  </div>
  ```

- [ ] **Step 2: Agregar `.section-sep` y `.gallery-thumb` al SCSS**

  En `producto-form.component.scss`, agregar al final:

  ```scss
  .section-sep {
    height: 1px;
    background: var(--carbon-08);
    margin: var(--s-5) 0;
  }

  .img-preview {
    margin-bottom: 10px;
    border-radius: 8px;
    overflow: hidden;
    max-height: 200px;
    img { width: 100%; height: 200px; object-fit: cover; display: block; }
  }

  .upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border: 1px solid var(--carbon-16);
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s;
    &:hover { background: var(--carbon-04); }
  }

  .gallery-thumb {
    height: 80px;
    border-radius: 6px;
    background-size: cover;
    background-position: center;
  }
  ```

- [ ] **Step 3: Verificar compilación**

  ```bash
  npx ng build --configuration=development 2>&1 | tail -20
  ```
  Esperado: sin errores.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/pages/admin/productos/producto-form.component.html src/app/pages/admin/productos/producto-form.component.scss
  git commit -m "feat(admin): photo and visual fields UI in product form"
  ```

---

## Task 6: Tienda `tienda.component.ts` — conectar con Supabase

**Files:**
- Modify: `src/app/pages/cuaquiverso/tienda/tienda.component.ts`

- [ ] **Step 1: Reemplazar el archivo completo**

  Reemplazar todo el contenido de `tienda.component.ts` con:

  ```typescript
  import { Component, OnInit, computed, inject, signal } from '@angular/core';
  import { ActivatedRoute } from '@angular/router';
  import { FormsModule } from '@angular/forms';
  import { SeoService } from '../../../core/services/seo.service';
  import { CartService } from '../services/cart.service';
  import { CartModalComponent } from '../cart-modal/cart-modal.component';
  import { InventarioService, ProductoEvento } from '../../../core/services/inventario.service';

  @Component({
    selector: 'app-tienda',
    standalone: true,
    imports: [FormsModule, CartModalComponent],
    templateUrl: './tienda.component.html',
    styleUrl: './tienda.component.scss',
  })
  export class TiendaComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private seo   = inject(SeoService);
    private inv   = inject(InventarioService);
    readonly cart = inject(CartService);

    // ── UI state ──────────────────────────────────────────────────────────────
    query        = signal('');
    selectedCats  = signal(new Set<string>());
    selectedChars = signal(new Set<string>());
    selectedMats  = signal(new Set<string>());
    selectedAvail = signal(new Set<string>());
    priceMin      = signal<number | null>(null);
    priceMax      = signal<number | null>(null);
    sortOrder     = signal('new');
    viewMode      = signal<'comf' | 'dense'>('comf');
    filtersOpen   = signal(false);
    searchHasValue = signal(false);

    readonly LABEL_MAP: Record<string, string> = {
      cuac:'Cuac', kiki:'Kiki', roar:'Roar', yeison:'Yeison',
      abejandro:'Abejandro', atolita:'Atolita', colibriana:'Colibriana', tiburcio:'Tiburcio',
    };

    readonly CAT_SHORT: Record<string, string> = {
      tee:'Tee', tote:'Tote', libreta:'Libreta', sticker:'Sticker',
      pin:'Pin', gorra:'Gorra', peluche:'Peluche', print:'Print',
      llavero:'Llavero', pañoleta:'Pañoleta', amigurumi:'Amigurumi', charm:'Charm',
    };

    readonly CATEGORIES = [
      { id:'tee',      label:'Camisetas'  },
      { id:'tote',     label:'Tote bags'  },
      { id:'libreta',  label:'Libretas'   },
      { id:'sticker',  label:'Stickers'   },
      { id:'pin',      label:'Pines'      },
      { id:'gorra',    label:'Gorras'     },
      { id:'peluche',  label:'Peluches'   },
      { id:'print',    label:'Prints'     },
      { id:'llavero',  label:'Llaveros'   },
      { id:'pañoleta', label:'Pañoletas'  },
      { id:'amigurumi',label:'Amigurumis' },
      { id:'charm',    label:'Charms'     },
    ];

    readonly CHARACTERS = [
      { id:'cuac',       label:'Cuac',       swatch:'var(--rio)'    },
      { id:'yeison',     label:'Yeison',     swatch:'#B07820'       },
      { id:'roar',       label:'Roar',       swatch:'var(--carbon)' },
      { id:'kiki',       label:'Kiki',       swatch:'var(--rosa)'   },
      { id:'abejandro',  label:'Abejandro',  swatch:'var(--terra)'  },
      { id:'atolita',    label:'Atolita',    swatch:'var(--lila)'   },
      { id:'colibriana', label:'Colibriana', swatch:'var(--selva)'  },
      { id:'tiburcio',   label:'Tiburcio',   swatch:'#2E8FB8'       },
    ];

    readonly MATERIALS = [
      { id:'algodon', label:'Algodón orgánico' },
      { id:'lona',    label:'Lona reciclada'   },
      { id:'papel',   label:'Papel reciclado'  },
      { id:'vinilo',  label:'Vinilo mate'       },
      { id:'esmalte', label:'Esmalte / metal'  },
    ];

    readonly AVAILABILITY = [
      { id:'stock', label:'En stock'         },
      { id:'last',  label:'Últimas unidades' },
      { id:'new',   label:'Recién llegado'   },
    ];

    // ── Computed ──────────────────────────────────────────────────────────────
    private readonly activeProducts = computed(() =>
      this.inv.productos().filter(p => p.activo)
    );

    filteredProducts = computed(() => {
      const q     = this.query().toLowerCase().trim();
      const cats  = this.selectedCats();
      const chars = this.selectedChars();
      const mats  = this.selectedMats();
      const avail = this.selectedAvail();
      const pMin  = this.priceMin();
      const pMax  = this.priceMax();
      const sort  = this.sortOrder();

      let list = this.activeProducts().filter(p => {
        if (cats.size  && !cats.has(p.categoria))                         return false;
        if (chars.size && p.personaje && !chars.has(p.personaje))         return false;
        if (mats.size  && !p.material.some(m => mats.has(m)))            return false;
        if (avail.size && !this.avFromFlag(p.flag).some(a => avail.has(a))) return false;
        if (pMin !== null && p.precio < pMin)                             return false;
        if (pMax !== null && p.precio > pMax)                             return false;
        if (q) {
          const hay = `${p.nombre} ${this.CAT_SHORT[p.categoria] ?? ''} ${this.LABEL_MAP[p.personaje ?? ''] ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      if (sort === 'lo')  return [...list].sort((a, b) => a.precio - b.precio);
      if (sort === 'hi')  return [...list].sort((a, b) => b.precio - a.precio);
      if (sort === 'pop') return [...list].sort((a, b) =>
        (b.flag === 'new' ? 1 : 0) - (a.flag === 'new' ? 1 : 0)
      );
      return [...list].sort((a, b) =>
        new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
      );
    });

    activePipCount = computed(() =>
      this.selectedCats().size + this.selectedChars().size +
      this.selectedMats().size + this.selectedAvail().size +
      (this.priceMin() !== null ? 1 : 0) + (this.priceMax() !== null ? 1 : 0)
    );

    readonly cargando = computed(() => this.inv.cargando());

    // ── Init ──────────────────────────────────────────────────────────────────
    ngOnInit() {
      this.seo.set({
        title:       'Tienda — Cuaquiverso',
        description: 'Compra productos del universo Cuaquiverso: camisetas, libretas, stickers y peluches.',
        canonical:   'https://cuacdesign.com/cuaquiverso/tienda',
      });
      this.inv.cargarTodos();
      const p = this.route.snapshot.queryParams;
      if (p['q'])   this.query.set(p['q']);
      if (p['cat']) this.selectedCats.set(new Set([p['cat']]));
      if (p['ch'])  this.selectedChars.set(new Set([p['ch']]));
    }

    // ── Filter toggles ────────────────────────────────────────────────────────
    private toggle(
      sig: { set(v: Set<string>): void; (): Set<string> },
      id: string,
      checked: boolean
    ) {
      const s = new Set(sig());
      checked ? s.add(id) : s.delete(id);
      sig.set(s);
    }

    toggleCat(id: string, ev: Event)   { this.toggle(this.selectedCats,   id, (ev.target as HTMLInputElement).checked); }
    toggleChar(id: string, ev: Event)  { this.toggle(this.selectedChars,  id, (ev.target as HTMLInputElement).checked); }
    toggleMat(id: string, ev: Event)   { this.toggle(this.selectedMats,   id, (ev.target as HTMLInputElement).checked); }
    toggleAvail(id: string, ev: Event) { this.toggle(this.selectedAvail,  id, (ev.target as HTMLInputElement).checked); }

    onQueryChange(ev: Event) {
      const val = (ev.target as HTMLInputElement).value;
      this.query.set(val);
      this.searchHasValue.set(!!val);
    }

    clearSearch() {
      this.query.set('');
      this.searchHasValue.set(false);
    }

    onPriceMin(ev: Event) {
      const v = (ev.target as HTMLInputElement).value;
      this.priceMin.set(v ? Number(v) : null);
    }

    onPriceMax(ev: Event) {
      const v = (ev.target as HTMLInputElement).value;
      this.priceMax.set(v ? Number(v) : null);
    }

    clearAll() {
      this.query.set('');
      this.searchHasValue.set(false);
      this.selectedCats.set(new Set());
      this.selectedChars.set(new Set());
      this.selectedMats.set(new Set());
      this.selectedAvail.set(new Set());
      this.priceMin.set(null);
      this.priceMax.set(null);
    }

    addToCart(ev: Event, p: ProductoEvento) {
      ev.preventDefault();
      ev.stopPropagation();
      this.cart.add({
        id:    p.id.charCodeAt(0),
        name:  p.nombre,
        sub:   `${this.CAT_SHORT[p.categoria] ?? p.categoria}`,
        price: p.precio,
        color: p.color ?? 'rio',
      });
      this.cart.open();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    fmtPrice(n: number): string {
      return '$' + n.toLocaleString('es-CO');
    }

    shortLabel(p: ProductoEvento): string {
      return `${this.CAT_SHORT[p.categoria] ?? ''}<br>${this.LABEL_MAP[p.personaje ?? ''] ?? ''}`;
    }

    avFromFlag(flag: string | null): string[] {
      if (flag === 'new')  return ['stock', 'new'];
      if (flag === 'last') return ['last'];
      return ['stock'];
    }
  }
  ```

- [ ] **Step 2: Verificar compilación**

  ```bash
  npx ng build --configuration=development 2>&1 | tail -20
  ```
  Esperado: sin errores.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/pages/cuaquiverso/tienda/tienda.component.ts
  git commit -m "feat(tienda): load products from Supabase, replace hardcoded data"
  ```

---

## Task 7: Tienda `tienda.component.html` — texto hero + imágenes + campos actualizados

**Files:**
- Modify: `src/app/pages/cuaquiverso/tienda/tienda.component.html`

- [ ] **Step 1: Cambiar el texto del hero**

  Localizar la línea (alrededor de la línea 48):
  ```html
  <p>42 piezas curadas: camisetas, libretas, posters, stickers, peluches y más. Hechas en lotes pequeños, en talleres de Bogotá y Medellín. Cada compra apoya a los ilustradores del Cuaquiverso.</p>
  ```

  Reemplazar por:
  ```html
  <p>Trabajamos en cantidades pensadas. Algunos productos vuelven, otros son únicos. La mejor forma de no perderte nada es actuar cuando algo te gusta.</p>
  ```

- [ ] **Step 2: Actualizar las estadísticas del hero**

  Localizar el bloque `.stats` (alrededor de línea 50-55):
  ```html
  <div class="stats">
    <div><div class="k">Productos</div><div class="v">42</div></div>
    <div><div class="k">Personajes</div><div class="v">8</div></div>
    <div><div class="k">Envío gratis</div><div class="v">desde $150k</div></div>
  </div>
  ```

  Reemplazar por:
  ```html
  <div class="stats">
    <div><div class="k">Productos</div><div class="v">{{ activeProducts().length || '—' }}</div></div>
    <div><div class="k">Personajes</div><div class="v">8</div></div>
    <div><div class="k">Envío gratis</div><div class="v">desde $150k</div></div>
  </div>
  ```

  Para que `activeProducts()` sea accesible desde el template, cambiar `private readonly activeProducts` a `readonly activeProducts` en el TS (quitar `private`).

- [ ] **Step 3: Actualizar la tarjeta de producto `.pcard`**

  Localizar el bloque `@for (p of filteredProducts()...)` y reemplazar el interior de la tarjeta:

  ```html
  @for (p of filteredProducts(); track p.id) {
    <a class="pcard" [attr.data-color]="p.color" href="#">
      <div class="pcard-img">
        @if (p.flag === 'new')  { <span class="flag new">Nuevo</span> }
        @if (p.flag === 'last') { <span class="flag last">Últimas</span> }
        @if (p.cover_url) {
          <img [src]="p.cover_url" [alt]="p.nombre" style="width:100%;height:100%;object-fit:cover;display:block;" />
        } @else {
          <div class="label" [innerHTML]="shortLabel(p)"></div>
        }
        <span class="quick">Ver producto →</span>
      </div>
      <div class="pcard-info">
        <div class="meta">
          <span>{{ CAT_SHORT[p.categoria] ?? p.categoria }}</span>
          <span>{{ LABEL_MAP[p.personaje ?? ''] ?? '' }}</span>
        </div>
        <h4>{{ p.nombre }}</h4>
        <div class="row">
          <span class="price">{{ fmtPrice(p.precio) }}</span>
          <span class="add" (click)="addToCart($event, p)">+</span>
        </div>
      </div>
    </a>
  }
  ```

- [ ] **Step 4: Agregar estado de carga y vacío mejorado**

  Localizar el bloque `@if (filteredProducts().length === 0)` y sustituirlo:

  ```html
  @if (cargando()) {
    <div class="empty">
      <p>Cargando productos…</p>
    </div>
  } @else if (filteredProducts().length === 0) {
    <div class="empty">
      <h3>Sin resultados</h3>
      <p>{{ activeProducts().length === 0 ? 'La tienda está siendo preparada. Vuelve pronto.' : 'Intenta con menos filtros o cambia la búsqueda.' }}</p>
      @if (activeProducts().length > 0) {
        <button class="btn btn-primary" (click)="clearAll()">Limpiar filtros</button>
      }
    </div>
  }
  ```

- [ ] **Step 5: Actualizar filtro de personajes (quitar `.count`)**

  Localizar el bloque `@for (ch of CHARACTERS; track ch.id)`. El template intenta usar `ch.count` que ya no existe — reemplazar ese bloque:

  ```html
  @for (ch of CHARACTERS; track ch.id) {
    <label class="filter-opt" [class.is-on]="selectedChars().has(ch.id)">
      <input type="checkbox" [checked]="selectedChars().has(ch.id)" (change)="toggleChar(ch.id, $event)" />
      <span class="swatch" [style.background]="ch.swatch"></span>
      {{ ch.label }}
    </label>
  }
  ```

  Y el bloque de categorías (quitar `.count`):
  ```html
  @for (cat of CATEGORIES; track cat.id) {
    <label class="filter-opt" [class.is-on]="selectedCats().has(cat.id)">
      <input type="checkbox" [checked]="selectedCats().has(cat.id)" (change)="toggleCat(cat.id, $event)" />
      {{ cat.label }}
    </label>
  }
  ```

- [ ] **Step 6: Corregir badge del carrito en el header**

  Localizar:
  ```html
  <span class="badge">{{ cartCount() }}</span>
  ```
  Reemplazar por:
  ```html
  <span class="badge">{{ cart.count() }}</span>
  ```

- [ ] **Step 7: Verificar compilación**

  ```bash
  npx ng build --configuration=development 2>&1 | tail -20
  ```
  Esperado: sin errores.

- [ ] **Step 8: Commit**

  ```bash
  git add src/app/pages/cuaquiverso/tienda/tienda.component.html
  git commit -m "feat(tienda): connect to real products, update hero text, show product images"
  ```

---

## Self-Review del plan

### Cobertura del spec
- [x] Texto hero cambiado (Task 7, Step 1)
- [x] DB migration con 6 columnas nuevas (Task 1)
- [x] Bucket `productos` en Supabase Storage (Task 2)
- [x] Interfaz `ProductoEvento` actualizada (Task 3, Step 1)
- [x] `uploadProductoImage` en InventarioService (Task 3, Step 2)
- [x] Admin form — cover photo upload (Task 4-5)
- [x] Admin form — galería de fotos + remove (Task 4-5)
- [x] Admin form — color, flag, material, descripción (Task 4-5)
- [x] Admin form — carga de datos en modo edición (Task 4, Step 3)
- [x] Tienda carga desde Supabase (Task 6)
- [x] Tienda muestra fotos reales (Task 7, Step 3)
- [x] Filtros actualizados para usar campos de `ProductoEvento` (Task 6)

### Consistencia de tipos
- `uploadProductoImage(productoId, file, name)` — usado en Task 4, definido en Task 3 ✓
- `ProductoEvento.cover_url | fotos | material | color | flag | descripcion` — definidos en Task 3, usados en Tasks 4, 6, 7 ✓
- `avFromFlag(flag)` — definido y usado en Task 6 ✓
- `addToCart(ev, p)` — firma actualizada en Task 6 TS y llamada en Task 7 HTML ✓
- `activeProducts()` — `private` removido en Task 7 Step 2, usado en template ✓
