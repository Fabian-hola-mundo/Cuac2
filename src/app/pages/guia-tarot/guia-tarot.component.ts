import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Location, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FooterComponent } from '../../layout/footer/footer.component';
import { SeoService } from '../../core/services/seo.service';
import { ARCANOS, Arcano, ELEMENTOS, Elemento, TIRADAS } from './tarot.data';

@Component({
  selector: 'app-guia-tarot',
  standalone: true,
  imports: [RouterLink, FooterComponent],
  templateUrl: './guia-tarot.component.html',
  styleUrl: './guia-tarot.component.scss',
})
export class GuiaTarotComponent implements OnInit, OnDestroy {
  private seo    = inject(SeoService);
  private route  = inject(ActivatedRoute);
  private location = inject(Location);
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  private modalEl = viewChild<ElementRef<HTMLDivElement>>('modal');
  private modalTxt = viewChild<ElementRef<HTMLDivElement>>('modalTxt');

  readonly arcanos   = ARCANOS;
  readonly elementos = ELEMENTOS;
  readonly tiradas   = TIRADAS;

  /** Los triángulos alquímicos de cada elemento, en un viewBox de 24. */
  readonly iconos: Record<Elemento, string> = {
    fuego:  'M12 3.5 21 19.5H3Z',
    agua:   'M3 4.5h18L12 20.5Z',
    aire:   'M12 3.5 21 19.5H3ZM6.8 13h10.4',
    tierra: 'M3 4.5h18L12 20.5ZM6.8 11h10.4',
  };

  /** Secciones de la landing para el menú hamburguesa. */
  readonly secciones = [
    { id: 'inicio',    nombre: 'Inicio' },
    { id: 'como-leer', nombre: 'Cómo hacer una lectura' },
    { id: 'elementos', nombre: 'Los cuatro elementos' },
    { id: 'tiradas',   nombre: 'Tiradas' },
    { id: 'sacar',     nombre: 'Tu carta del día' },
    { id: 'arcanos',   nombre: 'Los 22 arcanos' },
    { id: 'recuerda',  nombre: 'Recuerda' },
  ];
  readonly menu = signal(false);
  /** Botón flotante: en táctil se abre con un toque; con ratón, al pasar. */
  readonly enlaces = signal(false);
  /** Se enciende al dejar atrás la portada: muestra la flecha para volver. */
  readonly pasoHero = signal(false);

  constructor() {
    afterNextRender(() => {
      // Barras de scroll de la guía: la del documento vive fuera del componente.
      document.documentElement.classList.add('gt-scroll');

      this.alScroll();
    });
  }

  @HostListener('window:scroll')
  alScroll(): void {
    const hero = document.getElementById('inicio');
    if (!hero) return;
    // Pasada la portada = su borde inferior ya quedó por encima de la mitad de la pantalla.
    this.pasoHero.set(hero.getBoundingClientRect().bottom < window.innerHeight / 2);
  }

  readonly filtro = signal<Elemento | null>(null);
  readonly visibles = computed(() => {
    const f = this.filtro();
    return f ? this.arcanos.filter(a => a.elemento === f) : this.arcanos;
  });

  /** Carta abierta en el detalle, por su posición en ARCANOS. */
  readonly abierta = signal<number | null>(null);
  readonly carta = computed(() => {
    const i = this.abierta();
    return i === null ? null : this.arcanos[i];
  });

  /** «Saca una carta»: null mientras se ve el reverso. */
  readonly sacada    = signal<Arcano | null>(null);
  readonly girando   = signal(false);
  /** Mientras se baraja, los nombres pasan rápido para que se note el azar. */
  readonly barajando = signal(false);
  readonly fugaz     = signal<string>('');
  private temporizadores: ReturnType<typeof setTimeout>[] = [];

  private focoPrevio: HTMLElement | null = null;

  ngOnInit(): void {
    this.seo.set({
      title:       'Guía del tarot · Arcanos mayores',
      description: 'Aprende a leer los 22 arcanos mayores: significado general de cada carta y su lectura en fuego, agua, aire y tierra.',
      canonical:   'https://cuacdesign.com/Gu%C3%ADaTarot',
    });

    // Enlace directo a una carta: /GuíaTarot?carta=la-luna
    const slug = this.route.snapshot.queryParamMap.get('carta');
    const i = slug ? this.arcanos.findIndex(a => a.slug === slug) : -1;
    if (i >= 0) this.abrir(i);
  }

  ngOnDestroy(): void {
    if (this.esNavegador) document.documentElement.classList.remove('gt-scroll');
    this.soltarScroll();
    this.temporizadores.forEach(t => clearTimeout(t));
  }

  elemento(id: Elemento) {
    return this.elementos.find(e => e.id === id)!;
  }

  indice(a: Arcano): number {
    return this.arcanos.indexOf(a);
  }

  img(a: Arcano, pequena = false): string {
    return pequena ? `/tarot/sm/${a.slug}.jpg` : `/tarot/${a.slug}.jpg`;
  }

  // ── Detalle ───────────────────────────────────────────────────────────────

  abrir(i: number): void {
    if (this.abierta() === null && this.esNavegador) {
      this.focoPrevio = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';
    }
    this.abierta.set(i);
    this.sincronizarUrl(this.arcanos[i].slug);
    // El diálogo aún no existe en el DOM en este tick.
    if (this.esNavegador) setTimeout(() => {
      const el = this.modalEl()?.nativeElement;
      el?.focus({ preventScroll: true });
      // En escritorio solo se desplaza la columna del texto; en móvil, el diálogo.
      el?.scrollTo({ top: 0 });
      this.modalTxt()?.nativeElement.scrollTo({ top: 0 });
    });
  }

  cerrar(): void {
    if (this.abierta() === null) return;
    this.abierta.set(null);
    this.soltarScroll();
    this.sincronizarUrl(null);
    this.focoPrevio?.focus?.({ preventScroll: true });
    this.focoPrevio = null;
  }

  mover(paso: number): void {
    const i = this.abierta();
    if (i === null) return;
    const n = this.arcanos.length;
    this.abrir((i + paso + n) % n);
  }

  @HostListener('document:keydown', ['$event'])
  alTeclado(e: KeyboardEvent): void {
    if (e.key === 'Escape' && (this.menu() || this.enlaces())) {
      this.menu.set(false);
      this.enlaces.set(false);
      return;
    }
    if (this.abierta() === null) return;
    if (e.key === 'Escape') this.cerrar();
    else if (e.key === 'ArrowRight') this.mover(1);
    else if (e.key === 'ArrowLeft') this.mover(-1);
  }

  /** En táctil no hay mouseleave: el botón flotante se cierra al tocar fuera. */
  @HostListener('document:click', ['$event'])
  alClicFuera(e: MouseEvent): void {
    if (this.enlaces() && !(e.target as Element | null)?.closest?.('.gt-fab')) this.enlaces.set(false);
  }

  /** Respaldo del CSS: sin menú contextual ni arrastre sobre las ilustraciones. */
  @HostListener('contextmenu', ['$event'])
  @HostListener('dragstart', ['$event'])
  protegerImagenes(e: Event): void {
    const t = e.target as Element | null;
    if (t?.closest?.('img, .gt-carta, .gt-modal-img, .gt-sacar-carta, .gt-abanico')) e.preventDefault();
  }

  // ── Saca una carta ────────────────────────────────────────────────────────

  sacar(): void {
    if (this.girando()) return;
    const anterior = this.sacada();
    let nueva: Arcano;
    do {
      nueva = this.arcanos[Math.floor(Math.random() * this.arcanos.length)];
    } while (nueva === anterior);

    // Los tiempos se mantienen aunque el sistema pida reducir el movimiento:
    // la ruleta de nombres es solo texto, y sin ella no se nota que la carta
    // sale al azar. Lo que se desplaza en pantalla lo apaga el CSS.
    const esperar = (ms: number, fn: () => void) =>
      this.temporizadores.push(setTimeout(fn, ms));

    this.girando.set(true);
    // Si ya había una carta boca arriba, primero se voltea de vuelta.
    this.sacada.set(null);

    esperar(anterior ? 650 : 0, () => {
      this.barajando.set(true);
      // Los nombres pasan cada vez más lento, como una ruleta que se detiene.
      let t = 0;
      for (let paso = 0; paso < 14; paso++) {
        t += 70 + paso * 12;
        esperar(t, () => {
          const azar = this.arcanos[Math.floor(Math.random() * this.arcanos.length)];
          this.fugaz.set(azar.nombre);
        });
      }
      esperar(t + 120, () => {
        this.barajando.set(false);
        this.fugaz.set('');
        this.sacada.set(nueva);
        esperar(700, () => this.girando.set(false));
      });
    });
  }

  // ── Utilidades ────────────────────────────────────────────────────────────

  /** Con <base href="/">, un href="#id" navegaría a la portada del sitio. */
  irA(id: string): void {
    this.menu.set(false);
    if (!this.esNavegador) return;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth' });
  }

  /**
   * Se cambia la URL sin pasar por el router: una navegación, aunque sea solo
   * de query params, dispara el scroll al tope (scrollPositionRestoration) y
   * devolvía la página a la portada cada vez que se cerraba una carta.
   */
  private sincronizarUrl(slug: string | null): void {
    const ruta = this.location.path().split('?')[0];
    this.location.replaceState(ruta, slug ? 'carta=' + slug : '');
  }

  private soltarScroll(): void {
    if (this.esNavegador) document.body.style.overflow = '';
  }
}
