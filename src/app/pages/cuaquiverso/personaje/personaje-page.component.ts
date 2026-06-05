import { Component, OnInit, signal, computed, inject, PLATFORM_ID, DestroyRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { PersonajesService, Personaje } from '../../../core/services/personajes.service';
import { InventarioService, ProductoEvento } from '../../../core/services/inventario.service';
import { CartService } from '../services/cart.service';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { CuaquiversoFooterComponent } from '../footer/cuaquiverso-footer.component';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-personaje-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CartModalComponent, CuaquiversoFooterComponent],
  templateUrl: './personaje-page.component.html',
  styleUrl: './personaje-page.component.scss',
})
export class PersonajePageComponent implements OnInit {
  private route              = inject(ActivatedRoute);
  private router             = inject(Router);
  private seo                = inject(SeoService);
  readonly svcP              = inject(PersonajesService);
  readonly svcI              = inject(InventarioService);
  readonly cart              = inject(CartService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  readonly String            = String;

  personaje   = signal<Personaje | null>(null);
  productos   = signal<ProductoEvento[]>([]);
  selectedImg = signal<string | null>(null);

  prev = computed(() => {
    const p = this.personaje();
    if (!p) return null;
    const all = this.svcP.activos();
    const idx = all.findIndex(x => x.id === p.id);
    return idx > 0 ? all[idx - 1] : null;
  });

  next = computed(() => {
    const p = this.personaje();
    if (!p) return null;
    const all = this.svcP.activos();
    const idx = all.findIndex(x => x.id === p.id);
    return idx < all.length - 1 ? all[idx + 1] : null;
  });

  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    await this.svcP.load();
    const p = this.svcP.activos().find(x => x.key === slug);
    if (!p) { this.router.navigate(['/cuaquiverso/universo']); return; }
    this.personaje.set(p);
    if (p.galeria_urls.length > 0) this.selectedImg.set(p.galeria_urls[0]);

    if (isPlatformBrowser(this.platformId)) {
      let attempts = 0;
      const tryInit = () => {
        const container = document.getElementById('pj-hero-canvas');
        if (!container || !container.clientHeight) {
          if (++attempts < 30) requestAnimationFrame(tryInit);
          return;
        }
        this.initHeroScene(p);
      };
      requestAnimationFrame(tryInit);
    }

    this.seo.set({
      title:       `${p.nombre} — Cuaquiverso`,
      description: p.bio ? p.bio.slice(0, 160) : `Conoce a ${p.nombre} del Cuaquiverso.`,
      canonical:   `https://cuacdesign.com/cuaquiverso/personaje/${p.key}`,
    });

    await this.svcI.cargarTodos();
    this.productos.set(
      this.svcI.productos().filter(pr => pr.personaje === slug && pr.activo)
    );
  }

  addToCart(event: Event, p: ProductoEvento) {
    event.preventDefault();
    event.stopPropagation();
    this.cart.add({
      id:    p.id,
      name:  p.nombre,
      sub:   p.categoria,
      price: p.precio,
      color: p.color ?? '#ccc',
    });
  }

  private async initHeroScene(p: Personaje): Promise<void> {
    const container = document.getElementById('pj-hero-canvas');
    if (!container) return;

    const THREE = await import('three');

    const mainColor = p.color      ?? '#2A6FDB';
    const satColor  = p.wire_color ?? '#5C95EA';

    const orbDefs = [
      { color: mainColor, bx:  1.2, by:  0.5, bz:  0.0, scale: 3.2, opacity: 0.55, sx: 0.28, sy: 0.22, px: 0.0, py: 0.0 },
      { color: satColor,  bx: -0.6, by: -0.8, bz:  0.3, scale: 1.8, opacity: 0.40, sx: 0.35, sy: 0.30, px: 1.2, py: 0.8 },
      { color: satColor,  bx:  0.4, by:  1.1, bz: -0.3, scale: 1.4, opacity: 0.35, sx: 0.42, sy: 0.38, px: 2.4, py: 1.6 },
    ];

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

    const orbs = orbDefs.map(def => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeBlobTexture(def.color),
        transparent: true,
        opacity: def.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      sprite.position.set(def.bx, def.by, def.bz);
      sprite.scale.set(def.scale, def.scale, 1);
      sprite.userData = { bx: def.bx, by: def.by, sx: def.sx, sy: def.sy, px: def.px, py: def.py };
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
