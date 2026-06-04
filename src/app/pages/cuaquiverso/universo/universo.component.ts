import { Component, OnInit, afterNextRender, inject, DestroyRef } from '@angular/core';
import { SeoService } from '../../../core/services/seo.service';
import { CartService } from '../services/cart.service';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { PersonajesService } from '../../../core/services/personajes.service';

@Component({
  selector: 'app-universo',
  standalone: true,
  imports: [CartModalComponent],
  templateUrl: './universo.component.html',
  styleUrl: './universo.component.scss',
})
export class UniversoComponent implements OnInit {
  readonly cart = inject(CartService);
  private destroyRef = inject(DestroyRef);
  private seo        = inject(SeoService);
  readonly personajesSvc = inject(PersonajesService);
  readonly String = String;

  private io?: IntersectionObserver;

  async ngOnInit(): Promise<void> {
    await this.personajesSvc.load();
    this.seo.set({
      title:       'El universo — Cuaquiverso',
      description: 'Conoce los personajes del Cuaquiverso: Cuac, Kiki, Roar, Yeison y más.',
      canonical:   'https://cuacdesign.com/cuaquiverso/universo',
    });
    // Después de que Angular re-renderice las cards dinámicas, observarlas
    setTimeout(() => this.observeNewReveals(), 0);
  }

  constructor() {
    afterNextRender(() => this.initReveal());
  }

  private initReveal(): void {
    this.io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add('is-visible');
            this.io!.unobserve(e.target);
          }
        }),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => this.io!.observe(el));
    this.destroyRef.onDestroy(() => this.io?.disconnect());
  }

  private observeNewReveals(): void {
    document.querySelectorAll('[data-reveal]:not(.is-visible)').forEach(el => this.io?.observe(el));
  }
}
