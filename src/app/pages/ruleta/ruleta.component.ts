import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TopbarComponent } from '../../layout/topbar/topbar.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { SeoService } from '../../core/services/seo.service';
import { RuletaOpcion, RuletaService } from '../../core/services/ruleta.service';
import { RuletaWheelComponent } from './ruleta-wheel.component';

@Component({
  selector: 'app-ruleta',
  standalone: true,
  imports: [TopbarComponent, FooterComponent, RuletaWheelComponent],
  templateUrl: './ruleta.component.html',
  styleUrl: './ruleta.component.scss',
})
export class RuletaComponent implements OnInit, OnDestroy {
  private seo    = inject(SeoService);
  private ruleta = inject(RuletaService);

  private wheel = viewChild(RuletaWheelComponent);
  private modalEl = viewChild<ElementRef<HTMLDivElement>>('modal');

  readonly config   = this.ruleta.config;
  readonly opciones = this.ruleta.opciones;
  readonly cargando = this.ruleta.cargando;
  readonly activas  = this.ruleta.opcionesActivas;

  readonly resultado    = signal<RuletaOpcion | null>(null);
  readonly giros        = signal(0);
  readonly modalAbierto = signal(false);

  /** A dónde devolver el foco al cerrar el modal. */
  private focoPrevio: HTMLElement | null = null;

  /** En qué ronda gastó su turno esta persona; 0 si todavía no ha jugado. */
  private readonly CLAVE_GIRO = 'cuac-ruleta-giro';
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly rondaJugada = signal(0);

  readonly disponible = computed(() => this.config().activa && this.activas().length > 0);

  /**
   * Se acabó el turno. Bloquea solo si se jugó en la ronda que sigue en curso:
   * cuando el estudio abre una ronda nueva desde el admin, el recuerdo deja de
   * coincidir y la persona vuelve a tener turno. Y si reabre «volver a girar»,
   * el candado desaparece del todo.
   */
  readonly agotado = computed(() =>
    !this.config().permitir_regirar && this.rondaJugada() === this.config().ronda,
  );

  /** Las opciones con la porción de rueda que ocupa cada una, en porcentaje. */
  readonly leyenda = computed(() => {
    const opciones = this.activas();
    const total = opciones.reduce((t, o) => t + Math.max(1, o.peso), 0) || 1;
    return opciones.map(o => ({
      opcion: o,
      probabilidad: Math.round((Math.max(1, o.peso) / total) * 100),
    }));
  });

  ngOnInit(): void {
    this.rondaJugada.set(this.leerGiro());

    const cfg = this.config();
    this.seo.set({
      title:       cfg.titulo,
      description: cfg.subtitulo,
      canonical:   'https://cuacdesign.com/ruleta',
    });

    void this.ruleta.load().then(() => {
      const actual = this.config();
      this.seo.set({
        title:       actual.titulo,
        description: actual.descripcion ?? actual.subtitulo,
        canonical:   'https://cuacdesign.com/ruleta',
      });
    });
  }

  ngOnDestroy(): void {
    this.soltarScroll();
  }

  alEmpezar(): void {
    this.resultado.set(null);
    this.cerrarModal();
  }

  alTerminar(opcion: RuletaOpcion): void {
    this.resultado.set(opcion);
    this.giros.update(n => n + 1);
    // Se anota siempre, encienda o no el estudio el límite: si lo activa más
    // tarde, quien ya había jugado en esta ronda cuenta como jugado.
    this.rondaJugada.set(this.config().ronda);
    this.marcarGiro();
    void this.ruleta.registrarGiro(opcion);

    if (this.config().mostrar_modal) this.abrirModal();
  }

  girarOtraVez(): void {
    if (this.agotado()) return;
    this.cerrarModal();
    this.wheel()?.girar();
  }

  // ── Modal del premio ───────────────────────────────────────────────────────

  private abrirModal(): void {
    if (this.esNavegador) this.focoPrevio = document.activeElement as HTMLElement | null;
    this.modalAbierto.set(true);
    if (!this.esNavegador) return;
    document.body.style.overflow = 'hidden';
    // El diálogo aún no existe en el DOM en este tick.
    setTimeout(() => this.modalEl()?.nativeElement.focus());
  }

  cerrarModal(): void {
    if (!this.modalAbierto()) return;
    this.modalAbierto.set(false);
    this.soltarScroll();
    // Devolver el foco a donde estaba: si no, quien navega con teclado vuelve
    // al principio del documento después de cada giro.
    this.focoPrevio?.focus?.();
    this.focoPrevio = null;
  }

  @HostListener('document:keydown.escape')
  alEscape(): void {
    this.cerrarModal();
  }

  private soltarScroll(): void {
    if (this.esNavegador) document.body.style.overflow = '';
  }

  private leerGiro(): number {
    if (!this.esNavegador) return 0;
    try {
      const guardado = Number(localStorage.getItem(this.CLAVE_GIRO));
      return Number.isFinite(guardado) ? guardado : 0;
    } catch {
      // Navegación privada o almacenamiento bloqueado: sin recuerdo, se deja
      // jugar. Es preferible a dejar la página muerta por un error de storage.
      return 0;
    }
  }

  private marcarGiro(): void {
    if (!this.esNavegador) return;
    try {
      localStorage.setItem(this.CLAVE_GIRO, String(this.config().ronda));
    } catch { /* ver leerGiro() */ }
  }
}
