import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RULETA_PALETA,
  RuletaConfig,
  RuletaOpcion,
  RuletaService,
} from '../../../core/services/ruleta.service';
import { RuletaWheelComponent } from '../../ruleta/ruleta-wheel.component';

type PestanaId = 'contenido' | 'opciones' | 'apariencia' | 'comportamiento';

interface CampoColor {
  clave: keyof RuletaConfig;
  label: string;
  hint: string;
}

@Component({
  selector: 'app-admin-ruleta',
  standalone: true,
  imports: [CommonModule, RuletaWheelComponent],
  templateUrl: './admin-ruleta.component.html',
  styleUrl: './admin-ruleta.component.scss',
})
export class AdminRuletaComponent implements OnInit {
  private ruleta = inject(RuletaService);

  private wheel = viewChild(RuletaWheelComponent);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly guardado  = signal(false);
  readonly error     = signal<string | null>(null);
  readonly aviso     = signal<string | null>(null);

  readonly pestana = signal<PestanaId>('contenido');

  /** Borrador editable: no se toca la BD hasta pulsar «Guardar cambios». */
  readonly cfg = signal<RuletaConfig>({ ...this.ruleta.config() });
  readonly opciones = signal<RuletaOpcion[]>([]);

  readonly ultimosGiros = signal<{ etiqueta: string; creado_en: string }[]>([]);

  private siguienteTmp = 1;

  readonly PESTANAS: { id: PestanaId; label: string }[] = [
    { id: 'contenido',     label: 'Contenido' },
    { id: 'opciones',      label: 'Opciones' },
    { id: 'apariencia',    label: 'Apariencia' },
    { id: 'comportamiento', label: 'Comportamiento' },
  ];

  readonly COLORES: CampoColor[] = [
    { clave: 'color_fondo',     label: 'Fondo de la página', hint: 'El lienzo detrás de la ruleta' },
    { clave: 'color_texto',     label: 'Texto de la página', hint: 'Títulos y párrafos sobre el fondo' },
    { clave: 'color_acento',    label: 'Acento',             hint: 'Botones, bombillas y detalles' },
    { clave: 'color_aro',       label: 'Aro y separadores',  hint: 'El marco del disco' },
    { clave: 'color_puntero',   label: 'Puntero',            hint: 'La aguja fija de arriba' },
    { clave: 'color_hub',       label: 'Botón central',      hint: 'Fondo de la tapa que se pulsa' },
    { clave: 'color_hub_texto', label: 'Texto del botón',    hint: 'Debe contrastar con la tapa' },
  ];

  // ── Derivados ──────────────────────────────────────────────────────────────

  readonly activas = computed(() =>
    this.opciones().filter(o => o.activa).sort((a, b) => a.sort_order - b.sort_order),
  );

  readonly pesoTotal = computed(() =>
    this.activas().reduce((t, o) => t + Math.max(1, o.peso), 0) || 1,
  );

  readonly ordenadas = computed(() =>
    [...this.opciones()].sort((a, b) => a.sort_order - b.sort_order),
  );

  /** Errores que impiden guardar; el botón se apaga mientras haya alguno. */
  readonly problemas = computed<string[]>(() => {
    const p: string[] = [];
    const c = this.cfg();
    if (this.activas().length === 0) p.push('Necesitas al menos una opción activa.');
    if (this.opciones().some(o => !o.etiqueta.trim())) p.push('Hay opciones sin nombre.');
    if (c.vueltas_max < c.vueltas_min) p.push('Las vueltas máximas no pueden ser menos que las mínimas.');
    if (c.duracion_ms < 500 || c.duracion_ms > 30000) p.push('La duración debe estar entre 0,5 y 30 segundos.');
    if (!c.boton_texto.trim()) p.push('El botón necesita un texto.');
    return p;
  });

  readonly puedeGuardar = computed(() => this.problemas().length === 0 && !this.guardando());

  // ── Ciclo de vida ──────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.recargar();
  }

  async recargar(): Promise<void> {
    this.cargando.set(true);
    await this.ruleta.load();
    this.cfg.set({ ...this.ruleta.config() });
    this.opciones.set(this.ruleta.opciones().map(o => ({ ...o })));
    this.aviso.set(
      this.ruleta.usandoDefectos()
        ? 'Estás viendo los valores de arranque. Se crearán en la base de datos la primera vez que guardes.'
        : null,
    );
    this.cargando.set(false);
    void this.cargarGiros();
  }

  private async cargarGiros(): Promise<void> {
    if (!this.cfg().registrar_giros) { this.ultimosGiros.set([]); return; }
    this.ultimosGiros.set(await this.ruleta.ultimosGiros(15));
  }

  // ── Edición de la configuración ────────────────────────────────────────────

  private aplicar(clave: keyof RuletaConfig, valor: unknown): void {
    this.cfg.update(c => ({ ...c, [clave]: valor }) as RuletaConfig);
    this.guardado.set(false);
  }

  setTexto(clave: keyof RuletaConfig, ev: Event): void {
    this.aplicar(clave, (ev.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  setNumero(clave: keyof RuletaConfig, ev: Event, min = -Infinity, max = Infinity): void {
    const n = Number((ev.target as HTMLInputElement).value);
    this.aplicar(clave, Math.max(min, Math.min(max, Number.isFinite(n) ? n : min)));
  }

  alternar(clave: keyof RuletaConfig): void {
    this.aplicar(clave, !this.cfg()[clave]);
    if (clave === 'registrar_giros') void this.cargarGiros();
  }

  valorTexto(clave: keyof RuletaConfig): string {
    return String(this.cfg()[clave] ?? '');
  }

  valorNumero(clave: keyof RuletaConfig): number {
    return Number(this.cfg()[clave] ?? 0);
  }

  activo(clave: keyof RuletaConfig): boolean {
    return this.cfg()[clave] === true;
  }

  // ── Edición de las opciones ────────────────────────────────────────────────

  actualizar(id: string, clave: keyof RuletaOpcion, valor: unknown): void {
    this.opciones.update(os =>
      os.map(o => (o.id === id ? ({ ...o, [clave]: valor } as RuletaOpcion) : o)),
    );
    this.guardado.set(false);
  }

  actualizarTexto(id: string, clave: keyof RuletaOpcion, ev: Event): void {
    this.actualizar(id, clave, (ev.target as HTMLInputElement).value);
  }

  actualizarPeso(id: string, ev: Event): void {
    const n = Math.round(Number((ev.target as HTMLInputElement).value));
    this.actualizar(id, 'peso', Math.max(1, Math.min(100, Number.isFinite(n) ? n : 1)));
  }

  agregar(): void {
    const paleta = RULETA_PALETA[this.opciones().length % RULETA_PALETA.length];
    const orden  = this.opciones().reduce((max, o) => Math.max(max, o.sort_order), 0) + 1;
    this.opciones.update(os => [
      ...os,
      {
        id: `tmp-${this.siguienteTmp++}`,
        config_id: 'default',
        etiqueta: '',
        descripcion: null,
        color: paleta.color,
        color_texto: paleta.color_texto,
        peso: 1,
        sort_order: orden,
        activa: true,
      },
    ]);
    this.guardado.set(false);
  }

  eliminar(id: string): void {
    this.opciones.update(os => os.filter(o => o.id !== id));
    this.guardado.set(false);
  }

  mover(id: string, delta: -1 | 1): void {
    const lista = this.ordenadas();
    const i = lista.findIndex(o => o.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    this.opciones.set(lista.map((o, k) => ({ ...o, sort_order: k + 1 })));
    this.guardado.set(false);
  }

  probabilidad(o: RuletaOpcion): number {
    if (!o.activa) return 0;
    return Math.round((Math.max(1, o.peso) / this.pesoTotal()) * 100);
  }

  // ── Vista previa ───────────────────────────────────────────────────────────

  probarGiro(): void {
    this.wheel()?.girar();
  }

  reiniciarPreview(): void {
    this.wheel()?.reiniciar();
  }

  // ── Reiniciar el juego ─────────────────────────────────────────────────────

  readonly confirmandoReinicio = signal(false);
  readonly reiniciando         = signal(false);
  readonly rondaAbierta        = signal<number | null>(null);

  pedirConfirmacionReinicio(): void {
    this.confirmandoReinicio.set(true);
    this.rondaAbierta.set(null);
  }

  cancelarReinicio(): void {
    this.confirmandoReinicio.set(false);
  }

  /**
   * Devuelve el turno a todo el mundo abriendo una ronda nueva. No borra nada
   * en los navegadores ajenos —no se puede—: lo que hace es que el turno que
   * cada quien tiene guardado deje de valer para la ronda en curso.
   */
  async reiniciarJuego(): Promise<void> {
    this.reiniciando.set(true);
    this.error.set(null);

    const { ronda, error } = await this.ruleta.nuevaRonda();

    this.reiniciando.set(false);
    this.confirmandoReinicio.set(false);

    if (error) {
      this.error.set(error);
      return;
    }

    // El borrador del admin también tiene que quedar en la ronda nueva, o el
    // siguiente «Guardar cambios» escribiría el número viejo.
    if (ronda !== null) this.cfg.update(c => ({ ...c, ronda }));
    this.rondaAbierta.set(ronda);
    this.wheel()?.reiniciar();
  }

  // ── Guardar ────────────────────────────────────────────────────────────────

  async guardar(): Promise<void> {
    if (!this.puedeGuardar()) return;
    this.guardando.set(true);
    this.error.set(null);

    // `ronda` se queda fuera a propósito: solo la mueve el botón de reiniciar,
    // vía función atómica. Si viajara en este payload, guardar con un borrador
    // viejo abierto desharía un reinicio hecho desde otra pestaña.
    const { id, ronda, ...cambios } = this.cfg();
    const resCfg = await this.ruleta.guardarConfig(cambios);
    if (resCfg.error) {
      this.error.set(resCfg.error);
      this.guardando.set(false);
      return;
    }

    // El orden guardado es el que se ve en la tabla, no el que tuvieran antes.
    const conOrden = this.ordenadas().map((o, i) => ({ ...o, sort_order: i + 1 }));
    const resOps = await this.ruleta.guardarOpciones(conOrden);
    if (resOps.error) {
      this.error.set(resOps.error);
      this.guardando.set(false);
      return;
    }

    await this.recargar();
    this.guardando.set(false);
    this.guardado.set(true);
    setTimeout(() => this.guardado.set(false), 2600);
  }
}
