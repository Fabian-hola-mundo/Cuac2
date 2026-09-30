import {
  AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit,
  computed, effect, inject, signal, untracked, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule }    from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute }  from '@angular/router';
import {
  InventarioService,
  CATEGORIAS,
  ETIQUETAS_FIJAS,
  MAX_LARGO_ETIQUETA,
  ProductoEvento,
  ProductoOpcion,
  ProductoVariante,
  etiquetaCategoria,
  etiquetaFlag,
  slugCategoria,
} from '../../../core/services/inventario.service';
import { IVA, comisionBold, guardarComision, leerComisionGuardada } from './comision-bold';
import { EventosService } from '../../../core/services/eventos.service';
import {
  EstadoGaleria,
  MAX_FOTOS,
  agregarAGaleria,
  quitarDeGaleria,
  totalGaleria,
  validarImagen,
} from './galeria';
import { VariantesEditorComponent } from './variantes-editor/variantes-editor.component';

@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, VariantesEditorComponent],
  templateUrl: './producto-form.component.html',
  styleUrl: './producto-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductoFormComponent implements OnInit, AfterViewInit, OnDestroy {
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);
  private fb      = inject(FormBuilder);
  private inv        = inject(InventarioService);
  private eventos    = inject(EventosService);
  private destroyRef = inject(DestroyRef);

  readonly maxFotos   = MAX_FOTOS;
  readonly editId     = signal<string | null>(null);
  readonly guardando  = signal(false);
  readonly errorMsg   = signal<string | null>(null);
  readonly avisos     = signal<string[]>([]);
  readonly isEdit     = computed(() => this.editId() !== null);

  // ── Categorías ────────────────────────────────────────────────────────────
  /** Fijas + las que ya usa algún producto: así una nueva no se pierde. */
  readonly categoriasUsadas = signal<string[]>([]);
  readonly categorias = computed(() => {
    const ids = new Set([...CATEGORIAS.map(c => c.id), ...this.categoriasUsadas()]);
    return [...ids]
      .map(id => ({ id, label: etiquetaCategoria(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  });
  readonly creandoCategoria = signal(false);
  categoriaNueva = '';

  // ── Etiquetas especiales ──────────────────────────────────────────────────
  readonly MAX_LARGO_ETIQUETA = MAX_LARGO_ETIQUETA;
  readonly etiquetasUsadas = signal<string[]>([]);
  /** Fijas + las que ya escribió el admin en otros productos. */
  readonly etiquetas = computed(() => {
    const ids = new Set([...ETIQUETAS_FIJAS.map(e => e.id), ...this.etiquetasUsadas()]);
    return [...ids].map(id => ({ id, label: etiquetaFlag(id) }));
  });
  readonly creandoEtiqueta = signal(false);
  etiquetaNueva = '';

  // ── Comisión de Bold ──────────────────────────────────────────────────────
  private guardado = leerComisionGuardada();
  readonly comisionPct  = signal(this.guardado.porcentaje);
  readonly comisionIva  = signal(this.guardado.conIva);
  readonly editandoComision = signal(false);
  readonly precio = signal<number | null>(null);

  readonly desglose = computed(() =>
    comisionBold(this.precio(), this.comisionPct(), this.comisionIva())
  );

  readonly IVA_PCT = IVA * 100;

  readonly material = signal<string[]>([]);

  /** El campo de materiales es texto libre separado por comas. */
  materialTexto = '';

  // ── Portada ───────────────────────────────────────────────────────────────
  /** URL ya persistida en Storage (null si nunca se subió o si se reemplazó). */
  private coverGuardada: string | null = null;
  private coverFile: File | null = null;
  readonly coverPreview = signal<string | null>(null);

  // ── Galería ───────────────────────────────────────────────────────────────
  readonly galeria = signal<EstadoGaleria>({ existentes: [], nuevos: [] });
  /** Object URLs vivos, para revocarlos y no dejar blobs colgando. */
  private blobs = new Map<File, string>();
  readonly galeriaPreviews = computed(() => {
    const g = this.galeria();
    return [...g.existentes, ...g.nuevos.map(f => this.blobs.get(f) ?? '')];
  });
  readonly galeriaLlena = computed(() => totalGaleria(this.galeria()) >= MAX_FOTOS);

  /**
   * Id del producto ya insertado en un intento previo de guardado. Si la subida
   * de imágenes falla, reintentar no debe crear un segundo producto.
   */
  private creadoId: string | null = null;

  // ── Variantes ─────────────────────────────────────────────────────────────
  readonly editor = viewChild(VariantesEditorComponent);
  /** Fotos ya guardadas: las únicas que se pueden asignar a un valor. */
  readonly fotosGuardadas = computed(() => {
    const g = this.galeria();
    return [this.coverPreview(), ...g.existentes].filter((u): u is string => !!u && !u.startsWith('blob:'));
  });
  /** Si al guardar se van a desactivar combinaciones, cuántas confirmó el admin. */
  readonly confirmarDesactivar = signal<number | null>(null);
  /** Con variantes activas antes de editar: apagarlas también hay que guardarlo. */
  private teniaVariantes = false;
  /** Sin esto, guardar con el editor vacío desactivaría variantes que no se vieron. */
  private variantesFallaron = false;
  /** Variantes leídas antes de que exista el editor en la vista. */
  private variantesPendientes: { opciones: ProductoOpcion[]; variantes: ProductoVariante[] } | null = null;

  form =this.fb.group({
    nombre:        ['', [Validators.required, Validators.minLength(2)]],
    categoria:     ['tote', Validators.required],
    precio:        [null as number | null, [Validators.required, Validators.min(1)]],
    stock_inicial: [0, [Validators.required, Validators.min(0)]],
    activo:        [true],
    color:         [null as string | null],
    flag:          [null as string | null],
    descripcion:   [''],
    destacado:     [false],
  });

  constructor() {
    // Al crear con variantes el campo de stock se oculta: un valor inválido
    // escrito antes bloquearía el guardado sin nada visible. En edición el
    // control ya está deshabilitado siempre.
    effect(() => {
      const conVariantes = this.editor()?.activo() ?? false;
      if (this.isEdit()) return;
      const c = this.form.get('stock_inicial')!;
      if (conVariantes) { c.setValue(0, { emitEvent: false }); c.disable({ emitEvent: false }); }
      else c.enable({ emitEvent: false });
    });
    // La confirmación vale para un número concreto de desactivadas: si cambia,
    // hay que volver a confirmar.
    effect(() => {
      this.editor()?.desactivadas();
      untracked(() => this.confirmarDesactivar.set(null));
    });
  }

  async ngOnInit() {
    this.form.get('precio')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => this.precio.set(v ?? null));
    this.inv.getCategoriasUsadas().then(cats => this.categoriasUsadas.set(cats));
    this.inv.getEtiquetasUsadas().then(tags => this.etiquetasUsadas.set(tags));

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.editId.set(id);
    const p = await this.inv.getProducto(id);
    if (!p) { this.errorMsg.set('No se encontró el producto.'); return; }

    this.form.patchValue({
      nombre:        p.nombre,
      categoria:     p.categoria,
      precio:        p.precio,
      stock_inicial: p.stock_inicial,
      activo:        p.activo,
      color:         p.color,
      flag:          p.flag,
      destacado:     p.destacado ?? false,
      descripcion:   p.descripcion ?? '',
    });
    // El stock actual lo mueven el POS, el restock y los ajustes; editar el
    // inicial a mano desincronizaría el historial.
    this.form.get('stock_inicial')?.disable();
    this.coverGuardada = p.cover_url;
    this.coverPreview.set(p.cover_url);
    this.galeria.set({ existentes: p.fotos ?? [], nuevos: [] });
    this.material.set(p.material ?? []);
    this.materialTexto = (p.material ?? []).join(', ');

    try {
      const { opciones, variantes } = await this.inv.getVariantesAdmin(id);
      this.teniaVariantes = variantes.some(v => v.activo);
      const ed = this.editor();
      if (ed) ed.cargar(opciones, variantes);
      else this.variantesPendientes = { opciones, variantes };
    } catch {
      this.variantesFallaron = true;
      this.errorMsg.set('No se pudieron cargar las variantes. Recarga la página antes de guardar.');
    }
  }

  ngAfterViewInit() {
    const pendientes = this.variantesPendientes;
    const ed = this.editor();
    if (pendientes && ed) {
      ed.cargar(pendientes.opciones, pendientes.variantes);
      this.variantesPendientes = null;
    }
  }

  ngOnDestroy() {
    this.revocarTodos();
  }

  // ── Guardado ──────────────────────────────────────────────────────────────

  async guardar() {
    // Una categoría nueva sin escribir es un formulario incompleto, no un
    // producto sin categoría.
    if (this.creandoCategoria() && !slugCategoria(this.categoriaNueva)) {
      this.errorMsg.set('Escribe el nombre de la categoría nueva.');
      return;
    }
    if (this.creandoEtiqueta() && !this.etiquetaNueva.trim()) {
      this.errorMsg.set('Escribe el texto de la etiqueta nueva.');
      return;
    }
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.variantesFallaron) {
      this.errorMsg.set('No se pudieron cargar las variantes. Recarga la página antes de guardar.');
      return;
    }
    const ed = this.editor();
    // Un valor escrito sin Enter cuenta: la tabla lo refleja antes de validar.
    if (ed?.activo()) ed.confirmarValoresPendientes();
    const errVariantes = ed?.error();
    if (errVariantes) { this.errorMsg.set(errVariantes); return; }
    // Desactivar combinaciones es fácil de hacer sin querer (quitar un valor);
    // el primer clic avisa y el segundo confirma ese mismo número.
    const desactivadas = ed?.desactivadas() ?? 0;
    if (desactivadas > 0 && this.confirmarDesactivar() !== desactivadas) {
      this.errorMsg.set(null);
      this.confirmarDesactivar.set(desactivadas);
      return;
    }
    this.guardando.set(true);
    this.errorMsg.set(null);
    try {
      const v = this.form.getRawValue();
      const categoria = this.creandoCategoria()
        ? slugCategoria(this.categoriaNueva)
        : v.categoria!;
      const datos = {
        nombre:      v.nombre!,
        categoria,
        precio:      v.precio!,
        activo:      v.activo ?? true,
        material:    this.material(),
        color:       v.color ?? null,
        flag:        this.creandoEtiqueta()
          ? this.etiquetaNueva.trim().slice(0, MAX_LARGO_ETIQUETA)
          : (v.flag ?? null),
        destacado:   v.destacado ?? false,
        descripcion: v.descripcion || null,
      };

      // Primero el registro, después las imágenes: sólo con el id definitivo se
      // pueden subir a la carpeta del producto en vez de a una temporal.
      // Con variantes el stock vive en cada combinación; el del producto es su suma.
      const id = await this.asegurarId(datos, ed?.activo() ? 0 : v.stock_inicial ?? 0);
      if (!id) return;

      const imagenes = await this.subirImagenes(id);
      if (!imagenes) return;

      const { error } = await this.inv.updateProducto(id, { ...datos, ...imagenes });
      if (error) { this.errorMsg.set(error); return; }

      if (ed && (ed.activo() || this.teniaVariantes)) {
        const { opciones, variantes } = ed.payload();
        const { error: vErr } = await this.inv.guardarVariantes(id, opciones, variantes);
        if (vErr) { this.errorMsg.set(`El producto se guardó, pero las variantes no: ${vErr}`); return; }
        await this.inv.cargarTodos();
      }

      this.router.navigate(['/admin/productos']);
    } catch (e: unknown) {
      this.errorMsg.set(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      this.guardando.set(false);
      // Cada intento consume la confirmación: el siguiente vuelve a pedirla.
      this.confirmarDesactivar.set(null);
    }
  }

  /** Devuelve el id a usar, creando el producto si aún no existe. */
  private async asegurarId(
    datos: Partial<ProductoEvento>,
    stockInicial: number,
  ): Promise<string | null> {
    const existente = this.editId() ?? this.creadoId;
    if (existente) return existente;

    let eventoId = 'Venta-regular';
    try {
      eventoId = (await this.eventos.getEventoActivo())?.id ?? 'Venta-regular';
    } catch { /* sin evento activo: catálogo regular */ }

    const { id, error } = await this.inv.createProducto({
      ...(datos as Omit<ProductoEvento, 'id' | 'creado_en' | 'stock_actual'>),
      evento_id:     eventoId,
      stock_inicial: stockInicial,
      cover_url:     null,
      fotos:         [],
    });
    if (error || !id) { this.errorMsg.set(error ?? 'No se pudo crear el producto.'); return null; }
    this.creadoId = id;
    return id;
  }

  /** Sube portada y galería pendientes. Devuelve null si algo falló. */
  private async subirImagenes(
    id: string,
  ): Promise<{ cover_url: string | null; fotos: string[] } | null> {
    let cover = this.coverGuardada;
    if (this.coverFile) {
      const ext = this.coverFile.name.split('.').pop() ?? 'jpg';
      const { url, error } = await this.inv.uploadProductoImage(id, this.coverFile, `cover.${ext}`);
      if (error) { this.errorMsg.set(`Error al subir portada: ${error}`); return null; }
      cover = url;
      // Subida buena: no repetirla si el guardado se reintenta. La vista previa
      // pasa a apuntar al archivo real para poder soltar el object URL.
      this.coverGuardada = url;
      this.coverFile = null;
      const blob = this.coverPreview();
      this.coverPreview.set(url);
      if (blob?.startsWith('blob:')) URL.revokeObjectURL(blob);
    }

    const g = this.galeria();
    const fotos = [...g.existentes];
    for (const file of g.nuevos) {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const nombre = `foto_${Date.now()}_${fotos.length}.${ext}`;
      const { url, error } = await this.inv.uploadProductoImage(id, file, nombre);
      if (error) { this.errorMsg.set(`Error al subir "${file.name}": ${error}`); return null; }
      if (url) fotos.push(url);
    }
    // Las nuevas ya son existentes; un reintento no las vuelve a subir.
    this.galeria.set({ existentes: fotos, nuevos: [] });
    this.revocarGaleria();

    return { cover_url: cover, fotos };
  }

  cancelar() { this.router.navigate(['/admin/productos']); }

  hasError(field: string) {
    const c = this.form.get(field);
    return c?.invalid && c?.touched;
  }

  // ── Imágenes ──────────────────────────────────────────────────────────────

  onCoverChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';               // permite volver a elegir el mismo archivo
    if (!file) return;

    const invalida = validarImagen(file);
    if (invalida) { this.avisos.set([invalida]); return; }

    const previo = this.coverPreview();
    if (previo?.startsWith('blob:')) URL.revokeObjectURL(previo);
    this.avisos.set([]);
    this.coverFile = file;
    this.coverPreview.set(URL.createObjectURL(file));
  }

  onGalleryChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const seleccion = Array.from(input.files ?? []);
    input.value = '';
    if (!seleccion.length) return;

    const { estado, rechazados } = agregarAGaleria(this.galeria(), seleccion);
    for (const file of estado.nuevos) {
      if (!this.blobs.has(file)) this.blobs.set(file, URL.createObjectURL(file));
    }
    this.galeria.set(estado);
    this.avisos.set(rechazados);
  }

  removeGalleryItem(index: number) {
    const { estado, archivoQuitado } = quitarDeGaleria(this.galeria(), index);
    if (archivoQuitado) this.revocar(archivoQuitado);
    this.galeria.set(estado);
  }

  private revocar(file: File) {
    const url = this.blobs.get(file);
    if (url) { URL.revokeObjectURL(url); this.blobs.delete(file); }
  }

  private revocarGaleria() {
    for (const url of this.blobs.values()) URL.revokeObjectURL(url);
    this.blobs.clear();
  }

  private revocarTodos() {
    this.revocarGaleria();
    const cover = this.coverPreview();
    if (cover?.startsWith('blob:')) URL.revokeObjectURL(cover);
  }

  // ── Categoría ─────────────────────────────────────────────────────────────
  /** El `<select>` reserva un valor para "escribir una nueva". */
  readonly VALOR_NUEVA = '__nueva__';

  onCategoriaChange(valor: string) {
    if (valor === this.VALOR_NUEVA) {
      this.creandoCategoria.set(true);
      return;
    }
    this.creandoCategoria.set(false);
    this.categoriaNueva = '';
    this.form.get('categoria')!.setValue(valor);
  }

  cancelarCategoriaNueva() {
    this.creandoCategoria.set(false);
    this.categoriaNueva = '';
    this.form.get('categoria')!.setValue(this.categorias()[0]?.id ?? 'tote');
  }

  // ── Etiqueta especial ─────────────────────────────────────────────────────
  onEtiquetaChange(valor: string) {
    if (valor === this.VALOR_NUEVA) {
      this.creandoEtiqueta.set(true);
      return;
    }
    this.creandoEtiqueta.set(false);
    this.etiquetaNueva = '';
    this.form.get('flag')!.setValue(valor || null);
  }

  cancelarEtiquetaNueva() {
    this.creandoEtiqueta.set(false);
    this.etiquetaNueva = '';
    this.form.get('flag')!.setValue(null);
  }

  /** Vista previa del id con el que se va a guardar la categoría escrita. */
  get slugNuevaCategoria(): string {
    return slugCategoria(this.categoriaNueva);
  }

  // ── Materiales ────────────────────────────────────────────────────────────
  /**
   * Antes era una lista fija de cinco casillas, así que un material que no
   * estuviera en ella no se podía registrar. Ahora es texto separado por comas.
   */
  onMaterialInput(valor: string) {
    this.materialTexto = valor;
    this.material.set(
      valor.split(',').map(m => m.trim()).filter(Boolean)
    );
  }

  // ── Comisión de Bold ──────────────────────────────────────────────────────
  onComisionPct(valor: string) {
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0) return;
    this.comisionPct.set(n);
    guardarComision(n, this.comisionIva());
  }

  onComisionIva(conIva: boolean) {
    this.comisionIva.set(conIva);
    guardarComision(this.comisionPct(), conIva);
  }

  fmt(n: number): string {
    return '$' + Math.round(n).toLocaleString('es-CO');
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

}
