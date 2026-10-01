// src/app/pages/admin/productos/encuadre/encuadre-imagen.component.ts
//
// Diálogo para encuadrar la portada: se arrastra la foto y se ajusta el zoom
// dentro de un cuadro igual al de la tarjeta de la tienda. Al confirmar se
// dibuja ese encuadre en un lienzo de 1600×1600 y se entrega como archivo.
import {
  ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, input, output, signal, viewChild,
} from '@angular/core';
import { Encuadre, LADO_SALIDA, ZOOM_MAX, limitar, rectDibujo, zoomEntera } from './encuadre';

@Component({
  selector: 'app-encuadre-imagen',
  standalone: true,
  templateUrl: './encuadre-imagen.component.html',
  styleUrl: './encuadre-imagen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cancelar.emit()' },
})
export class EncuadreImagenComponent implements OnInit {
  /** URL de la foto: un blob recién elegido o la portada ya guardada. */
  readonly src = input.required<string>();
  readonly listo = output<File>();
  readonly cancelar = output<void>();

  readonly ZOOM_MAX = ZOOM_MAX;
  private readonly cuadro = viewChild.required<ElementRef<HTMLDivElement>>('cuadro');
  private img: HTMLImageElement | null = null;

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

  ngOnInit(): void {
    const src = this.src();
    // Una portada ya guardada puede estar en caché sin cabeceras CORS (se cargó
    // en un <img> normal) y eso bloquearía exportar el lienzo: se pide aparte.
    const url = /^(blob|data):/.test(src) ? src : `${src}${src.includes('?') ? '&' : '?'}encuadre=${Date.now()}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.img = img;
      this.dims.set({ ancho: img.naturalWidth, alto: img.naturalHeight });
      this.urlVista.set(url);
    };
    img.onerror = () => this.error.set('No se pudo cargar la imagen.');
    img.src = url;
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
    const img = this.img, d = this.dims();
    if (!img || !d || this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = LADO_SALIDA;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.imageSmoothingQuality = 'high';
      const r = rectDibujo(this.encuadre(), d.ancho, d.alto, 1, LADO_SALIDA);
      ctx.drawImage(img, r.x, r.y, r.ancho, r.alto);
      let blob = await aBlob(canvas, 'image/webp');
      if (!blob || blob.type !== 'image/webp') blob = await aBlob(canvas, 'image/jpeg');
      if (!blob) throw new Error('blob');
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
      this.listo.emit(new File([blob], `portada.${ext}`, { type: blob.type }));
    } catch {
      this.error.set('No se pudo generar el encuadre. Prueba subiendo la foto de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}

function aBlob(canvas: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, tipo, 0.86));
}

