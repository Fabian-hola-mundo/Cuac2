import { Component, afterNextRender, inject, DestroyRef } from '@angular/core';

@Component({
  selector: 'app-universo',
  standalone: true,
  imports: [],
  templateUrl: './universo.component.html',
  styleUrl: './universo.component.scss',
})
export class UniversoComponent {
  private destroyRef = inject(DestroyRef);

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
