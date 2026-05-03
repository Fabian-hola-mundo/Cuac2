import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  HostListener,
  signal,
  NgZone,
} from '@angular/core';

@Component({
  selector: 'app-hero',
  standalone: true,
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent implements OnInit, OnDestroy {
  @ViewChild('heroCanvas') canvasRef!: ElementRef<HTMLDivElement>;
  @ViewChild('heroStage') stageRef!: ElementRef<HTMLDivElement>;

  focusedService = signal('');

  private depths = [
    { gx: 14, gy: 10 },
    { gx: -12, gy: 14 },
    { gx: -16, gy: -12 },
    { gx: 10, gy: -14 },
  ];

  private target = { x: 0, y: 0 };
  private current = { x: 0, y: 0 };
  private rafId: number | null = null;
  private idleInterval: ReturnType<typeof setInterval> | null = null;
  private idleT = 0;
  private rect: DOMRect | null = null;

  glyphTransforms = signal<string[]>(['', '', '', '']);

  private glyphSvcs = ['brand', 'motion', 'web', 'illu'];

  constructor(private ngZone: NgZone) {}

  ngOnInit() {
    this.ngZone.runOutsideAngular(() => {
      this.idleInterval = setInterval(() => {
        if (!this.rafId) {
          this.idleT += 0.02;
          this.setTarget(
            Math.sin(this.idleT) * 0.18,
            Math.cos(this.idleT * 0.7) * 0.14
          );
        }
      }, 60);
    });
  }

  ngOnDestroy() {
    if (this.idleInterval) clearInterval(this.idleInterval);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.rect && this.canvasRef) {
      this.rect = this.canvasRef.nativeElement.getBoundingClientRect();
    }
    if (!this.rect) return;
    const cx = this.rect.left + this.rect.width / 2;
    const cy = this.rect.top + this.rect.height / 2;
    const nx = Math.max(-1.2, Math.min(1.2, (e.clientX - cx) / (window.innerWidth / 2)));
    const ny = Math.max(-1.2, Math.min(1.2, (e.clientY - cy) / (window.innerHeight / 2)));
    this.ngZone.runOutsideAngular(() => this.setTarget(nx, ny));
  }

  @HostListener('window:resize')
  onResize() {
    this.rect = null;
  }

  private setTarget(x: number, y: number) {
    this.target.x = x;
    this.target.y = y;
    if (!this.rafId) this.rafId = requestAnimationFrame(() => this.tick());
  }

  private tick() {
    this.current.x += (this.target.x - this.current.x) * 0.08;
    this.current.y += (this.target.y - this.current.y) * 0.08;
    this.applyParallax();

    const done =
      Math.abs(this.target.x - this.current.x) < 0.001 &&
      Math.abs(this.target.y - this.current.y) < 0.001;

    if (done) {
      this.rafId = null;
    } else {
      this.rafId = requestAnimationFrame(() => this.tick());
    }
  }

  private applyParallax() {
    const focused = this.focusedService();
    const transforms = this.depths.map((d, i) => {
      const tx = this.current.x * d.gx;
      const ty = this.current.y * d.gy;
      const isActive = focused && this.glyphSvcs[i] === focused;
      const scale = isActive ? 1.18 : 1;
      return `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${scale})`;
    });

    this.ngZone.run(() => this.glyphTransforms.set(transforms));

    if (this.stageRef) {
      const s = this.stageRef.nativeElement.style;
      s.transform = `translate3d(${(this.current.x * 6).toFixed(2)}px,${(this.current.y * 6).toFixed(2)}px,0)`;
    }
  }

  setFocus(svc: string) {
    this.focusedService.set(svc);
    this.applyParallax();
  }

  clearFocus() {
    this.focusedService.set('');
    this.applyParallax();
  }

  isActive(svc: string): boolean {
    const f = this.focusedService();
    return f !== '' && f === svc;
  }

  isDimmed(svc: string): boolean {
    const f = this.focusedService();
    return f !== '' && f !== svc;
  }
}
