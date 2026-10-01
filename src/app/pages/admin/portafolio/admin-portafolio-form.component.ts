import { Component, computed, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  PortfolioService,
  ProjectLink,
  PORTFOLIO_CATEGORIES,
  AUTHORS,
} from '../../../core/services/portfolio.service';
import { FOCO_CENTRO, Foco, normalizarFoco, varsFoco } from '../../../core/utils/encuadre-foco';
import { EncuadreFocoComponent, EncuadreListo, VistaEncuadre } from './encuadre-foco/encuadre-foco.component';

const MAX_FOTOS = 8;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

/** Una foto: ya guardada en Storage o elegida y sin subir. */
type Fuente = { url: string } | { file: File };
interface Foto { fuente: Fuente; foco: Foco }
const esArchivo = (f: Fuente): f is { file: File } => 'file' in f;

/** Qué se edita: la portada o la foto N de la galería. Una portada aún no aplicada viaja en `nueva`. */
interface Edicion { destino: 'portada' | number; src: string; titulo: string; vistas: VistaEncuadre[]; nueva?: Fuente }

const VISTAS_PORTADA = (tarjeta: Foco, hero: Foco): VistaEncuadre[] => [
  {
    id: 'tarjeta', etiqueta: 'Tarjeta', foco: tarjeta, zonaTitulo: true,
    ayuda: 'Así se ve en el grid del portafolio. Según su lugar, la tarjeta es más ancha o más alta: revisa las proporciones.',
    proporciones: [
      { etiqueta: '4:3', valor: 4 / 3 }, { etiqueta: '3:4', valor: 3 / 4 },
      { etiqueta: '1:1', valor: 1 }, { etiqueta: '16:9', valor: 16 / 9 },
    ],
  },
  {
    id: 'hero', etiqueta: 'Hero', foco: hero, zonaTitulo: true,
    ayuda: 'Así se ve arriba en la página del proyecto, a todo lo ancho y con el título encima.',
    proporciones: [
      { etiqueta: 'Escritorio', valor: 2.1 }, { etiqueta: 'Portátil', valor: 2.4 },
      { etiqueta: 'Celular', valor: 0.66 },
    ],
  },
];

const VISTA_FOTO = (foco: Foco, ancha: boolean): VistaEncuadre[] => {
  const proporciones = [{ etiqueta: '4:3', valor: 4 / 3 }, { etiqueta: '16:9', valor: 16 / 9 }];
  return [{
    id: 'foto', etiqueta: 'Galería', foco,
    ayuda: 'Así se ve en la galería del proyecto. Al abrirla en grande se ve la foto entera.',
    proporciones: ancha ? proporciones.reverse() : proporciones,
  }];
};

@Component({
  selector: 'app-admin-portafolio-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, EncuadreFocoComponent],
  templateUrl: './admin-portafolio-form.component.html',
  styleUrl: './admin-portafolio-form.component.scss',
})
export class AdminPortafolioFormComponent implements OnInit, OnDestroy {
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private fb        = inject(FormBuilder);
  private portfolio = inject(PortfolioService);

  readonly categorias = PORTFOLIO_CATEGORIES;
  readonly authors    = AUTHORS;
  readonly editId     = signal<string | null>(null);
  readonly guardando  = signal(false);
  readonly errorMsg        = signal<string | null>(null);
  readonly isEdit           = computed(() => this.editId() !== null);

  // ── Imágenes ──────────────────────────────────────────────────────────────
  // Se guardan completas; el encuadre de cada vista va aparte (ver encuadre-foco.ts).
  readonly portada      = signal<Fuente | null>(null);
  readonly focoTarjeta  = signal<Foco>({ ...FOCO_CENTRO });
  readonly focoHero     = signal<Foco>({ ...FOCO_CENTRO });
  readonly fotos        = signal<Foto[]>([]);
  readonly edicion      = signal<Edicion | null>(null);
  readonly avisos       = signal<string[]>([]);
  readonly eligiendoDeGaleria = signal(false);
  readonly maxFotos     = MAX_FOTOS;
  /** Object URLs vivos, uno por archivo, para soltarlos al salir. */
  private blobs = new Map<File, string>();

  readonly coverPreview  = computed(() => { const p = this.portada(); return p ? this.urlDe(p) : null; });
  readonly varsTarjeta   = computed(() => varsFoco(this.focoTarjeta()));
  readonly varsHero      = computed(() => varsFoco(this.focoHero()));
  readonly galeria       = computed(() => this.fotos().map(f => ({ url: this.urlDe(f.fuente), vars: varsFoco(f.foco) })));
  readonly galeriaLlena  = computed(() => this.fotos().length >= MAX_FOTOS);

  readonly selectedAuthors = signal<string[]>(['cuac']);

  readonly tags = signal<string[]>([]);
  tagInput      = '';

  readonly links = signal<ProjectLink[]>([]);
  readonly linkTypes: { id: ProjectLink['type']; label: string }[] = [
    { id: 'web',       label: 'Sitio web' },
    { id: 'video',     label: 'Video' },
    { id: 'behance',   label: 'Behance' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'other',     label: 'Otro' },
  ];
  readonly MAX_LINKS = 5;

  form = this.fb.group({
    title:            ['', [Validators.required, Validators.minLength(2)]],
    slug:             ['', [Validators.required]],
    category:         ['branding', Validators.required],
    headline:         [''],
    client_name:      [''],
    description:      [''],
    featured:         [false],
    published:        [false],
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      const p = await this.portfolio.getById(id);
      if (p) {
        this.form.patchValue({
          title:            p.title,
          slug:             p.slug,
          category:         p.category,
          headline:         p.headline ?? '',
          client_name:      p.client_name ?? '',
          description:      p.description ?? '',
          featured:         p.featured,
          published:        p.published,
        });
        this.selectedAuthors.set(p.authors);
        this.tags.set(p.tags);
        this.links.set(Array.isArray(p.links) ? [...p.links] : []);
        this.portada.set(p.cover_url ? { url: p.cover_url } : null);
        this.focoTarjeta.set(normalizarFoco(p.cover_focus_card));
        this.focoHero.set(normalizarFoco(p.cover_focus_hero));
        this.fotos.set((p.images ?? []).map((url, i) => ({ fuente: { url }, foco: normalizarFoco(p.images_focus?.[i]) })));
      }
    }
  }

  onTitleChange(val: string) {
    if (!this.isEdit()) {
      const slug = val.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      this.form.patchValue({ slug });
    }
  }

  toggleAuthor(a: string) {
    const current = this.selectedAuthors();
    if (current.includes(a)) {
      if (current.length > 1) this.selectedAuthors.set(current.filter(x => x !== a));
    } else {
      this.selectedAuthors.set([...current, a]);
    }
  }

  ngOnDestroy() {
    for (const url of this.blobs.values()) URL.revokeObjectURL(url);
    this.blobs.clear();
  }

  private urlDe(f: Fuente): string {
    if (!esArchivo(f)) return f.url;
    let url = this.blobs.get(f.file);
    if (!url) { url = URL.createObjectURL(f.file); this.blobs.set(f.file, url); }
    return url;
  }

  /** Suelta el blob de un archivo que ya no usan ni la portada ni la galería. */
  private soltarSiLibre(f: Fuente | null | undefined) {
    if (!f || !esArchivo(f)) return;
    const p = this.portada();
    const enUso = (p && esArchivo(p) && p.file === f.file)
      || this.fotos().some(x => esArchivo(x.fuente) && x.fuente.file === f.file);
    const url = this.blobs.get(f.file);
    if (!enUso && url) { URL.revokeObjectURL(url); this.blobs.delete(f.file); }
  }

  private validar(file: File): string | null {
    return TIPOS.includes(file.type) ? null : `"${file.name}" no es JPG, PNG ni WebP.`;
  }

  onCoverChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';               // permite volver a elegir el mismo archivo
    if (!file) return;
    const invalida = this.validar(file);
    if (invalida) { this.avisos.set([invalida]); return; }
    this.avisos.set([]);
    // Una portada nueva se encuadra antes de quedar puesta.
    this.abrirPortada({ file }, true);
  }

  /** Usa una foto de la galería como portada: la misma foto, sin subirla dos veces. */
  usarFotoDeGaleria(index: number) {
    const f = this.fotos()[index];
    if (!f) return;
    this.eligiendoDeGaleria.set(false);
    this.abrirPortada(f.fuente, true);
  }

  editarPortada() {
    const p = this.portada();
    if (p) this.abrirPortada(p, false);
  }

  private abrirPortada(fuente: Fuente, nueva: boolean) {
    this.edicion.set({
      destino: 'portada',
      src: this.urlDe(fuente),
      titulo: nueva ? 'Encuadrar portada' : 'Editar portada',
      vistas: VISTAS_PORTADA(nueva ? FOCO_CENTRO : this.focoTarjeta(), nueva ? FOCO_CENTRO : this.focoHero()),
      nueva: nueva ? fuente : undefined,
    });
  }

  editarFoto(index: number) {
    const f = this.fotos()[index];
    if (!f) return;
    const n = this.fotos().length;
    // Igual que en el detalle: la primera y la última (si quedan pares) van a lo ancho.
    const ancha = index === 0 || (index === n - 1 && n % 2 === 0);
    this.edicion.set({
      destino: index, src: this.urlDe(f.fuente), titulo: `Editar foto ${index + 1}`,
      vistas: VISTA_FOTO(f.foco, ancha),
    });
  }

  onEdicionLista({ archivo, focos }: EncuadreListo) {
    const e = this.edicion();
    if (!e) return;
    this.edicion.set(null);
    if (e.destino === 'portada') {
      const anterior = this.portada();
      this.portada.set(archivo ? { file: archivo } : e.nueva ?? anterior);
      this.focoTarjeta.set(focos['tarjeta']);
      this.focoHero.set(focos['hero']);
      this.soltarSiLibre(anterior);
      this.soltarSiLibre(e.nueva);
      return;
    }
    const i = e.destino;
    const anterior = this.fotos()[i]?.fuente;
    // La foto editada se queda en su lugar; el archivo sólo cambia si se giró.
    this.fotos.update(lista => lista.map((f, j) =>
      j === i ? { fuente: archivo ? { file: archivo } : f.fuente, foco: focos['foto'] } : f));
    this.soltarSiLibre(anterior);
  }

  cancelarEdicion() {
    const e = this.edicion();
    this.edicion.set(null);
    this.soltarSiLibre(e?.nueva);
  }

  onGalleryChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const seleccion = Array.from(input.files ?? []);
    input.value = '';
    if (!seleccion.length) return;
    const nuevas: Foto[] = [];
    const rechazados: string[] = [];
    for (const file of seleccion) {
      const invalida = this.validar(file);
      if (invalida) { rechazados.push(invalida); continue; }
      if (this.fotos().length + nuevas.length >= MAX_FOTOS) {
        rechazados.push(`"${file.name}" no cabe: máximo ${MAX_FOTOS} fotos.`);
        continue;
      }
      nuevas.push({ fuente: { file }, foco: { ...FOCO_CENTRO } });
    }
    this.fotos.update(lista => [...lista, ...nuevas]);
    this.avisos.set(rechazados);
  }

  removeGalleryItem(index: number) {
    const quitada = this.fotos()[index];
    this.fotos.update(lista => lista.filter((_, i) => i !== index));
    this.soltarSiLibre(quitada?.fuente);
  }

  /**
   * Sube lo pendiente con nombres nuevos (con uno fijo la CDN seguía sirviendo
   * la foto vieja). Si la portada es una foto de la galería se sube una sola vez.
   */
  private async subirImagenes(slug: string): Promise<{ cover: string | null; images: string[] } | null> {
    const subidas = new Map<File, string>();
    const subir = async (file: File, nombre: string): Promise<string | null> => {
      const hecha = subidas.get(file);
      if (hecha) return hecha;
      const ext = file.name.split('.').pop() ?? 'jpg';
      const { url, error } = await this.portfolio.uploadImage(slug, file, `${nombre}_${Date.now()}.${ext}`);
      if (error || !url) { this.errorMsg.set(`Error al subir "${file.name}": ${error ?? 'sin URL'}`); return null; }
      subidas.set(file, url);
      return url;
    };

    const fotos = this.fotos();
    const images: string[] = [];
    for (let i = 0; i < fotos.length; i++) {
      const f = fotos[i].fuente;
      const url = esArchivo(f) ? await subir(f.file, `img_${i + 1}`) : f.url;
      if (!url) return null;
      images.push(url);
    }

    const p = this.portada();
    let cover: string | null = null;
    if (p) {
      cover = esArchivo(p) ? await subir(p.file, 'cover') : p.url;
      if (!cover) return null;
    }

    // Ya subidas: un reintento de guardado no las repite.
    this.fotos.set(fotos.map((f, i) => ({ ...f, fuente: { url: images[i] } })));
    if (cover) this.portada.set({ url: cover });
    for (const file of subidas.keys()) this.soltarSiLibre({ file });
    return { cover, images };
  }

  addTag() {
    const t = this.tagInput.trim();
    if (t && !this.tags().includes(t)) this.tags.update(list => [...list, t]);
    this.tagInput = '';
  }

  removeTag(t: string) { this.tags.update(list => list.filter(x => x !== t)); }

  addLink() {
    if (this.links().length >= this.MAX_LINKS) return;
    this.links.update(list => [...list, { label: '', url: '', type: 'web' }]);
  }

  removeLink(i: number) {
    this.links.update(list => list.filter((_, idx) => idx !== i));
  }

  updateLink(i: number, field: keyof ProjectLink, value: string) {
    this.links.update(list =>
      list.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)),
    );
  }

  private cleanLinks(): ProjectLink[] {
    return this.links()
      .map(l => ({ ...l, label: l.label.trim(), url: l.url.trim() }))
      .filter(l => l.label && l.url);
  }

  async guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set(null);

    try {
      const v    = this.form.value;
      const slug = v.slug!;
      const subidas = await this.subirImagenes(slug);
      if (!subidas) return;

      const payload = {
        title:          v.title!,
        slug,
        category:       v.category!,
        authors:        this.selectedAuthors(),
        headline:       v.headline || null,
        client_name:    v.client_name || null,
        description:    v.description || null,
        cover_url:        subidas.cover,
        cover_focus_card: subidas.cover ? this.focoTarjeta() : null,
        cover_focus_hero: subidas.cover ? this.focoHero() : null,
        images:           subidas.images,
        images_focus:     this.fotos().map(f => f.foco),
        tags:           this.tags(),
        links:          this.cleanLinks(),
        featured:       v.featured ?? false,
        published:      v.published ?? false,
      };

      const result = this.isEdit()
        ? await this.portfolio.update(this.editId()!, payload)
        : await this.portfolio.create(payload);

      if (result.error) { this.errorMsg.set(result.error); return; }
      this.router.navigate(['/admin/portafolio']);
    } catch {
      this.errorMsg.set('Error al guardar el proyecto.');
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar() { this.router.navigate(['/admin/portafolio']); }

  hasError(field: string) {
    const c = this.form.get(field);
    return c?.invalid && c?.touched;
  }
}
