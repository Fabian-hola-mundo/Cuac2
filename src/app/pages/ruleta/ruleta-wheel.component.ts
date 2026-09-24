import {
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RuletaConfig, RuletaOpcion } from '../../core/services/ruleta.service';

/** Geometría del dibujo. Todo el SVG vive en un viewBox de 420×420. */
const CX = 210;
const CY = 210;
const R_PORCION = 180;   // radio de las porciones de color
const R_LUCES   = 190;   // circunferencia donde se reparten las bombillas
const R_ARO     = 190;   // aro exterior
const R_HUB     = 47;    // tapa central
/** Espacio radial útil para el texto: del borde de la porción a la tapa. */
const HUECO     = (R_PORCION - 22) - (R_HUB + 10);

function recortar(texto: string, maxCaracteres: number): string {
  if (maxCaracteres < 4) return texto.slice(0, 3);
  return texto.length > maxCaracteres
    ? texto.slice(0, maxCaracteres - 1).trimEnd() + '…'
    : texto;
}

export interface Porcion {
  id: string;
  opcion: RuletaOpcion;
  path: string;
  etiqueta: string;
  descripcion: string | null;
  color: string;
  colorTexto: string;
  inicio: number;
  fin: number;
  medio: number;
  angulo: number;
  transform: string;
  fuente: number;
  fuenteDesc: number;
  mostrarDesc: boolean;
  probabilidad: number;
  remacheX: number;
  remacheY: number;
}

let contadorInstancias = 0;

@Component({
  selector: 'app-ruleta-wheel',
  standalone: true,
  templateUrl: './ruleta-wheel.component.html',
  styleUrl: './ruleta-wheel.component.scss',
})
export class RuletaWheelComponent implements OnDestroy {
  // ── Entradas ───────────────────────────────────────────────────────────────
  config   = input.required<RuletaConfig>();
  opciones = input.required<RuletaOpcion[]>();
  /** En la vista previa del admin se puede desactivar el botón de girar. */
  interactivo = input(true);

  // ── Salidas ────────────────────────────────────────────────────────────────
  readonly resultado    = output<RuletaOpcion>();
  readonly empiezaGiro  = output<void>();

  // ── Estado ─────────────────────────────────────────────────────────────────
  readonly girando  = signal(false);
  readonly ganadora = signal<RuletaOpcion | null>(null);

  private readonly rueda     = viewChild<ElementRef<SVGGElement>>('rueda');
  private readonly puntero   = viewChild<ElementRef<SVGGElement>>('puntero');
  private readonly lienzo    = viewChild<ElementRef<HTMLCanvasElement>>('lienzo');
  private readonly escenario = viewChild<ElementRef<HTMLDivElement>>('escenario');

  /** El lienzo solo existe en pantalla mientras hay confeti volando. */
  readonly confetiActivo = signal(false);

  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  /** Ángulo actual, acumulado entre giros para que nunca retroceda. */
  private rotacion = 0;
  private frameId  = 0;
  private confetiId = 0;
  private audio: AudioContext | null = null;
  /** Opciones ya premiadas cuando el admin no permite repetir. */
  private yaSalieron = new Set<string>();

  /** Sufijo único: dos ruletas en la misma página no pueden compartir los ids del <defs>. */
  readonly uid = `rw${++contadorInstancias}`;

  constructor() {
    // Si el admin cambia las opciones en vivo, el sorteo anterior deja de tener
    // sentido: se vuelve a la posición de reposo en lugar de dejar el puntero
    // señalando una porción que ya no existe.
    effect(() => {
      this.opciones();
      // `untracked` es imprescindible: sin él, el propio reinicio escribe en
      // `girando` y el efecto se volvería a disparar al terminar cada giro,
      // borrando el resultado recién sorteado.
      untracked(() => {
        if (!this.girando()) this.reiniciar();
      });
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
    cancelAnimationFrame(this.confetiId);
    void this.audio?.close();
    // El lienzo se movió al <body>, así que Angular ya no lo arrastra al
    // destruir la vista: hay que quitarlo a mano o se queda ahí colgado.
    this.lienzo()?.nativeElement.remove();
  }

  // ── Geometría ──────────────────────────────────────────────────────────────

  readonly activas = computed(() =>
    this.opciones()
      .filter(o => o.activa)
      .sort((a, b) => a.sort_order - b.sort_order),
  );

  readonly pesoTotal = computed(() =>
    this.activas().reduce((t, o) => t + Math.max(1, o.peso), 0),
  );

  readonly porciones = computed<Porcion[]>(() => {
    const opciones = this.activas();
    const total    = this.pesoTotal();
    if (opciones.length === 0 || total === 0) return [];

    const mostrarDescGlobal = this.config().mostrar_descripcion;
    let cursor = 0;

    return opciones.map(o => {
      const peso   = Math.max(1, o.peso);
      const angulo = (360 * peso) / total;
      const inicio = cursor;
      const fin    = cursor + angulo;
      const medio  = inicio + angulo / 2;
      cursor = fin;

      // El texto va en radio, así que lo que lo limita no es el ancho de la
      // porción sino el hueco entre el borde y la tapa central: si no se
      // encoge (y en el peor caso se recorta), las etiquetas largas se meten
      // por debajo del botón de girar.
      const etiquetaCruda = o.etiqueta?.trim() || 'Sin nombre';
      const fuente = Math.max(8, Math.min(17, HUECO / (etiquetaCruda.length * 0.58)));
      const etiqueta = recortar(etiquetaCruda, Math.floor(HUECO / (fuente * 0.58)));

      const descCruda  = o.descripcion?.trim() ?? '';
      const fuenteDesc = Math.max(7.5, fuente * 0.62);
      const descripcion = descCruda
        ? recortar(descCruda, Math.floor(HUECO / (fuenteDesc * 0.52)))
        : null;

      const [remacheX, remacheY] = this.punto(inicio, R_PORCION - 9);

      return {
        id: o.id,
        opcion: o,
        path: this.pathPorcion(inicio, fin),
        etiqueta,
        descripcion,
        color: o.color,
        colorTexto: o.color_texto,
        inicio, fin, medio, angulo,
        // rotate(medio) alinea el eje de la porción con las 12; rotate(-90)
        // tumba el texto para que se lea del centro hacia afuera.
        transform: `rotate(${medio.toFixed(3)} ${CX} ${CY}) translate(${CX} ${CY}) rotate(-90)`,
        fuente,
        fuenteDesc,
        mostrarDesc: mostrarDescGlobal && !!descripcion && angulo >= 26,
        probabilidad: (peso / total) * 100,
        remacheX, remacheY,
      };
    });
  });

  readonly luces = computed(() => {
    if (!this.config().mostrar_luces) return [];
    const n = 24;
    return Array.from({ length: n }, (_, i) => {
      const a = (360 / n) * i;
      const [x, y] = this.punto(a, R_LUCES);
      return { x, y, i };
    });
  });

  readonly hayOpciones = computed(() => this.porciones().length > 0);

  // Constantes que el template necesita para dibujar.
  readonly CX = CX;
  readonly CY = CY;
  readonly R_PORCION = R_PORCION;
  readonly R_ARO = R_ARO;
  readonly R_HUB = R_HUB;
  readonly R_ETIQUETA = R_PORCION - 22;

  private punto(anguloGrados: number, radio: number): [number, number] {
    const a = (anguloGrados * Math.PI) / 180;
    return [CX + radio * Math.sin(a), CY - radio * Math.cos(a)];
  }

  private pathPorcion(inicio: number, fin: number): string {
    const angulo = fin - inicio;
    // Una sola opción ocupa la rueda entera y el arco degenera en un punto:
    // hay que cerrarlo con dos semicírculos o no se dibuja nada.
    if (angulo >= 359.99) {
      return `M ${CX} ${CY - R_PORCION} A ${R_PORCION} ${R_PORCION} 0 1 1 ${CX} ${CY + R_PORCION} A ${R_PORCION} ${R_PORCION} 0 1 1 ${CX} ${CY - R_PORCION} Z`;
    }
    const [x1, y1] = this.punto(inicio, R_PORCION);
    const [x2, y2] = this.punto(fin, R_PORCION);
    const grande   = angulo > 180 ? 1 : 0;
    return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R_PORCION} ${R_PORCION} 0 ${grande} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
  }

  // ── Giro ───────────────────────────────────────────────────────────────────

  girar(): void {
    if (this.girando() || !this.hayOpciones() || !this.interactivo()) return;

    const cfg      = this.config();
    const elegida  = this.sortear();
    const porcion  = this.porciones().find(p => p.id === elegida.id)!;

    this.ganadora.set(null);
    this.girando.set(true);
    this.empiezaGiro.emit();

    // Con «reducir movimiento» activado la ruleta sigue girando: es el gesto
    // que da sentido a la página. Lo que se recorta es lo agresivo — una sola
    // vuelta, más corta y con una curva suave — en vez de saltar al resultado,
    // que dejaba la pantalla como si el botón no hiciera nada.
    const suave = this.reduceMovimiento();

    // El puntero está fijo en las 12, así que hay que llevar el centro de la
    // porción hasta ahí: girar 360 − medio. El jitter evita que el premio caiga
    // siempre exactamente en la mitad y delate la mecánica.
    const jitter  = (Math.random() - 0.5) * porcion.angulo * 0.7;
    const vueltas = suave
      ? 1
      : cfg.vueltas_min + Math.random() * Math.max(0, cfg.vueltas_max - cfg.vueltas_min);
    const destinoBase = 360 - porcion.medio + jitter;
    const actual  = ((this.rotacion % 360) + 360) % 360;
    const delta   = Math.round(vueltas) * 360 + ((destinoBase - actual + 360) % 360);
    const desde   = this.rotacion;
    const hasta   = this.rotacion + delta;

    // En el servidor no hay nada que animar: se deja la rueda en su sitio.
    if (!this.esNavegador) {
      this.aplicarRotacion(hasta);
      this.rotacion = hasta;
      this.terminar(elegida);
      return;
    }

    const duracion = suave
      ? Math.min(2400, Math.max(500, cfg.duracion_ms))
      : Math.max(500, cfg.duracion_ms);
    const inicio   = performance.now();
    let ultimaPorcion = -1;

    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      // easeOutQuint: arranque seco y una cola larga que se apaga sola.
      // En modo suave, una cúbica: entra y frena sin tirón.
      const e = suave ? 1 - Math.pow(1 - t, 3) : 1 - Math.pow(1 - t, 5);
      const rot = desde + delta * e;
      this.aplicarRotacion(rot);

      const idx = this.porcionBajoPuntero(rot);
      if (idx !== ultimaPorcion) {
        if (ultimaPorcion !== -1) {
          this.chasquido(t);
          this.golpearPuntero();
        }
        ultimaPorcion = idx;
      }

      if (t < 1) {
        this.frameId = requestAnimationFrame(paso);
      } else {
        this.rotacion = hasta;
        this.terminar(elegida);
      }
    };

    this.frameId = requestAnimationFrame(paso);
  }

  reiniciar(): void {
    cancelAnimationFrame(this.frameId);
    this.girando.set(false);
    this.ganadora.set(null);
    this.rotacion = 0;
    this.aplicarRotacion(0);
  }

  private terminar(opcion: RuletaOpcion): void {
    this.girando.set(false);
    this.ganadora.set(opcion);
    if (!this.config().permitir_repetir) this.yaSalieron.add(opcion.id);
    this.fanfarria();
    if (this.config().confeti) this.lanzarConfeti();
    this.resultado.emit(opcion);
  }

  /** Sorteo ponderado por `peso`, que es también el tamaño de la porción. */
  private sortear(): RuletaOpcion {
    const todas = this.activas();
    let pool = todas;

    if (!this.config().permitir_repetir) {
      const pendientes = todas.filter(o => !this.yaSalieron.has(o.id));
      // Cuando ya salieron todas se vuelve a empezar: es preferible a dejar la
      // ruleta bloqueada sin premio posible.
      if (pendientes.length === 0) {
        this.yaSalieron.clear();
      } else {
        pool = pendientes;
      }
    }

    const total = pool.reduce((t, o) => t + Math.max(1, o.peso), 0);
    let r = this.aleatorio() * total;
    for (const o of pool) {
      r -= Math.max(1, o.peso);
      if (r <= 0) return o;
    }
    return pool[pool.length - 1];
  }

  /** Aleatorio criptográfico cuando el navegador lo ofrece. */
  private aleatorio(): number {
    if (this.esNavegador && typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] / 4294967296;
    }
    return Math.random();
  }

  private porcionBajoPuntero(rotacion: number): number {
    // El puntero mira a las 12; con la rueda girada `rotacion`, ahí queda el
    // ángulo local (360 − rotacion).
    const local = ((360 - (rotacion % 360)) % 360 + 360) % 360;
    const ps = this.porciones();
    for (let i = 0; i < ps.length; i++) {
      if (local >= ps[i].inicio && local < ps[i].fin) return i;
    }
    return ps.length - 1;
  }

  private aplicarRotacion(grados: number): void {
    const el = this.rueda()?.nativeElement;
    if (el) el.style.transform = `rotate(${grados}deg)`;
  }

  private golpearPuntero(): void {
    const el = this.puntero()?.nativeElement;
    if (!el) return;
    el.classList.remove('is-hit');
    // Reiniciar la animación necesita un reflow entre quitar y poner la clase.
    void el.getBoundingClientRect();
    el.classList.add('is-hit');
  }

  private reduceMovimiento(): boolean {
    return this.esNavegador && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ── Sonido ─────────────────────────────────────────────────────────────────

  private ctx(): AudioContext | null {
    if (!this.esNavegador || !this.config().sonido) return null;
    if (!this.audio) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.audio = new Ctor();
    }
    if (this.audio.state === 'suspended') void this.audio.resume();
    return this.audio;
  }

  /** Clic de la lengüeta contra la porción; se va apagando con el giro. */
  private chasquido(t: number): void {
    const ctx = this.ctx();
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1100 - 300 * t, ctx.currentTime);
    gain.gain.setValueAtTime(0.10 * (1 - t * 0.5), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  private fanfarria(): void {
    const ctx = this.ctx();
    if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0   = ctx.currentTime + i * 0.09;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.36);
    });
  }

  // ── Confeti ────────────────────────────────────────────────────────────────

  private lanzarConfeti(): void {
    if (!this.esNavegador) return;
    const canvas = this.lienzo()?.nativeElement;
    if (!canvas) return;

    // El lienzo se cuelga del <body>. Dentro de la página queda atrapado en el
    // contexto de apilamiento de <main>, y entonces la barra superior y el
    // fondo del modal se le ponen encima: el confeti tiene que estar sobre
    // todo o no está «a pantalla completa».
    if (canvas.parentElement !== document.body) document.body.appendChild(canvas);

    // Fuera de los giros el lienzo está en display:none para no dejar una capa
    // fija del tamaño de la pantalla compuesta todo el rato.
    this.confetiActivo.set(true);

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) { this.confetiActivo.set(false); return; }

    // Con «reducir movimiento» el confeti no desaparece, se calma: menos
    // trozos, más lentos y sin voltereta. Quitarlo del todo dejaba el premio
    // sin ninguna celebración.
    const suave = this.reduceMovimiento();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    // El estallido sale del centro de la rueda, no del centro de la pantalla:
    // tiene que parecer que lo lanza la ruleta.
    const caja = this.escenario()?.nativeElement.getBoundingClientRect();
    const ox = caja ? caja.left + caja.width / 2 : w / 2;
    const oy = caja ? caja.top + caja.height / 2 : h / 2;

    const cfg = this.config();
    const paleta = this.porciones().map(p => p.color).concat(cfg.color_acento, cfg.color_aro);
    const color = () => paleta[Math.floor(Math.random() * paleta.length)];

    interface Trozo {
      x: number; y: number; vx: number; vy: number;
      g: number; vyMax: number;
      rot: number; vrot: number; aleteo: number; vAleteo: number;
      ancho: number; alto: number; color: string;
    }

    const trozos: Trozo[] = [];

    // 1 · Estallido desde la rueda, con fuerza para llegar a los bordes.
    const nEstallido = suave ? 50 : 160;
    for (let i = 0; i < nEstallido; i++) {
      const ang = Math.random() * Math.PI * 2;
      const vel = (suave ? 3 : 5) + Math.random() * (suave ? 6 : 14);
      trozos.push({
        x: ox, y: oy,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel - (suave ? 2 : 5),
        g: suave ? 0.16 : 0.34,
        vyMax: Infinity,
        rot: Math.random() * Math.PI,
        vrot: suave ? 0 : (Math.random() - 0.5) * 0.42,
        aleteo: Math.random() * Math.PI,
        vAleteo: suave ? 0.04 : 0.14 + Math.random() * 0.12,
        ancho: 5 + Math.random() * 7,
        alto: 9 + Math.random() * 11,
        color: color(),
      });
    }

    // 2 · Lluvia por todo el ancho: es lo que hace que el confeti llene la
    // pantalla y no se quede en una bola alrededor de la ruleta.
    const nLluvia = suave ? 40 : 130;
    for (let i = 0; i < nLluvia; i++) {
      trozos.push({
        x: Math.random() * w,
        y: -20 - Math.random() * h * 1.1,
        vx: (Math.random() - 0.5) * (suave ? 0.8 : 2.2),
        vy: 1 + Math.random() * 2,
        g: 0.05,
        vyMax: suave ? 3.4 : 6.5,
        rot: Math.random() * Math.PI,
        vrot: suave ? 0 : (Math.random() - 0.5) * 0.3,
        aleteo: Math.random() * Math.PI,
        vAleteo: suave ? 0.03 : 0.1 + Math.random() * 0.1,
        ancho: 5 + Math.random() * 6,
        alto: 9 + Math.random() * 9,
        color: color(),
      });
    }

    const inicio   = performance.now();
    const DURACION = suave ? 3400 : 4200;
    let ultimo     = inicio;

    const paso = (ahora: number) => {
      const t = (ahora - inicio) / DURACION;
      ctx2d.clearRect(0, 0, w, h);

      if (t >= 1) {
        cancelAnimationFrame(this.confetiId);
        this.confetiActivo.set(false);
        return;
      }

      // Paso de integración medido en tiempo, no en fotogramas: el vuelo dura
      // lo mismo a 60 Hz que a 144 Hz, y si el navegador se salta fotogramas
      // (pestaña en segundo plano, equipo cargado) el confeti no se queda
      // amontonado en el centro mientras el reloj de la animación sigue. El
      // tope de 3 evita que, al volver de una pausa larga, todo dé un salto.
      const dt = Math.min(3, (ahora - ultimo) / 16.667);
      ultimo = ahora;

      ctx2d.globalAlpha = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;

      for (const c of trozos) {
        c.vy = Math.min(c.vy + c.g * dt, c.vyMax);
        c.vx *= Math.pow(0.985, dt);      // rozamiento del aire
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.vrot * dt;
        c.aleteo += c.vAleteo * dt;

        if (c.y > h + 40) continue;       // ya salió por abajo

        ctx2d.save();
        ctx2d.translate(c.x, c.y);
        ctx2d.rotate(c.rot);
        // El papel gira sobre su eje: aplastarlo en vertical lo simula.
        ctx2d.scale(1, Math.max(0.12, Math.abs(Math.cos(c.aleteo))));
        ctx2d.fillStyle = c.color;
        ctx2d.fillRect(-c.ancho / 2, -c.alto / 2, c.ancho, c.alto);
        ctx2d.restore();
      }

      this.confetiId = requestAnimationFrame(paso);
    };

    cancelAnimationFrame(this.confetiId);
    this.confetiId = requestAnimationFrame(paso);
  }
}
