import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-cursor-gradient',
  standalone: true,
  template: `<canvas #canvas class="cursor-gradient-canvas" aria-hidden="true"></canvas>`,
  styleUrl: './cursor-gradient.component.scss',
})
export class CursorGradientComponent {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (window.matchMedia('(pointer: coarse)').matches) return;
      this.ngZone.runOutsideAngular(() => this.init());
    });
  }

  private async init(): Promise<void> {
    const THREE = await import('three');

    const canvas = this.canvasRef.nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
    });
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uVelocity: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uActive: { value: 0 },
        uColorA: { value: new THREE.Color('#EC3813') },
        uColorB: { value: new THREE.Color('#FF8D75') },
        uColorC: { value: new THREE.Color('#C0E8FD') },
        uColorD: { value: new THREE.Color('#011E54') },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform vec2 uMouse;
        uniform float uVelocity;
        uniform vec2 uResolution;
        uniform float uActive;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        uniform vec3 uColorD;

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                              -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m; m = m*m;
          vec3 x  = 2.0 * fract(p * C.www) - 1.0;
          vec3 h  = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        void main() {
          float aspect = uResolution.x / uResolution.y;
          vec2 uv = vUv;
          vec2 p = vec2((uv.x - uMouse.x) * aspect, uv.y - uMouse.y);

          float n1 = snoise(p * 1.2 + uTime * 0.08);
          float n2 = snoise(p * 3.0 - uTime * 0.06);

          vec2 warp = vec2(n1, n2) * 0.06;
          p += warp;

          float d = length(p);

          // single soft falloff — wide and gradual, no hot core
          float orb  = smoothstep(0.70, 0.00, d);
          orb = pow(orb, 1.6);
          float halo = smoothstep(1.20, 0.10, d) * 0.18;
          float trail = smoothstep(0.85, 0.15, d) * clamp(uVelocity * 0.6, 0.0, 0.25);

          float mixN = clamp(n1 * 0.5 + 0.5, 0.0, 1.0);
          vec3 warm  = mix(uColorA, uColorB, mixN);
          vec3 cool  = mix(uColorD, uColorC, smoothstep(0.0, 0.8, d));
          vec3 col   = mix(warm, cool, smoothstep(0.25, 0.95, d));

          float intensity = (orb * 0.32 + halo + trail) * uActive;
          intensity = clamp(intensity, 0.0, 0.65);

          gl_FragColor = vec4(col * intensity, intensity);
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const target = { x: 0.5, y: 0.5 };
    const current = { x: 0.5, y: 0.5 };
    let velocity = 0;
    let hasMoved = false;
    let mouseInside = false;

    const onPointerMove = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = 1 - e.clientY / window.innerHeight;
      if (!hasMoved) {
        current.x = x;
        current.y = y;
        hasMoved = true;
      }
      target.x = x;
      target.y = y;
      mouseInside = true;
    };
    const onPointerLeave = () => { mouseInside = false; };
    const onPointerEnter = () => { mouseInside = true; };
    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      material.uniforms['uResolution'].value.set(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointerenter', onPointerEnter);
    window.addEventListener('resize', onResize);

    const startTime = performance.now();
    let rafId = 0;

    const tick = () => {
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      current.x += dx * 0.14;
      current.y += dy * 0.14;

      const v = Math.hypot(dx, dy);
      velocity += (v - velocity) * 0.18;

      const u = material.uniforms;
      const targetActive = mouseInside && hasMoved ? 1 : 0;
      u['uActive'].value += (targetActive - u['uActive'].value) * 0.06;
      u['uMouse'].value.set(current.x, current.y);
      u['uVelocity'].value = velocity;
      u['uTime'].value = (performance.now() - startTime) / 1000;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerenter', onPointerEnter);
      window.removeEventListener('resize', onResize);
      material.dispose();
      geometry.dispose();
      renderer.dispose();
    });
  }
}
