import { Component, Input, afterNextRender, inject, DestroyRef, ElementRef } from '@angular/core';

type ShaderTheme = 'cuac' | 'natalia' | 'nathali';

interface ThemeColors {
  bg: [number, number, number];
  b1: [number, number, number];
  b2: [number, number, number];
  b3: [number, number, number];
}

const THEME_COLORS: Record<ShaderTheme, ThemeColors> = {
  cuac: {
    bg: [0.941, 0.945, 0.965],
    b1: [0.925, 0.220, 0.075],
    b2: [1.000, 0.510, 0.235],
    b3: [0.784, 0.157, 0.039],
  },
  natalia: {
    bg: [0.984, 0.973, 0.957],
    b1: [0.910, 0.478, 0.537],
    b2: [1.000, 0.706, 0.667],
    b3: [0.784, 0.314, 0.392],
  },
  nathali: {
    bg: [0.933, 0.945, 0.992],
    b1: [0.392, 0.706, 0.941],
    b2: [0.627, 0.820, 0.992],
    b3: [0.275, 0.431, 0.784],
  },
};

const VERT = /* glsl */`
  varying vec2 vUv;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.z += sin(pos.x * 2.2 + uTime * 0.60) * 0.018;
    pos.z += cos(pos.y * 1.9 + uTime * 0.45) * 0.015;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAG = /* glsl */`
  uniform float uTime;
  uniform vec2  uMouse;
  uniform vec3  uBgColor;
  uniform vec3  uBlob1Color;
  uniform vec3  uBlob2Color;
  uniform vec3  uBlob3Color;
  varying vec2  vUv;

  float gauss(vec2 uv, vec2 center, float r) {
    float d = distance(uv, center);
    return exp(-d * d / (2.0 * r * r));
  }

  void main() {
    vec2 uv = vUv;

    vec2 b1 = vec2(0.22, 0.58) + vec2(sin(uTime * 0.30) * 0.11, cos(uTime * 0.24) * 0.09);
    b1 = mix(b1, uMouse + vec2(-0.14, 0.08), 0.24);

    vec2 b2 = vec2(0.74, 0.36) + vec2(cos(uTime * 0.26) * 0.13, sin(uTime * 0.32) * 0.11);
    b2 = mix(b2, uMouse + vec2(0.10, -0.07), 0.18);

    vec2 b3 = vec2(0.50, 0.80) + vec2(sin(uTime * 0.18 + 1.4) * 0.15, cos(uTime * 0.21 + 0.7) * 0.12);
    b3 = mix(b3, uMouse + vec2(0.04, 0.14), 0.14);

    float g1 = gauss(uv, b1, 0.22);
    float g2 = gauss(uv, b2, 0.26);
    float g3 = gauss(uv, b3, 0.20);

    vec3 col = uBgColor;
    col = mix(col, mix(uBgColor, uBlob1Color, 0.40), g1 * 0.60);
    col = mix(col, mix(uBgColor, uBlob2Color, 0.35), g2 * 0.50);
    col = mix(col, mix(uBgColor, uBlob3Color, 0.38), g3 * 0.55);

    float vig = distance(uv, vec2(0.5, 0.5));
    col = mix(col, uBgColor * 0.97, vig * 0.30);

    gl_FragColor = vec4(col, 1.0);
  }
`;

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
    afterNextRender(() => { this.initShader(); });
  }

  private async initShader(): Promise<void> {
    const canvas   = this.el.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const host     = canvas.parentElement as HTMLElement;
    const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t        = THEME_COLORS[this.theme];

    const THREE = await import('three');

    const uniforms = {
      uTime:       { value: 0 },
      uMouse:      { value: new THREE.Vector2(0.5, 0.35) },
      uBgColor:    { value: new THREE.Vector3(...t.bg) },
      uBlob1Color: { value: new THREE.Vector3(...t.b1) },
      uBlob2Color: { value: new THREE.Vector3(...t.b2) },
      uBlob3Color: { value: new THREE.Vector3(...t.b3) },
    };

    const geo      = new THREE.PlaneGeometry(2, 2, 32, 32);
    const mat      = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG });
    const mesh     = new THREE.Mesh(geo, mat);
    const scene    = new THREE.Scene();
    scene.add(mesh);

    const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);

    const targetMouse  = new THREE.Vector2(0.5, 0.35);
    const currentMouse = new THREE.Vector2(0.5, 0.35);
    const REST         = new THREE.Vector2(0.5, 0.35);
    const LERP         = 0.045;

    const onMove = (e: MouseEvent) => {
      if (noMotion) return;
      const rect = host.getBoundingClientRect();
      targetMouse.set(
        (e.clientX - rect.left) / rect.width,
        1 - (e.clientY - rect.top) / rect.height,
      );
    };
    const onLeave = () => { if (!noMotion) targetMouse.copy(REST); };

    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w && h) renderer.setSize(w, h, false);
      }, 100);
    });
    ro.observe(host);

    const clock = new THREE.Clock();
    let rafId: number;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!noMotion) {
        uniforms.uTime.value = clock.getElapsedTime();
        currentMouse.lerp(targetMouse, LERP);
        uniforms.uMouse.value.copy(currentMouse);
      }
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(tick);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      clearTimeout(resizeTimer);
      host.removeEventListener('mousemove', onMove);
      host.removeEventListener('mouseleave', onLeave);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    });
  }
}
