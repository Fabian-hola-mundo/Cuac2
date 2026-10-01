// src/app/pages/admin/portafolio/encuadre-foco/encuadre-foco.component.ts
//
// Editor de imagen del portafolio: arrastrar para encuadrar, zoom y giro, como
// el de productos, pero sin recortar la foto. Cada "vista" (la tarjeta del grid,
// el hero del detalle, la galería) guarda su propio encuadre sobre la misma
// foto, y se previsualiza en las proporciones en que de verdad se muestra.
// Sólo el giro cambia el archivo: si se gira, se entrega la foto girada.
import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, computed, input, output, signal, viewChild,
} from '@angular/core';
import { FOCO_CENTRO, FOCO_ZOOM_MAX, Foco, estiloFoco, moverFoco, normalizarFoco } from '../../../../core/utils/encuadre-foco';
import { Giro, cargarImagen, lienzoAArchivo, lienzoGirado, normalizarGiro } from '../../productos/girar-imagen';

/** Lado mayor de la foto girada que se sube: da para el hero a pantalla completa. */
const LADO_GIRO = 2560;

export interface Proporcion { etiqueta: string; valor: number }

export interface VistaEncuadre {
  id: string;
  etiqueta: string;
  ayuda: string;
  /** Proporciones en que se muestra esta vista; la primera es la de partida. */
  proporciones: Proporcion[];
  foco: Foco;
  /** Marca la zona donde el sitio monta el título encima de la foto. */
  zonaTitulo?: boolean;
}

export interface EncuadreListo {
  /** Foto girada, o null si no se giró (se conserva el archivo de siempre). */
  archivo: File | null;
  focos: Record<string, Foco>;
}

@Component({
  selector: 'app-encuadre-foco',
  standalone: true,
  templateUrl: './encuadre-foco.component.html',
  styleUrl: './encuadre-foco.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cancelar.emit()' },
})
export class EncuadreFocoComponent implements OnInit, OnDestroy {
  readonly src = input.required<string>();
  readonly titulo = input('Editar imagen');
  readonly vistas = input.required<VistaEncuadre[]>();
  readonly listo = output<EncuadreListo>();
  readonly cancelar = output<void>();

  readonly ZOOM_MAX = FOCO_ZOOM_MAX;
  private readonly caja = viewChild<ElementRef<HTMLDivElement>>('caja');
  private original: HTMLImageElement | null = null;
  private blobVista: string | null = null;

  readonly giro = signal<Giro>(0);
  readonly dims = signal<{ ancho: number; alto: number } | null>(null);
  readonly urlVista = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  readonly activa = signal(0);
  /** Proporción elegida en cada vista (índice dentro de sus proporciones). */
  readonly proporcionPorVista = signal<number[]>([]);
  readonly focos = signal<Foco[]>([]);

  readonly vista = computed(() => this.vistas()[this.activa()]);
  readonly proporcion = computed(() => {
    const v = this.vista();
    return v.proporciones[this.proporcionPorVista()[this.activa()] ?? 0] ?? v.proporciones[0];
  });
  readonly foco = computed(() => this.focos()[this.activa()] ?? FOCO_CENTRO);
  readonly estiloFoto = computed(() => {
    const url = this.urlVista();
    return url ? { ...estiloFoco(this.foco()), 'background-image': `url("${url}")` } : {};
  });

  private arrastre: { id: number; x: number; y: number; foco: Foco } | null = null;

  async ngOnInit(): Promise<void> {
    this.focos.set(this.vistas().map(v => normalizarFoco(v.foco)));
    this.proporcionPorVista.set(this.vistas().map(() => 0));
    try {
      this.original = await cargarImagen(this.src());
      await this.aplicarGiro(0);
    } catch {
      this.error.set('No se pudo cargar la imagen.');
    }
  }

  ngOnDestroy(): void {
    if (this.blobVista) URL.revokeObjectURL(this.blobVista);
  }

  elegirVista(i: number): void { this.activa.set(i); }

  elegirProporcion(i: number): void {
    this.proporcionPorVista.update(p => p.map((v, j) => (j === this.activa() ? i : v)));
  }

  async girar(delta: -90 | 90): Promise<void> {
    if (!this.original) return;
    await this.aplicarGiro(normalizarGiro(this.giro() + delta));
    // Girada, la foto es otra: los encuadres previos ya no apuntan a lo mismo.
    this.focos.set(this.vistas().map(() => ({ ...FOCO_CENTRO })));
  }

  private async aplicarGiro(g: Giro): Promise<void> {
    const img = this.original!;
    let url = img.src, ancho = img.naturalWidth, alto = img.naturalHeight;
    if (g !== 0) {
      const lienzo = lienzoGirado(img, g, LADO_GIRO);
      const blob = await new Promise<Blob | null>(r => lienzo.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) { this.error.set('No se pudo girar la imagen.'); return; }
      url = URL.createObjectURL(blob);
      ancho = lienzo.width;
      alto = lienzo.height;
    }
    if (this.blobVista) URL.revokeObjectURL(this.blobVista);
    this.blobVista = g !== 0 ? url : null;
    this.giro.set(g);
    this.dims.set({ ancho, alto });
    this.urlVista.set(url);
  }

  private fijar(f: Partial<Foco>): void {
    const nuevo = normalizarFoco({ ...this.foco(), ...f });
    this.focos.update(lista => lista.map((v, i) => (i === this.activa() ? nuevo : v)));
  }

  setZoom(zoom: number): void { this.fijar({ zoom }); }
  centrar(): void { this.fijar({ ...FOCO_CENTRO }); }

  /** Copia a esta vista el encuadre de otra (p. ej. el de la tarjeta al hero). */
  copiarDe(i: number): void { this.fijar({ ...this.focos()[i] }); }

  // ── Arrastre ──────────────────────────────────────────────────────────────
  onPointerDown(ev: PointerEvent): void {
    if (!this.dims()) return;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this.arrastre = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, foco: this.foco() };
    ev.preventDefault();
  }

  onPointerMove(ev: PointerEvent): void {
    const a = this.arrastre, d = this.dims(), el = this.caja()?.nativeElement;
    if (!a || a.id !== ev.pointerId || !d || !el) return;
    const f = moverFoco(a.foco, ev.clientX - a.x, ev.clientY - a.y, d.ancho, d.alto, el.clientWidth, el.clientHeight);
    this.fijar(f);
  }

  onPointerUp(ev: PointerEvent): void {
    if (this.arrastre?.id === ev.pointerId) this.arrastre = null;
  }

  onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    this.setZoom(this.foco().zoom * Math.exp(-ev.deltaY * 0.0015));
  }

  onKey(ev: KeyboardEvent): void {
    const f = this.foco();
    // Las flechas mueven la foto, igual que arrastrarla: a la derecha baja x.
    const mov: Record<string, Partial<Foco>> = {
      ArrowLeft: { x: f.x + 2 }, ArrowRight: { x: f.x - 2 },
      ArrowUp: { y: f.y + 2 }, ArrowDown: { y: f.y - 2 },
      '+': { zoom: f.zoom * 1.1 }, '=': { zoom: f.zoom * 1.1 }, '-': { zoom: f.zoom / 1.1 },
    };
    const cambio = mov[ev.key];
    if (!cambio) return;
    ev.preventDefault();
    this.fijar(cambio);
  }

  // ── Confirmar ─────────────────────────────────────────────────────────────
  async confirmar(): Promise<void> {
    if (!this.original || !this.dims() || this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);
    try {
      const archivo = this.giro() === 0
        ? null
        : await lienzoAArchivo(lienzoGirado(this.original, this.giro(), LADO_GIRO), 'foto');
      const focos = Object.fromEntries(this.vistas().map((v, i) => [v.id, this.focos()[i]]));
      this.listo.emit({ archivo, focos });
    } catch {
      this.error.set('No se pudo aplicar el giro. Prueba subiendo la foto de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
