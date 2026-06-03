import { Component, Input, afterNextRender, inject, DestroyRef, ElementRef } from '@angular/core';

type ShaderTheme = 'cuac' | 'natalia' | 'nathali';

// Theme accent (RGB) the dots tint toward near the cursor
const ACCENT: Record<ShaderTheme, [number, number, number]> = {
  cuac:    [236, 56, 19],
  natalia: [196, 85, 106],
  nathali: [92, 111, 199],
};

const DOT: [number, number, number] = [21, 31, 40]; // carbon

@Component({
  selector: 'app-portfolio-shader',
  standalone: true,
  template: `<canvas aria-hidden="true" role="presentation"></canvas>`,
  styleUrl: './portfolio-shader.component.scss',
})
export class PortfolioShaderComponent {
  @Input() theme: ShaderTheme = 'cuac';

  private destroyRef = inject(DestroyRef);
  private el         = inject(ElementRef);

  constructor() {
    afterNextRender(() => this.init());
  }

  private init(): void {
    const canvas = this.el.nativeElement.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const host     = canvas.parentElement as HTMLElement;
    const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const accent   = ACCENT[this.theme];

    const dpr  = Math.min(window.devicePixelRatio || 1, 2);
    const GAP  = 34;     // grid spacing (css px)
    const RINF = 165;    // cursor influence radius
    const BASE_R = 1.15; // dot radius at rest
    let w = 0, h = 0;

    // Smoothed cursor: position + intensity (0 = no mouse, 1 = engaged)
    const cur = { x: 0, y: 0, i: 0 };
    const tgt = { x: 0, y: 0, i: 0 };

    const resize = () => {
      w = host.clientWidth;
      h = host.clientHeight;
      canvas.width  = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (cur.i === 0) { cur.x = w / 2; cur.y = h * 0.45; tgt.x = cur.x; tgt.y = cur.y; }
    };
    resize();

    // Listen on window so pointer-events:none on the canvas host doesn't block it
    const onMove = (e: MouseEvent) => {
      const rect = host.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
        tgt.x = x; tgt.y = y; tgt.i = 1;
      } else {
        tgt.i = 0;
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    let resizeTimer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 120);
    });
    ro.observe(host);

    const draw = () => {
      cur.x += (tgt.x - cur.x) * 0.14;
      cur.y += (tgt.y - cur.y) * 0.14;
      cur.i += (tgt.i - cur.i) * 0.07;

      ctx.clearRect(0, 0, w, h);

      // Soft accent glow trailing the cursor
      if (cur.i > 0.01) {
        const g = ctx.createRadialGradient(cur.x, cur.y, 0, cur.x, cur.y, RINF * 1.7);
        g.addColorStop(0, `rgba(${accent[0]},${accent[1]},${accent[2]},${0.09 * cur.i})`);
        g.addColorStop(1, `rgba(${accent[0]},${accent[1]},${accent[2]},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      for (let y = GAP / 2; y < h; y += GAP) {
        for (let x = GAP / 2; x < w; x += GAP) {
          let r = BASE_R, a = 0.055;
          let cr = DOT[0], cg = DOT[1], cb = DOT[2];

          if (cur.i > 0.01) {
            const dx = x - cur.x, dy = y - cur.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < RINF) {
              const t = (1 - dist / RINF);
              const e = t * t * cur.i;
              r = BASE_R + e * 3.0;
              a = 0.055 + e * 0.5;
              cr = DOT[0] + (accent[0] - DOT[0]) * e;
              cg = DOT[1] + (accent[1] - DOT[1]) * e;
              cb = DOT[2] + (accent[2] - DOT[2]) * e;
            }
          }

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${a})`;
          ctx.fill();
        }
      }
    };

    if (noMotion) {
      draw(); // single static grid, no animation
    } else {
      let raf = requestAnimationFrame(function loop() {
        raf = requestAnimationFrame(loop);
        draw();
      });
      this.destroyRef.onDestroy(() => cancelAnimationFrame(raf));
    }

    this.destroyRef.onDestroy(() => {
      ro.disconnect();
      clearTimeout(resizeTimer);
      window.removeEventListener('mousemove', onMove);
    });
  }
}
