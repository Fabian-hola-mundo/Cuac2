import { Directive, ElementRef, OnDestroy, afterNextRender, inject } from '@angular/core';

/**
 * Inclina un poco el elemento hacia donde mira la persona: con el giroscopio en
 * el celular y con el ratón en escritorio. Solo escribe --gx y --gy (de -1 a 1)
 * en el elemento; su CSS decide cuánto gira. Es la misma inclinación de las
 * cartas de la guía del tarot.
 */
@Directive({
  selector: '[appGiro]',
  standalone: true,
})
export class GiroDirective implements OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  private objetivo = { x: 0, y: 0 };
  private actual   = { x: 0, y: 0 };
  private base: number | null = null;
  private cuadro = 0;
  private quitar: (() => void)[] = [];

  constructor() {
    afterNextRender(() => this.iniciar());
  }

  private iniciar(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const escuchar = <K extends keyof WindowEventMap>(tipo: K, fn: (e: WindowEventMap[K]) => void) => {
      window.addEventListener(tipo, fn, { passive: true });
      this.quitar.push(() => window.removeEventListener(tipo, fn));
    };
    const limitar = (v: number) => Math.max(-1, Math.min(1, v));

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      escuchar('pointermove', e => {
        this.objetivo = {
          x: limitar((e.clientX / window.innerWidth) * 2 - 1),
          y: limitar((e.clientY / window.innerHeight) * 2 - 1),
        };
        this.animar();
      });
      return;
    }

    if (typeof DeviceOrientationEvent === 'undefined') return;

    const alOrientar = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      // El reposo es como cada quien sostiene el teléfono: la base lo sigue
      // despacio, así la pieza vuelve al centro cuando el celular se queda quieto.
      this.base = this.base === null ? e.beta : this.base + (e.beta - this.base) * 0.02;
      this.objetivo = {
        x: limitar(e.gamma / 22),
        y: limitar((e.beta - this.base) / 22),
      };
      this.animar();
    };

    // iOS pide permiso, y solo deja pedirlo después de un toque de la persona.
    const Orientacion = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof Orientacion.requestPermission === 'function') {
      const pedir = () => {
        window.removeEventListener('click', pedir);
        Orientacion.requestPermission!()
          .then(r => { if (r === 'granted') escuchar('deviceorientation', alOrientar); })
          .catch(() => {});
      };
      window.addEventListener('click', pedir);
      this.quitar.push(() => window.removeEventListener('click', pedir));
    } else {
      escuchar('deviceorientation', alOrientar);
    }
  }

  /** Acerca el valor actual al objetivo cuadro a cuadro, para que el giro sea suave. */
  private animar(): void {
    if (this.cuadro) return;
    const paso = () => {
      const a = this.actual, o = this.objetivo;
      a.x += (o.x - a.x) * 0.12;
      a.y += (o.y - a.y) * 0.12;
      const quieto = Math.abs(o.x - a.x) < 0.002 && Math.abs(o.y - a.y) < 0.002;
      this.el.nativeElement.style.setProperty('--gx', a.x.toFixed(3));
      this.el.nativeElement.style.setProperty('--gy', a.y.toFixed(3));
      this.cuadro = quieto ? 0 : requestAnimationFrame(paso);
    };
    this.cuadro = requestAnimationFrame(paso);
  }

  ngOnDestroy(): void {
    this.quitar.forEach(fn => fn());
    if (this.cuadro) cancelAnimationFrame(this.cuadro);
  }
}
