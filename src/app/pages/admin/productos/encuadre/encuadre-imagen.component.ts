// src/app/pages/admin/productos/encuadre/encuadre-imagen.component.ts
//
// Diálogo para encuadrar la portada: se arrastra la foto y se ajusta el zoom
// dentro de un cuadro igual al de la tarjeta de la tienda. Al confirmar se
// dibuja ese encuadre en un lienzo de 1600×1600 y se entrega como archivo.
// La foto se puede girar en pasos de 90° antes de encuadrar.
import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, computed, input, output, signal, viewChild,
} from '@angular/core';
import { Encuadre, LADO_SALIDA, ZOOM_MAX, limitar, rectDibujo, zoomEntera } from './encuadre';
import { Giro, cargarImagen, lienzoAArchivo, lienzoGirado, normalizarGiro } from '../girar-imagen';

/** Lado máximo del lienzo girado: holgura para hacer zoom sin perder nitidez. */
const LADO_GIRO = 4096;

@Component({
  selector: 'app-encuadre-imagen',
  standalone: true,
  templateUrl: './encuadre-imagen.component.html',
  styleUrl: './encuadre-imagen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cancelar.emit()' },
})
export class EncuadreImagenComponent implements OnInit, OnDestroy {
  /** URL de la foto: un blob recién elegido o la portada ya guardada. */
  readonly src = input.required<string>();
  readonly listo = output<File>();
  readonly cancelar = output<void>();

  readonly ZOOM_MAX = ZOOM_MAX;
  private readonly cuadro = viewChild.required<ElementRef<HTMLDivElement>>('cuadro');
  private original: HTMLImageElement | null = null;
  /** Lo que se dibuja: la foto tal cual o un lienzo con la foto girada. */
  private fuente: HTMLImageElement | HTMLCanvasElement | null = null;
  /** Object URL de la vista girada, para soltarlo al cambiar o cerrar. */
  private blobVista: string | null = null;
  readonly giro = signal<Giro>(0);

  readonly dims = signal<{ ancho: number; alto: number } | null>(null);
  /** x, y en fracciones del lado del cuadro: así no depende de su tamaño en pantalla. */
  readonly encuadre = signal<Encuadre>({ zoom: 1, x: 0, y: 0 });
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly urlVista = signal<string | null>(null);

  readonly zoomMin = computed(() => {
    const d = this.dims();
    return d ? zoomEntera(d.ancho, d.alto) : 1;
  });

  /** Posición de la foto en el cuadro, en porcentajes. */
  readonly estiloFoto = computed(() => {
    const d = this.dims();
    if (!d) return {};
    const r = rectDibujo(this.encuadre(), d.ancho, d.alto, 1, 100);
    return { left: `${r.x}%`, top: `${r.y}%`, width: `${r.ancho}%`, height: `${r.alto}%` };
  });

  private arrastre: { id: number; x: number; y: number; e: Encuadre } | null = null;

  async ngOnInit(): Promise<void> {
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

  /** Gira 90° a la izquierda (-90) o a la derecha (90) y vuelve a llenar el cuadro. */
  async girar(delta: -90 | 90): Promise<void> {
    if (!this.original) return;
    await this.aplicarGiro(normalizarGiro(this.giro() + delta));
  }

  private async aplicarGiro(g: Giro): Promise<void> {
    const img = this.original!;
    let fuente: HTMLImageElement | HTMLCanvasElement = img, url = img.src;
    if (g !== 0) {
      fuente = lienzoGirado(img, g, LADO_GIRO);
      const blob = await new Promise<Blob | null>(r => (fuente as HTMLCanvasElement).toBlob(r, 'image/png'));
      if (!blob) { this.error.set('No se pudo girar la imagen.'); return; }
      url = URL.createObjectURL(blob);
    }
    if (this.blobVista) URL.revokeObjectURL(this.blobVista);
    this.blobVista = g !== 0 ? url : null;
    this.fuente = fuente;
    this.giro.set(g);
    const ancho = fuente instanceof HTMLImageElement ? fuente.naturalWidth : fuente.width;
    const alto = fuente instanceof HTMLImageElement ? fuente.naturalHeight : fuente.height;
    this.dims.set({ ancho, alto });
    this.encuadre.set({ zoom: 1, x: 0, y: 0 });
    this.urlVista.set(url);
  }

  private fijar(e: Encuadre): void {
    const d = this.dims();
    if (d) this.encuadre.set(limitar(e, d.ancho, d.alto, 1));
  }

  setZoom(zoom: number): void {
    this.fijar({ ...this.encuadre(), zoom });
  }

  llenar(): void { this.fijar({ zoom: 1, x: 0, y: 0 }); }
  entera(): void { this.fijar({ zoom: this.zoomMin(), x: 0, y: 0 }); }

  // ── Arrastre ──────────────────────────────────────────────────────────────
  onPointerDown(ev: PointerEvent): void {
    if (!this.dims()) return;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this.arrastre = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, e: this.encuadre() };
    ev.preventDefault();
  }

  onPointerMove(ev: PointerEvent): void {
    const a = this.arrastre;
    if (!a || a.id !== ev.pointerId) return;
    const lado = this.cuadro().nativeElement.clientWidth || 1;
    this.fijar({ ...a.e, x: a.e.x + (ev.clientX - a.x) / lado, y: a.e.y + (ev.clientY - a.y) / lado });
  }

  onPointerUp(ev: PointerEvent): void {
    if (this.arrastre?.id === ev.pointerId) this.arrastre = null;
  }

  onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    this.setZoom(this.encuadre().zoom * Math.exp(-ev.deltaY * 0.0015));
  }

  onKey(ev: KeyboardEvent): void {
    const e = this.encuadre();
    const paso = 0.02;
    const mov: Record<string, Partial<Encuadre>> = {
      ArrowLeft: { x: e.x - paso }, ArrowRight: { x: e.x + paso },
      ArrowUp: { y: e.y - paso }, ArrowDown: { y: e.y + paso },
      '+': { zoom: e.zoom * 1.1 }, '=': { zoom: e.zoom * 1.1 }, '-': { zoom: e.zoom / 1.1 },
    };
    const cambio = mov[ev.key];
    if (!cambio) return;
    ev.preventDefault();
    this.fijar({ ...e, ...cambio });
  }

  // ── Exportar ──────────────────────────────────────────────────────────────
  async confirmar(): Promise<void> {
    const fuente = this.fuente, d = this.dims();
    if (!fuente || !d || this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = LADO_SALIDA;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.imageSmoothingQuality = 'high';
      const r = rectDibujo(this.encuadre(), d.ancho, d.alto, 1, LADO_SALIDA);
      ctx.drawImage(fuente, r.x, r.y, r.ancho, r.alto);
      this.listo.emit(await lienzoAArchivo(canvas, 'portada'));
    } catch {
      this.error.set('No se pudo generar el encuadre. Prueba subiendo la foto de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}

