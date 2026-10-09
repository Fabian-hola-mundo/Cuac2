import { Component, ElementRef, computed, input, viewChild } from '@angular/core';

/**
 * Texto de una reseña recortado a `max` caracteres. Si se pasa del límite,
 * muestra «Ver más», que abre el comentario completo en una ventana emergente.
 */
@Component({
  selector: 'app-resena-texto',
  standalone: true,
  templateUrl: './resena-texto.component.html',
  styleUrl: './resena-texto.component.scss',
})
export class ResenaTextoComponent {
  readonly texto   = input.required<string>();
  readonly nombre  = input<string | null>(null);
  readonly detalle = input<string | null>(null);
  readonly max     = input(180);

  private dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');

  readonly recortado = computed(() => this.texto().length > this.max());

  // Corta en el último espacio antes del límite para no partir palabras.
  readonly corto = computed(() => {
    const t = this.texto();
    if (!this.recortado()) return t;
    const base   = t.slice(0, this.max());
    const espacio = base.lastIndexOf(' ');
    return (espacio > this.max() * 0.6 ? base.slice(0, espacio) : base).replace(/[\s.,;:!?¡¿-]+$/, '') + '…';
  });

  abrir(ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    this.dialogo()?.nativeElement.showModal();
  }

  cerrar() {
    this.dialogo()?.nativeElement.close();
  }

  // Clic en el fondo (fuera de la tarjeta) cierra la ventana.
  clicFondo(ev: MouseEvent) {
    ev.stopPropagation();
    if (ev.target === this.dialogo()?.nativeElement) this.cerrar();
  }
}
