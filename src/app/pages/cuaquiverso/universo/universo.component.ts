import { Component, OnInit, afterNextRender, inject, DestroyRef } from '@angular/core';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-universo',
  standalone: true,
  imports: [],
  templateUrl: './universo.component.html',
  styleUrl: './universo.component.scss',
})
export class UniversoComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private seo        = inject(SeoService);

  ngOnInit(): void {
    this.seo.set({
      title:       'El universo — Cuaquiverso',
      description: 'Conoce los personajes del Cuaquiverso: Cuac, Kiki, Roar, Yeison y más.',
      canonical:   'https://cuacdesign.com/cuaquiverso/universo',
    });
  }

  constructor() {
    afterNextRender(() => this.initReveal());
  }

  private initReveal(): void {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add('is-visible');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    this.destroyRef.onDestroy(() => io.disconnect());
  }
}
