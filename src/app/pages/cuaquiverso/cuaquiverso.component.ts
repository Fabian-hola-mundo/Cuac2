import { Component, OnInit, afterNextRender, inject, DestroyRef, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { CartService } from './services/cart.service';
import { CartModalComponent } from './cart-modal/cart-modal.component';
import { InventarioService, ProductoEvento } from '../../core/services/inventario.service';
import { PersonajesService } from '../../core/services/personajes.service';

const CAT_SHORT: Record<string, string> = {
  tee:'Camiseta', tote:'Tote bag', libreta:'Libreta', sticker:'Sticker',
  pin:'Pin', gorra:'Gorra', peluche:'Peluche', print:'Print',
  llavero:'Llavero', pañoleta:'Pañoleta', amigurumi:'Amigurumi', charm:'Charm',
};

interface Character {
  key: string;
  name: string;
  color: string;
  wire: string;
}

@Component({
  selector: 'app-cuaquiverso',
  standalone: true,
  imports: [CartModalComponent, RouterLink],
  templateUrl: './cuaquiverso.component.html',
  styleUrl: './cuaquiverso.component.scss',
})
export class CuaquiversoComponent implements OnInit {
  newsletterSubmitted = false;

  readonly cart          = inject(CartService);
  readonly inv           = inject(InventarioService);
  readonly personajesSvc = inject(PersonajesService);
  readonly String        = String;
  private  destroyRef    = inject(DestroyRef);
  private  seo           = inject(SeoService);

  readonly showcaseProducts = computed(() => {
    const activos    = this.inv.productos().filter(p => p.activo);
    const destacados = activos.filter(p => p.destacado);
    return (destacados.length > 0 ? destacados : activos).slice(0, 5);
  });

  async ngOnInit(): Promise<void> {
    await this.personajesSvc.load();
    this.seo.set({
      title:       'Cuaquiverso — División de producto de Cuac',
      description: 'Personajes colombianos traducidos a objetos: camisetas, libretas, stickers y más.',
      canonical:   'https://cuacdesign.com/cuaquiverso',
    });
    this.inv.cargarTodos();
  }

  constructor() {
    afterNextRender(() => {
      this.initHeroScene();
    });
  }

  catLabel(cat: string): string {
    return CAT_SHORT[cat] ?? cat;
  }

  addToCart(event: Event, p: ProductoEvento): void {
    event.preventDefault();
    event.stopPropagation();
    this.cart.add({
      id:    p.id,
      name:  p.nombre,
      sub:   this.catLabel(p.categoria),
      price: p.precio,
      color: p.color ?? '#3D4856',
    });
  }

  onNewsletterSubmit(event: Event): void {
    event.preventDefault();
    this.newsletterSubmitted = true;
  }

  onStoreSearch(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    console.log('Search:', input.value);
  }

  private async initHeroScene(): Promise<void> {
    const container = document.getElementById('hero-scene');
    if (!container) return;

    const THREE = await import('three');
    const { gsap } = await import('gsap');

    const characters: Character[] = this.personajesSvc.activos().map(p => ({
      key:   p.key,
      name:  p.nombre + (p.personalidad ? ` · ${p.personalidad}` : ''),
      color: p.color  ?? '#2A6FDB',
      wire:  p.wire_color ?? '#5C95EA',
    }));
    if (characters.length === 0) return;

    const layout: [number, number, number][] = [
      [ 0.00,  1.55, -0.20],
      [ 1.65,  0.55, -0.40],
      [-1.55,  0.35,  0.40],
      [ 1.20, -1.25,  0.70],
      [-0.95, -1.30, -0.55],
      [ 0.50, -0.30,  1.55],
      [-0.40,  0.95, -1.40],
      [ 0.10, -1.95,  0.10],
    ];

    // ─── Three.js setup ──────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const aspect = () => container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(38, aspect(), 0.1, 100);
    camera.position.set(0, 0, 6.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const orbs: any[] = [];

    function makeBlobTexture(hex: string): any {
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const ctx = c.getContext('2d')!;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      ctx.filter = 'blur(16px)';
      const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      grad.addColorStop(0,   `rgba(${r},${g},${b},0.50)`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},0.18)`);
      grad.addColorStop(1,   `rgba(${r},${g},${b},0.00)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    characters.forEach((ch, i) => {
      const [x, y, z] = layout[i];
      const baseScale = 2.6 + (i % 3) * 0.22;
      const blob = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeBlobTexture(ch.color),
        transparent: true,
        opacity: 0.22,
        blending: THREE.NormalBlending,
        depthWrite: false,
      }));
      blob.position.set(x, y, z);
      blob.scale.set(baseScale, baseScale, 1);
      blob.userData = {
        ch,
        baseScale,
        baseX: x,
        baseY: y,
        speedX: 0.28 + Math.random() * 0.22,
        speedY: 0.22 + Math.random() * 0.22,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
      };
      group.add(blob);
      orbs.push(blob);
    });

    // ─── SVG neural network lines (all 28 pairs, dashed) ─────────────────────
    const svgEl = document.getElementById('neural-svg') as SVGSVGElement | null;
    const svgNS = 'http://www.w3.org/2000/svg';
    const lineEls: SVGLineElement[] = [];
    const linePairs: [number, number][] = [];

    if (svgEl) {
      for (let i = 0; i < orbs.length; i++) {
        for (let j = i + 1; j < orbs.length; j++) {
          const line = document.createElementNS(svgNS, 'line') as SVGLineElement;
          line.style.stroke = '#151F28';
          line.style.strokeWidth = '0.75';
          line.style.opacity = '0.04';
          line.style.strokeDasharray = '3 6';
          line.style.transition = 'opacity 0.35s ease-out';
          svgEl.appendChild(line);
          lineEls.push(line);
          linePairs.push([i, j]);
        }
      }
    }

    // ─── Raycaster ────────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(999, 999);
    let hovered: any | null = null;

    const getBlobAt = (event: PointerEvent | MouseEvent): any | null => {
      const rect = container.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(orbs, false);
      return hits.length ? hits[0].object : null;
    };

    // ─── Network show/hide ────────────────────────────────────────────────────
    const showNetwork = (activeIdx: number) => {
      linePairs.forEach(([i, j], idx) => {
        lineEls[idx].style.opacity = (i === activeIdx || j === activeIdx) ? '0.40' : '0.02';
      });
    };

    const hideNetwork = () => {
      lineEls.forEach(l => { l.style.opacity = '0.04'; });
    };

    // ─── Pointer handlers ─────────────────────────────────────────────────────
    const onPointerMove = (e: PointerEvent) => {
      const blob = getBlobAt(e);
      if (blob === hovered) return;

      if (hovered) {
        const bs = hovered.userData.baseScale;
        gsap.to(hovered.scale, { x: bs, y: bs, z: 1, duration: 0.4, ease: 'power3.out' });
        gsap.to(hovered.material, { opacity: 0.36, duration: 0.4 });
      }

      hovered = blob;

      if (hovered) {
        const bs = hovered.userData.baseScale;
        gsap.to(hovered.scale, { x: bs * 1.45, y: bs * 1.45, z: 1, duration: 0.5, ease: 'power2.out' });
        gsap.to(hovered.material, { opacity: 0.48, duration: 0.4 });
        container.style.cursor = 'pointer';
        showNetwork(orbs.indexOf(hovered));
      } else {
        container.style.cursor = '';
        hideNetwork();
      }
    };

    const onPointerLeave = () => {
      if (hovered) {
        const bs = hovered.userData.baseScale;
        gsap.to(hovered.scale, { x: bs, y: bs, z: 1, duration: 0.4, ease: 'power3.out' });
        gsap.to(hovered.material, { opacity: 0.36, duration: 0.4 });
        hovered = null;
      }
      container.style.cursor = '';
      hideNetwork();
    };

    const onClick = (e: MouseEvent) => {
      const orb = getBlobAt(e);
      if (!orb) return;
      const bs = orb.userData.baseScale;
      gsap.to(orb.scale, {
        x: bs * 1.55, y: bs * 1.55, z: 1,
        duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.inOut',
        onComplete: () => { window.location.href = `/cuaquiverso/personaje/${orb.userData.ch.key}`; },
      });
    };

    container.addEventListener('pointermove', onPointerMove as EventListener);
    container.addEventListener('pointerleave', onPointerLeave);
    container.addEventListener('click', onClick);

    // ─── Intro ────────────────────────────────────────────────────────────────
    orbs.forEach(b => b.scale.set(0, 0, 1));
    gsap.to(orbs.map(b => b.scale), {
      x: (i: number) => orbs[i].userData.baseScale,
      y: (i: number) => orbs[i].userData.baseScale,
      duration: 1.1, ease: 'back.out(1.6)', stagger: 0.06, delay: 0.2,
    });

    // ─── Render loop with 2D projection ──────────────────────────────────────
    const clock = new THREE.Clock();
    let animFrameId: number;
    const tmp = new THREE.Vector3();
    const projections: { x: number; y: number }[] = orbs.map(() => ({ x: 0, y: 0 }));

    const projectBlob = (blob: any): { x: number; y: number } => {
      blob.getWorldPosition(tmp);
      tmp.project(camera);
      return {
        x: (tmp.x + 1) / 2 * container.clientWidth,
        y: (-tmp.y + 1) / 2 * container.clientHeight,
      };
    };

    const tick = () => {
      const t = clock.getElapsedTime();
      group.rotation.y = t * 0.005;

      orbs.forEach((b) => {
        const s = b.userData;
        b.position.x = s.baseX + Math.sin(t * s.speedX + s.phaseX) * 0.18;
        b.position.y = s.baseY + Math.sin(t * s.speedY + s.phaseY) * 0.18;
      });

      // Update world matrices so getWorldPosition is accurate this frame
      scene.updateMatrixWorld(true);

      // Project blobs → update SVG line endpoints
      orbs.forEach((blob, i) => {
        projections[i] = projectBlob(blob);
      });

      // Update SVG line endpoints
      linePairs.forEach(([i, j], idx) => {
        const pi = projections[i];
        const pj = projections[j];
        if (lineEls[idx]) {
          lineEls[idx].setAttribute('x1', pi.x.toFixed(1));
          lineEls[idx].setAttribute('y1', pi.y.toFixed(1));
          lineEls[idx].setAttribute('x2', pj.x.toFixed(1));
          lineEls[idx].setAttribute('y2', pj.y.toFixed(1));
        }
      });

      renderer.render(scene, camera);
      animFrameId = requestAnimationFrame(tick);
    };
    animFrameId = requestAnimationFrame(tick);

    // ─── Resize ───────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = aspect();
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // ─── Cleanup ──────────────────────────────────────────────────────────────
    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(animFrameId);
      orbs.forEach(b => { b.material.map?.dispose(); b.material.dispose(); });
      renderer.dispose();
      container.removeEventListener('pointermove', onPointerMove as EventListener);
      container.removeEventListener('pointerleave', onPointerLeave);
      container.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
    });
  }
}
