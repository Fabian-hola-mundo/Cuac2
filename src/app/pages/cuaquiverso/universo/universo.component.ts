import { Component, OnInit, afterNextRender, inject, DestroyRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../../core/services/seo.service';
import { CartService } from '../services/cart.service';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { CuaquiversoFooterComponent } from '../footer/cuaquiverso-footer.component';
import { PersonajesService } from '../../../core/services/personajes.service';

@Component({
  selector: 'app-universo',
  standalone: true,
  imports: [CartModalComponent, CuaquiversoFooterComponent],
  templateUrl: './universo.component.html',
  styleUrl: './universo.component.scss',
})
export class UniversoComponent implements OnInit {
  readonly cart              = inject(CartService);
  private destroyRef         = inject(DestroyRef);
  private seo                = inject(SeoService);
  private readonly platformId = inject(PLATFORM_ID);
  readonly personajesSvc = inject(PersonajesService);
  readonly String = String;

  private io?: IntersectionObserver;

  async ngOnInit(): Promise<void> {
    await this.personajesSvc.load();

    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.initHeroScene(), 0);
    }

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

  private async initHeroScene(): Promise<void> {
    const container = document.getElementById('uni-hero-canvas');
    if (!container) return;

    const THREE = await import('three');
    const chars = this.personajesSvc.activos().slice(0, 4);
    if (chars.length === 0) return;

    function makeBlobTexture(hex: string) {
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const ctx = c.getContext('2d')!;
      const rv = parseInt(hex.slice(1, 3), 16);
      const gv = parseInt(hex.slice(3, 5), 16);
      const bv = parseInt(hex.slice(5, 7), 16);
      ctx.filter = 'blur(16px)';
      const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      grad.addColorStop(0,   `rgba(${rv},${gv},${bv},0.50)`);
      grad.addColorStop(0.4, `rgba(${rv},${gv},${bv},0.18)`);
      grad.addColorStop(1,   `rgba(${rv},${gv},${bv},0.00)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    const layout: [number, number, number, number][] = [
      [ 1.8,  0.6,  0.0, 2.4],
      [-1.4,  1.0, -0.2, 2.0],
      [ 0.8, -1.0,  0.4, 2.2],
      [-0.6, -0.5,  0.0, 1.8],
    ];

    const speeds = [
      { sx: 0.28, sy: 0.22, px: 0.0, py: 0.0 },
      { sx: 0.35, sy: 0.30, px: 1.2, py: 0.8 },
      { sx: 0.42, sy: 0.38, px: 2.4, py: 1.6 },
      { sx: 0.31, sy: 0.25, px: 3.6, py: 2.4 },
    ];

    const aspect = () =>
      container.clientHeight > 0 ? container.clientWidth / container.clientHeight : 1;

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(38, aspect(), 0.1, 100);
    camera.position.set(0, 0, 5.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const orbs = chars.map((ch, i) => {
      const [bx, by, bz, sc] = layout[i];
      const sp = speeds[i];
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeBlobTexture(ch.color ?? '#2A6FDB'),
        transparent: true,
        opacity: 0.22,
        blending: THREE.NormalBlending,
        depthWrite: false,
      }));
      sprite.position.set(bx, by, bz);
      sprite.scale.set(sc, sc, 1);
      sprite.userData = { bx, by, sx: sp.sx, sy: sp.sy, px: sp.px, py: sp.py };
      group.add(sprite);
      return sprite;
    });

    const clock = new THREE.Clock();
    let animFrameId: number;

    const tick = () => {
      const t = clock.getElapsedTime();
      group.rotation.y = t * 0.004;
      orbs.forEach(b => {
        const s = b.userData;
        b.position.x = s.bx + Math.sin(t * s.sx + s.px) * 0.18;
        b.position.y = s.by + Math.sin(t * s.sy + s.py) * 0.18;
      });
      renderer.render(scene, camera);
      animFrameId = requestAnimationFrame(tick);
    };
    animFrameId = requestAnimationFrame(tick);

    const onResize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = aspect();
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(animFrameId);
      orbs.forEach(b => { b.material.map?.dispose(); b.material.dispose(); });
      renderer.dispose();
      window.removeEventListener('resize', onResize);
    });
  }
}
