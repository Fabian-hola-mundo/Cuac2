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
  esArchivo,
  quitarDeGaleria,
  reemplazarEnGaleria,
  totalGaleria,
  validarImagen,
} from './galeria';
import { VariantesEditorComponent } from './variantes-editor/variantes-editor.component';
import { EncuadreImagenComponent } from './encuadre/encuadre-imagen.component';

/** Foto completa de la que sale una imagen editada. `propio`: blob que hay que revocar. */
interface Origen { src: string; propio: boolean }

/** Qué se está editando: la portada o la foto N de la galería. */
interface Edicion { destino: 'portada' | number; origen: Origen; titulo: string }

@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, VariantesEditorComponent, EncuadreImagenComponent],
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
  /** Foto completa de la que sale la portada, para volver a editarla sin perder calidad. */
  private origenPortada: Origen | null = null;
  /** Selector de "usar una foto de la galería como portada" abierto. */
  readonly eligiendoDeGaleria = signal(false);
  /** Portada anterior a borrar de Storage cuando la nueva quede guardada. */
  private coverReemplazada: string | null = null;

  // ── Editor de imagen (portada y galería) ─────────────────────────────────
  /** Imagen abierta en el editor; null = cerrado. */
  readonly edicion = signal<Edicion | null>(null);

  // ── Galería ───────────────────────────────────────────────────────────────
  readonly galeria = signal<EstadoGaleria>({ items: [] });
  /** Object URLs vivos, para revocarlos y no dejar blobs colgando. */
  private blobs = new Map<File, string>();
  readonly galeriaPreviews = computed(() =>
    this.galeria().items.map(it => (esArchivo(it) ? this.blobs.get(it.file) ?? '' : it.url)));
  readonly galeriaLlena = computed(() => totalGaleria(this.galeria()) >= MAX_FOTOS);
  /** Foto completa de la que sale cada archivo editado de la galería. */
  private origenes = new Map<File, Origen>();
  /** Fotos ya subidas que se reemplazaron por su versión editada: se borran al guardar. */
  private fotosReemplazadas: string[] = [];

  /**
   * Id del producto ya insertado en un intento previo de guardado. Si la subida
   * de imágenes falla, reintentar no debe crear un segundo producto.
   */
  private creadoId: string | null = null;

  // ── Variantes ─────────────────────────────────────────────────────────────
  readonly editor = viewChild(VariantesEditorComponent);
  /** Fotos ya guardadas: las únicas que se pueden asignar a un valor. */
  readonly fotosGuardadas = computed(() => {
    const urls = this.galeria().items.flatMap(it => (esArchivo(it) ? [] : [it.url]));
    return [this.coverPreview(), ...urls].filter((u): u is string => !!u && !u.startsWith('blob:'));
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
    /** Al crear es el stock inicial; al editar, el stock actual. */
    stock:         [0 as number | null, [Validators.required, Validators.min(0)]],
    activo:        [true],
    color:         [null as string | null],
    flag:          [null as string | null],
    descripcion:   [''],
    destacado:     [false],
  });

  // ── Stock ─────────────────────────────────────────────────────────────────
  /** Stock actual en la base al cargar (o tras un restock): contra él se mide el ajuste. */
  private stockBase: number | null = null;
  readonly restockAbierto   = signal(false);
  readonly restockGuardando = signal(false);
  readonly restockError     = signal<string | null>(null);
  readonly restockOk        = signal<string | null>(null);
  restockCantidad: number | null = null;
  restockNota = '';

  constructor() {
    // Con variantes el campo de stock se oculta (va por combinación): un valor
    // inválido escrito antes bloquearía el guardado sin nada visible.
    effect(() => {
      const conVariantes = this.editor()?.activo() ?? false;
      const c = this.form.get('stock')!;
      if (conVariantes) {
        if (!this.isEdit()) c.setValue(0, { emitEvent: false });
        c.disable({ emitEvent: false });
      } else c.enable({ emitEvent: false });
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
      stock:         p.stock_actual,
      activo:        p.activo,
      color:         p.color,
      flag:          p.flag,
      destacado:     p.destacado ?? false,
      descripcion:   p.descripcion ?? '',
    });
    // Editar el número a mano se guarda como ajuste, así el historial cuadra.
    this.stockBase = p.stock_actual;
    this.coverGuardada = p.cover_url;
    this.coverPreview.set(p.cover_url);
    this.galeria.set({ items: (p.fotos ?? []).map(url => ({ url })) });
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
      const id = await this.asegurarId(datos, ed?.activo() ? 0 : v.stock ?? 0);
      if (!id) return;

      const imagenes = await this.subirImagenes(id);
      if (!imagenes) return;

      const { error } = await this.inv.updateProducto(id, { ...datos, ...imagenes });
      if (error) { this.errorMsg.set(error); return; }
      if (this.coverReemplazada) {
        // Si también está en la galería sigue en uso. Si el borrado falla queda
        // un archivo huérfano, no un producto roto: no se avisa.
        if (!imagenes.fotos.includes(this.coverReemplazada)) {
          await this.inv.borrarImagenProducto(this.coverReemplazada);
        }
        this.coverReemplazada = null;
      }
      // Fotos de galería cambiadas por su versión girada: el producto ya no las usa.
      for (const url of this.fotosReemplazadas) {
        if (!imagenes.fotos.includes(url) && url !== imagenes.cover_url) await this.inv.borrarImagenProducto(url);
      }
      this.fotosReemplazadas = [];

      // Con variantes el stock del producto es la suma de las combinaciones.
      const stock = v.stock ?? 0;
      if (this.isEdit() && !ed?.activo() && this.stockBase !== null && stock !== this.stockBase) {
        const { error: sErr } = await this.inv.ajustarStock(id, stock, 'Ajuste desde el formulario');
        if (sErr) { this.errorMsg.set(`El producto se guardó, pero el stock no: ${sErr}`); return; }
        this.stockBase = stock;
      }

      if (ed && (ed.activo() || this.teniaVariantes)) {
        const { opciones, variantes } = ed.payload();
        const { error: vErr } = await this.inv.guardarVariantes(id, opciones, variantes);
        if (vErr) { this.errorMsg.set(`El producto se guardó, pero las variantes no: ${vErr}`); return; }
        for (const a of ed.ajustes()) {
          const { error: aErr } = await this.inv.ajustarStock(id, a.stock, 'Ajuste desde el formulario', a.varianteId);
          if (aErr) { this.errorMsg.set(`El producto se guardó, pero el stock de una combinación no: ${aErr}`); return; }
        }
        ed.confirmarAjustes();
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
      // Nombre nuevo en cada cambio: con uno fijo (`cover.webp`) la URL no
      // cambiaba y el navegador y la CDN seguían mostrando la portada vieja.
      const { url, error } = await this.inv.uploadProductoImage(id, this.coverFile, `cover_${Date.now()}.${ext}`);
      if (error) { this.errorMsg.set(`Error al subir portada: ${error}`); return null; }
      // La anterior se borra sólo cuando el producto ya apunte a la nueva.
      if (this.coverGuardada && this.coverGuardada !== url) this.coverReemplazada ??= this.coverGuardada;
      cover = url;
      // Subida buena: no repetirla si el guardado se reintenta. La vista previa
      // pasa a apuntar al archivo real para poder soltar el object URL.
      this.coverGuardada = url;
      this.coverFile = null;
      const blob = this.coverPreview();
      this.coverPreview.set(url);
      if (blob?.startsWith('blob:')) URL.revokeObjectURL(blob);
    }

    // En el orden de la grilla: una foto girada vuelve a su mismo lugar.
    const items = this.galeria().items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!esArchivo(it)) continue;
      const ext = it.file.name.split('.').pop() ?? 'jpg';
      const nombre = `foto_${Date.now()}_${i}.${ext}`;
      const { url, error } = await this.inv.uploadProductoImage(id, it.file, nombre);
      if (error || !url) { this.errorMsg.set(`Error al subir "${it.file.name}": ${error ?? 'sin URL'}`); return null; }
      // Cada subida buena pasa a ser una foto guardada: un reintento no la repite.
      this.revocar(it.file);
      this.galeria.update(g => ({ items: g.items.map((x, j) => (j === i ? { url } : x)) }));
    }
    const fotos = this.galeria().items.map(it => (esArchivo(it) ? '' : it.url)).filter(Boolean);

    return { cover_url: cover, fotos };
  }

  cancelar() { this.router.navigate(['/admin/productos']); }

  // ── Restock ───────────────────────────────────────────────────────────────
  abrirRestock() {
    this.restockCantidad = null;
    this.restockNota = '';
    this.restockError.set(null);
    this.restockOk.set(null);
    this.restockAbierto.set(true);
  }

  /** Se registra en el momento, no al guardar: es un movimiento, no un dato del formulario. */
  async registrarRestock() {
    const id = this.editId();
    const cantidad = this.restockCantidad;
    if (!id || this.restockGuardando()) return;
    if (!cantidad || cantidad <= 0 || !Number.isInteger(cantidad)) {
      this.restockError.set('Ingresa una cantidad entera mayor a 0.');
      return;
    }
    this.restockGuardando.set(true);
    this.restockError.set(null);
    const { error } = await this.inv.restockProducto(id, cantidad, this.restockNota.trim() || undefined);
    this.restockGuardando.set(false);
    if (error) { this.restockError.set(error); return; }
    // Si había un número escrito a mano se conserva la diferencia que el admin
    // quería ajustar; sin cambios pendientes el campo queda en el stock real.
    const c = this.form.get('stock')!;
    const pendiente = (c.value ?? 0) - (this.stockBase ?? 0);
    this.stockBase = (this.stockBase ?? 0) + cantidad;
    c.setValue(this.stockBase + pendiente);
    this.restockAbierto.set(false);
    this.restockOk.set(`Restock de ${cantidad} registrado. Stock: ${this.stockBase}.`);
  }

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

    // La portada no se usa tal cual: primero se encuadra en el cuadro de la tienda.
    this.avisos.set([]);
    this.abrirEdicion('portada', { src: URL.createObjectURL(file), propio: true });
  }

  /** Usa una foto de la galería (subida o no) como punto de partida de la portada. */
  usarFotoDeGaleria(index: number) {
    const it = this.galeria().items[index];
    if (!it) return;
    this.eligiendoDeGaleria.set(false);
    // Si la foto ya se editó, se parte de su original completo (compartido: sólo
    // se suelta cuando ni la portada ni la galería lo usan).
    this.abrirEdicion('portada', esArchivo(it)
      ? this.origenes.get(it.file) ?? { src: URL.createObjectURL(it.file), propio: true }
      : { src: it.url, propio: false });
  }

  /** Ícono de edición de la portada: parte de la foto completa, no del recorte. */
  editarPortada() {
    const actual = this.coverPreview();
    const origen = this.origenPortada ?? (actual ? { src: actual, propio: false } : null);
    if (origen) this.abrirEdicion('portada', origen);
  }

  /** Ícono de edición de una foto de la galería. */
  editarFoto(index: number) {
    const it = this.galeria().items[index];
    if (!it) return;
    const origen = esArchivo(it)
      ? this.origenes.get(it.file) ?? { src: URL.createObjectURL(it.file), propio: true }
      : { src: it.url, propio: false };
    this.abrirEdicion(index, origen);
  }

  private abrirEdicion(destino: Edicion['destino'], origen: Origen) {
    const titulo = destino === 'portada' ? 'Editar portada' : `Editar foto ${destino + 1}`;
    this.edicion.set({ destino, origen, titulo });
  }

  onEdicionLista(file: File) {
    const e = this.edicion();
    if (!e) return;
    this.edicion.set(null);
    if (e.destino === 'portada') {
      const previo = this.coverPreview();
      if (previo?.startsWith('blob:')) URL.revokeObjectURL(previo);
      const previoOrigen = this.origenPortada;
      this.origenPortada = e.origen;
      if (previoOrigen && previoOrigen !== e.origen) this.liberarSiLibre(previoOrigen);
      this.coverFile = file;
      this.coverPreview.set(URL.createObjectURL(file));
      return;
    }
    // Galería: la versión editada ocupa el mismo lugar que la anterior.
    this.blobs.set(file, URL.createObjectURL(file));
    this.origenes.set(file, e.origen);
    const { estado, anterior } = reemplazarEnGaleria(this.galeria(), e.destino, file);
    this.galeria.set(estado);
    if (!anterior) return;
    if (esArchivo(anterior)) {
      this.revocar(anterior.file);
      const previo = this.origenes.get(anterior.file);
      this.origenes.delete(anterior.file);
      if (previo && previo !== e.origen) this.liberarSiLibre(previo);
    } else {
      this.fotosReemplazadas.push(anterior.url);
    }
  }

  /** Cerrar sin aplicar: sólo se suelta el blob si nadie más lo usa. */
  cancelarEdicion() {
    const e = this.edicion();
    this.edicion.set(null);
    if (e) this.liberarSiLibre(e.origen);
  }

  /** Revoca el blob de un original sólo si ya no lo usa la portada ni ninguna foto. */
  private liberarSiLibre(o: Origen) {
    const enUso = o === this.origenPortada || [...this.origenes.values()].includes(o);
    if (o.propio && !enUso) URL.revokeObjectURL(o.src);
  }

  onGalleryChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const seleccion = Array.from(input.files ?? []);
    input.value = '';
    if (!seleccion.length) return;

    const { estado, rechazados } = agregarAGaleria(this.galeria(), seleccion);
    for (const it of estado.items) {
      if (esArchivo(it) && !this.blobs.has(it.file)) this.blobs.set(it.file, URL.createObjectURL(it.file));
    }
    this.galeria.set(estado);
    this.avisos.set(rechazados);
  }

  removeGalleryItem(index: number) {
    const { estado, quitado } = quitarDeGaleria(this.galeria(), index);
    this.galeria.set(estado);
    if (quitado && esArchivo(quitado)) {
      this.revocar(quitado.file);
      const origen = this.origenes.get(quitado.file);
      this.origenes.delete(quitado.file);
      if (origen) this.liberarSiLibre(origen);
    }
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
    const origenes = new Set([...this.origenes.values(), ...(this.origenPortada ? [this.origenPortada] : [])]);
    for (const o of origenes) if (o.propio) URL.revokeObjectURL(o.src);
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
