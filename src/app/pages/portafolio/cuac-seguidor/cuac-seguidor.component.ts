import { Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';

// Juego oculto del hero de /portafolio: Cuac persigue el mouse (o el dedo, o la
// inclinación del teléfono) y crece con cada clic o toque. El tamaño vive solo en memoria, así que recargar la página lo reinicia.
const SRC    = '/assets/cuac-pato.png';
const BASE_W = 64;    // ancho inicial del pato (px)
const GROW   = 1.22;  // factor por clic
const MAX_W  = 1200;  // tope para que no se vuelva infinito
// Punta del pico dentro de la ilustración (fracción del ancho/alto). Es el punto
// que persigue al cursor; también es el pivote del volteo, así no salta al girar.
const PICO_X = 0.26;
const PICO_Y = 0.32;
// Distancia que mantiene con el cursor: lo persigue sin alcanzarlo y, si el
// cursor se le acerca (o el pato crece), retrocede para conservarla.
const distancia = (w: number) => 70 + w * 0.3;
// Tras salir el mouse del hero, espera esto antes de volver a su sitio (ms)
const VUELTA_MS = 900;
// En táctil persigue el punto tocado durante este tiempo; después manda el giroscopio
const TOQUE_MS  = 1600;
// Grados de inclinación para llegar al borde del hero
const GIRO_MAX  = 22;

// Resortes (unidades por segundo): rigidez y amortiguación. Menos amortiguación
// que la crítica (2·√k) = rebote.
const SPRING_POS   = { k: 60,  d: 11 };  // persecución: suave, con algo de inercia
const SPRING_TAM   = { k: 170, d: 11 };  // crecimiento: rebota un poco al pasarse
const SPRING_GIRO  = { k: 260, d: 22 };  // volteo: pasa por 0 como si girara
const SPRING_ENTRA = { k: 140, d: 10 };  // entrada / salida (escala 0 ↔ 1)

type Resorte = { v: number; vel: number };

function paso(r: Resorte, meta: number, s: { k: number; d: number }, dt: number): void {
  r.vel += ((meta - r.v) * s.k - r.vel * s.d) * dt;
  r.v   += r.vel * dt;
}

// Cuac sintetizado con Web Audio (sin archivo): diente de sierra que sube y cae,
// filtrado por dos formantes nasales y con un temblor rápido de volumen que le da
// la aspereza de pato. `grave` (0–1) baja el tono: cuanto más grande, más grave.
let audio: AudioContext | null = null;

function cuac(grave: number): void {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  audio ??= new Ctx();
  const ctx = audio;
  if (ctx.state === 'suspended') void ctx.resume();

  const t0   = ctx.currentTime + 0.005;
  const dur  = 0.22 + grave * 0.12;
  const f0   = 330 - grave * 190;                  // ~330 Hz pequeño → ~140 Hz gigante
  const vary = 1 + (Math.random() - 0.5) * 0.08;   // que no suenen todos idénticos

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0 * 0.85 * vary, t0);
  osc.frequency.linearRampToValueAtTime(f0 * 1.12 * vary, t0 + dur * 0.25);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.62 * vary, t0 + dur);

  // Formantes: el primero da el "cua", el segundo lo vuelve nasal
  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass'; f1.Q.value = 5;
  f1.frequency.setValueAtTime(1050 - grave * 300, t0);
  f1.frequency.linearRampToValueAtTime(780 - grave * 250, t0 + dur);
  const f2 = ctx.createBiquadFilter();
  f2.type = 'bandpass'; f2.Q.value = 7;
  f2.frequency.value = 2300 - grave * 500;
  const g2 = ctx.createGain(); g2.gain.value = 0.45;

  // Aspereza: el volumen tiembla ~38 veces por segundo
  const raspa = ctx.createOscillator();
  raspa.frequency.value = 38;
  const raspaAmt = ctx.createGain(); raspaAmt.gain.value = 0.35;
  const trem = ctx.createGain(); trem.gain.value = 0.65;
  raspa.connect(raspaAmt).connect(trem.gain);

  // Envolvente: golpe rápido, cuerpo corto y cola que se apaga
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.32, t0 + 0.012);
  env.gain.setValueAtTime(0.32, t0 + dur * 0.45);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(f1).connect(trem);
  osc.connect(f2).connect(g2).connect(trem);
  trem.connect(env).connect(ctx.destination);

  osc.start(t0);   osc.stop(t0 + dur + 0.02);
  raspa.start(t0); raspa.stop(t0 + dur + 0.02);
}

@Component({
  selector: 'app-cuac-seguidor',
  standalone: true,
  template: `
    <div class="pato" aria-hidden="true">
      <div class="pato-cuerpo">
        <img src="/assets/cuac-pato.png" alt="" draggable="false" decoding="async" />
      </div>
    </div>
  `,
  styleUrl: './cuac-seguidor.component.scss',
})
export class CuacSeguidorComponent {
  private destroyRef = inject(DestroyRef);
  private el         = inject(ElementRef<HTMLElement>);
  private zone       = inject(NgZone);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.init()));
  }

  private init(): void {
    const root = this.el.nativeElement as HTMLElement;
    const hero = root.parentElement as HTMLElement | null;
    if (!hero) return;
    // Se buscan en cada cuadro: el HMR de desarrollo puede recrear el template
    // del componente después de init y dejar referencias a nodos viejos.
    const els = () => ({
      pato:   root.querySelector('.pato') as HTMLElement | null,
      cuerpo: root.querySelector('.pato-cuerpo') as HTMLElement | null,
      img:    root.querySelector('img') as HTMLImageElement | null,
    });

    const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Casa: lado derecho del hero. Ahí descansa al cargar y vuelve si el mouse se va.
    const casa = () => ({ x: hero.clientWidth * 0.72, y: hero.clientHeight * 0.42 });

    const x    = { v: 0, vel: 0 };        // punta del pico
    const y    = { v: 0, vel: 0 };
    const tam  = { v: BASE_W, vel: 0 };   // ancho
    const giro = { v: 1, vel: 0 };        // 1 = mira a la izquierda (como la ilustración)
    const vivo = { v: 0, vel: 0 };        // 0 = escondido, 1 = presente
    const meta = { x: 0, y: 0, tam: BASE_W, giro: 1, vivo: 0 };
    const mouse = { x: 0, y: 0 };

    let inside   = false;
    let clicks   = 0;
    let fase     = 0;     // ciclo del contoneo al caminar
    let respira  = 0;     // ciclo de la respiración en reposo
    let tilt     = 0;
    let raf      = 0;
    let last     = 0;
    let enCasa   = true;  // sin cursor: descansa en su sitio mirando al título
    let listo    = 0;     // momento en que la imagen quedó cargada
    let toqueHasta = 0;   // táctil: persigue el último toque hasta este momento
    let visible  = true;  // el hero está en pantalla (si no, no se anima)
    // Giroscopio: inclinación suavizada (grados) y la postura "neutra" del teléfono
    // (crudo del sensor + valores suavizados en el ciclo de animación)
    const giroscopio = { on: false, rx: 0, ry: 0, gx: 0, gy: 0, b0: null as number | null };
    let vuelta: ReturnType<typeof setTimeout> | undefined;

    const h0 = casa();
    x.v = h0.x; y.v = h0.y;

    const toLocal = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const conCursor = (e: PointerEvent) => e.pointerType !== 'touch';


    const onEnter = (e: PointerEvent) => {
      if (!conCursor(e)) return;
      clearTimeout(vuelta);
      const p = toLocal(e);
      mouse.x = p.x; mouse.y = p.y;
      inside = true;
      enCasa = false;
      loop();
    };

    const onMove = (e: PointerEvent) => {
      if (!conCursor(e)) return;
      if (!inside) { onEnter(e); return; }
      const p = toLocal(e);
      mouse.x = p.x; mouse.y = p.y;
    };

    // Salida: se queda un momento mirando por donde se fue el cursor y vuelve a casa
    const onLeave = () => {
      inside = false;
      clearTimeout(vuelta);
      vuelta = setTimeout(() => { enCasa = true; loop(); }, VUELTA_MS);
    };

    // Táctil: el pato va hacia donde tocaste (el clic que sigue lo hace crecer)
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      clearTimeout(vuelta);
      const p = toLocal(e);
      mouse.x = p.x; mouse.y = p.y;
      toqueHasta = performance.now() + TOQUE_MS;
      enCasa = false;
      loop();
    };

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      // Normaliza según la orientación de la pantalla (vertical u horizontal)
      const ang = screen.orientation?.angle ?? 0;
      let gx = e.gamma, gy = e.beta;
      if (ang === 90)       { gx = e.beta;  gy = -e.gamma; }
      else if (ang === 270) { gx = -e.beta; gy = e.gamma; }
      if (giroscopio.b0 === null) giroscopio.b0 = gy;
      giroscopio.rx = gx; giroscopio.ry = gy;
      giroscopio.on = true;
      loop();
    };

    // iOS pide permiso para el giroscopio y solo se puede pedir tras un toque
    type ConPermiso = { requestPermission?: () => Promise<'granted' | 'denied'> };
    const DOE = (window as unknown as { DeviceOrientationEvent?: ConPermiso }).DeviceOrientationEvent;
    let giroPedido = false;
    const pedirGiro = () => {
      if (giroPedido || typeof DOE?.requestPermission !== 'function') return;
      giroPedido = true;
      DOE.requestPermission()
        .then(r => { if (r === 'granted') window.addEventListener('deviceorientation', onOrient); })
        .catch(() => { /* sin permiso: sigue funcionando con toques */ });
    };
    if ('DeviceOrientationEvent' in window && typeof DOE?.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', onOrient);
    }

    const onClick = () => {
      pedirGiro();
      clicks++;
      meta.tam = Math.min(BASE_W * Math.pow(GROW, clicks), MAX_W);
      tam.vel += 260; // empujón extra para que el crecimiento se sienta
      try { cuac(Math.min(clicks / 15, 1)); } catch { /* sin audio: el juego sigue igual */ }
      const { img } = els();
      if (img && !noMotion) {
        img.classList.remove('pop');
        void img.offsetWidth; // reinicia la animación
        img.classList.add('pop');
      }
      loop();
    };

    const r3 = (n: number) => Math.round(n * 1000) / 1000;

    const render = (pato: HTMLElement, cuerpo: HTMLElement, speed: number, velX: number) => {
      const w = Math.max(tam.v, 1);
      pato.style.transform = `translate3d(${r3(x.v - PICO_X * w)}px, ${r3(y.v - PICO_Y * w)}px, 0)`;
      pato.style.width     = `${r3(w)}px`;

      // Contoneo al caminar, estiramiento según velocidad y respiración en reposo
      const andar   = noMotion ? 0 : Math.min(speed / 500, 1);
      const bamboleo = Math.sin(fase) * 7 * andar;
      const brinco   = -Math.abs(Math.sin(fase)) * 0.06 * w * andar;
      const estira   = noMotion ? 0 : Math.min(speed / 3000, 0.08);
      const aire     = noMotion ? 0 : Math.sin(respira) * 0.018 * (1 - andar);
      const esc      = Math.max(vivo.v, 0);

      tilt += ((noMotion ? 0 : Math.max(-16, Math.min(16, velX * 0.018))) - tilt) * 0.15;

      cuerpo.style.transform =
        `translateY(${r3(brinco)}px) rotate(${r3(tilt + bamboleo)}deg) ` +
        `scale(${r3(giro.v * (1 - estira / 2 - aire / 2) * esc)}, ${r3((1 + estira + aire) * esc)})`;
      pato.style.opacity = `${r3(Math.min(esc * 1.5, 1))}`;
    };

    const tick = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;

      if (!visible) { last = 0; return; } // hero fuera de pantalla: descansa

      const { pato, cuerpo, img } = els();
      if (!pato || !cuerpo || !img) { loop(); return; }
      if (!img.getAttribute('src')) img.src = SRC; // por si el HMR trae un template sin src

      // Entrada: aparece con un pequeño salto un momento después de cargar la imagen
      if (meta.vivo === 0 && img.complete && img.naturalWidth > 0) {
        if (!listo) listo = now;
        else if (now - listo > 350) meta.vivo = 1;
      }

      // Persigue un punto a cierta distancia del cursor, sobre la línea que los une.
      // Sin cursor, vuelve a su sitio y mira hacia el título.
      const gap  = distancia(tam.v);
      const vx   = mouse.x - x.v;
      const vy   = mouse.y - y.v;
      const dist = Math.hypot(vx, vy);
      const persigue = inside || now < toqueHasta;
      if (!persigue && giroscopio.on) {
        // Giroscopio: inclinar el teléfono lo lleva hacia ese lado del hero.
        // La postura neutra se ajusta despacio (~4 s), así funciona como se sostenga.
        const g = giroscopio, k = Math.min(1, dt * 10);
        g.b0 = (g.b0 ?? g.ry) + (g.ry - (g.b0 ?? g.ry)) * dt * 0.25;
        g.gx += (g.rx - g.gx) * k;
        g.gy += (g.ry - g.b0 - g.gy) * k;
        const W = hero.clientWidth, H = hero.clientHeight, w = tam.v;
        const lim = (n: number) => Math.max(-1, Math.min(1, n / GIRO_MAX));
        const gx = W * 0.5 + lim(giroscopio.gx) * W * 0.42;
        const gy = H * 0.5 + lim(giroscopio.gy) * H * 0.38;
        meta.x = Math.max(w * PICO_X, Math.min(W - w * (1 - PICO_X), gx));
        meta.y = Math.max(w * PICO_Y, Math.min(H - w * 0.5, gy));
        const dx = meta.x - x.v;
        if (dx < -12) meta.giro = 1;
        else if (dx > 12) meta.giro = -1;
      } else if (enCasa) {
        const c = casa();
        meta.x = c.x; meta.y = c.y;
        const dx = c.x - x.v;
        if (dx < -12) meta.giro = 1;        // camina a la izquierda
        else if (dx > 12) meta.giro = -1;   // camina a la derecha
        else meta.giro = 1;                 // ya llegó: mira al título
      } else {
        if (dist > 0.5) {
          meta.x = mouse.x - (vx / dist) * gap;
          meta.y = mouse.y - (vy / dist) * gap;
        }
        // Mira hacia el cursor, con margen para no parpadear cuando queda en línea
        if (vx < -12) meta.giro = 1;
        else if (vx > 12) meta.giro = -1;
      }

      if (noMotion) {
        x.v = meta.x; y.v = meta.y; tam.v = meta.tam; giro.v = meta.giro; vivo.v = meta.vivo;
        x.vel = y.vel = tam.vel = giro.vel = vivo.vel = 0;
      } else {
        paso(x, meta.x, SPRING_POS, dt);
        paso(y, meta.y, SPRING_POS, dt);
        paso(tam, meta.tam, SPRING_TAM, dt);
        paso(giro, meta.giro, SPRING_GIRO, dt);
        paso(vivo, meta.vivo, SPRING_ENTRA, dt);
      }

      const speed = Math.hypot(x.vel, y.vel);
      fase    += dt * Math.min(speed, 900) * 0.035;
      respira += dt * 2.4;
      render(pato, cuerpo, speed, x.vel);

      const quieto =
        speed < 2 && Math.abs(tam.v - meta.tam) < 0.3 && Math.abs(tam.vel) < 2 &&
        Math.abs(giro.v - meta.giro) < 0.01 && Math.abs(vivo.v - meta.vivo) < 0.01 &&
        Math.abs(tilt) < 0.1 && meta.vivo === 1 &&
        Math.abs(meta.x - x.v) < 0.5 && Math.abs(meta.y - y.v) < 0.5;
      // En reposo sigue respirando mientras el mouse esté en el hero; si no, se duerme
      if (!quieto || inside || (giroscopio.on && !persigue)) loop();
      else last = 0;
    };

    const loop = () => { if (!raf) raf = requestAnimationFrame(tick); };
    loop();

    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible) loop();
    });
    io.observe(hero);

    hero.addEventListener('pointerenter', onEnter, { passive: true });
    hero.addEventListener('pointermove',  onMove,  { passive: true });
    hero.addEventListener('pointerleave', onLeave, { passive: true });
    hero.addEventListener('pointerdown',  onDown,  { passive: true });
    hero.addEventListener('click',        onClick);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(raf);
      clearTimeout(vuelta);
      io.disconnect();
      window.removeEventListener('deviceorientation', onOrient);
      hero.removeEventListener('pointerdown',  onDown);
      hero.removeEventListener('pointerenter', onEnter);
      hero.removeEventListener('pointermove',  onMove);
      hero.removeEventListener('pointerleave', onLeave);
      hero.removeEventListener('click',        onClick);
    });
  }
}
