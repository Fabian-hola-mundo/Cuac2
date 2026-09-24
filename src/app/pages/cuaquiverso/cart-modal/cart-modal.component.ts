import { Component, ElementRef, HostListener, effect, inject, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../services/cart.service';

const COLOR_MAP: Record<string, string> = {
  rio: '#2A6FDB', rosa: '#FF6FA8', sol: '#FFC93C', bone: '#D4DCE4',
  terra: '#E8623D', lila: '#8B6FD8', selva: '#1F8A5B', tibu: '#2E8FB8', cream: '#D8DEDE',
};

const FOCUSABLES = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

@Component({
  selector: 'app-cart-modal',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cart-modal.component.html',
  styleUrl: './cart-modal.component.scss',
})
export class CartModalComponent {
  readonly cart = inject(CartService);
  private doc   = inject(DOCUMENT);

  private panel = viewChild<ElementRef<HTMLElement>>('panel');
  private ultimoFoco: HTMLElement | null = null;

  constructor() {
    // El panel declaraba role="dialog" aria-modal="true" pero no se comportaba
    // como diálogo: no movía el foco, no lo devolvía, no escuchaba Escape y el
    // fondo seguía desplazándose y siendo tabulable detrás del overlay.
    effect(() => {
      const abierto = this.cart.isOpen();
      const panel   = this.panel()?.nativeElement;

      if (abierto) {
        this.ultimoFoco = this.doc.activeElement as HTMLElement | null;
        this.doc.body.style.overflow = 'hidden';
        panel?.focus();
      } else {
        this.doc.body.style.overflow = '';
        this.ultimoFoco?.focus?.();
        this.ultimoFoco = null;
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.cart.isOpen()) this.cart.close();
  }

  /** Encierra el tabulador dentro del panel mientras está abierto. */
  onKeydown(ev: Event): void {
    const evento = ev as KeyboardEvent;
    if (evento.key !== 'Tab') return;

    const panel = this.panel()?.nativeElement;
    if (!panel) return;

    const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLES))
      .filter(el => el.offsetParent !== null);
    if (focusables.length === 0) return;

    const primero = focusables[0];
    const ultimo  = focusables[focusables.length - 1];
    const activo  = this.doc.activeElement;

    if (evento.shiftKey && (activo === primero || activo === panel)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  colorHex(key: string): string {
    if (!key) return '#3D4856';
    if (key.startsWith('#') || key.startsWith('rgb')) return key;
    return COLOR_MAP[key] ?? '#3D4856';
  }
}
