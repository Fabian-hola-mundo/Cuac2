import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface RuletaConfig {
  id: string;

  // Contenido
  titulo: string;
  subtitulo: string;
  descripcion: string | null;
  boton_texto: string;
  boton_girando_texto: string;
  resultado_titulo: string;
  resultado_cta: string;
  gracias_texto: string | null;
  pie_texto: string | null;
  agotado_texto: string | null;

  // Comportamiento
  duracion_ms: number;
  vueltas_min: number;
  vueltas_max: number;
  /** Si el MISMO PREMIO puede volver a salir en giros posteriores. */
  permitir_repetir: boolean;
  /** Si LA PERSONA puede volver a girar después de su primer resultado. */
  permitir_regirar: boolean;
  sonido: boolean;
  confeti: boolean;
  registrar_giros: boolean;

  // Apariencia
  color_fondo: string;
  color_texto: string;
  color_acento: string;
  color_aro: string;
  color_puntero: string;
  color_hub: string;
  color_hub_texto: string;
  mostrar_luces: boolean;
  mostrar_descripcion: boolean;
  mostrar_leyenda: boolean;
  /** Si el resultado se anuncia además en un modal sobre la ruleta. */
  mostrar_modal: boolean;

  activa: boolean;

  /**
   * Ronda en curso. Cada visitante recuerda en cuál gastó su turno; subirla
   * desde el admin devuelve el turno a todo el mundo de golpe, en cualquier
   * dispositivo y sin que nadie tenga que borrar nada.
   */
  ronda: number;
}

export interface RuletaOpcion {
  id: string;
  config_id: string;
  etiqueta: string;
  descripcion: string | null;
  color: string;
  color_texto: string;
  peso: number;
  sort_order: number;
  activa: boolean;
}

/**
 * Lo que se pinta si la tabla todavía no existe o está vacía. La página nunca
 * debe quedarse en blanco por un problema de datos: una ruleta sin opciones no
 * es una ruleta.
 */
export const RULETA_CONFIG_DEFECTO: RuletaConfig = {
  id: 'default',
  titulo: 'La ruleta del Cuaquiverso',
  subtitulo: 'Gira y descubre qué te llevas hoy',
  descripcion: 'Un giro por persona. Muestra el resultado en caja o escríbenos por WhatsApp para reclamarlo.',
  boton_texto: 'Girar',
  boton_girando_texto: 'Girando…',
  resultado_titulo: '¡Te tocó!',
  resultado_cta: 'Girar otra vez',
  gracias_texto: 'Gracias por participar. Muestra esta pantalla en caja para reclamar tu premio.',
  pie_texto: 'Válido solo durante el evento. Sujeto a disponibilidad.',
  agotado_texto: 'Ya usaste tu giro de hoy. ¡Gracias por participar!',
  duracion_ms: 5200,
  vueltas_min: 4,
  vueltas_max: 7,
  permitir_repetir: true,
  permitir_regirar: true,
  sonido: true,
  confeti: true,
  registrar_giros: false,
  color_fondo: '#011E54',
  color_texto: '#FAFAFB',
  color_acento: '#EC3813',
  color_aro: '#FAFAFB',
  color_puntero: '#EC3813',
  color_hub: '#FAFAFB',
  color_hub_texto: '#011E54',
  mostrar_luces: true,
  mostrar_descripcion: true,
  mostrar_leyenda: true,
  mostrar_modal: true,
  activa: true,
  ronda: 1,
};

export const RULETA_OPCIONES_DEFECTO: RuletaOpcion[] = [
  { id: 'seed-1', config_id: 'default', etiqueta: 'Envío gratis',       descripcion: 'En tu próximo pedido de la tienda',      color: '#011E54', color_texto: '#FAFAFB', peso: 1, sort_order: 1, activa: true },
  { id: 'seed-2', config_id: 'default', etiqueta: '10% de descuento',   descripcion: 'Sobre el total de la compra',            color: '#FFC93C', color_texto: '#151F28', peso: 2, sort_order: 2, activa: true },
  { id: 'seed-3', config_id: 'default', etiqueta: 'Sticker sorpresa',   descripcion: 'Uno del Cuaquiverso, elegido al azar',   color: '#EC3813', color_texto: '#FAFAFB', peso: 3, sort_order: 3, activa: true },
  { id: 'seed-4', config_id: 'default', etiqueta: 'Sigue participando', descripcion: 'Vuelve a intentarlo en el próximo giro', color: '#C0E8FD', color_texto: '#151F28', peso: 2, sort_order: 4, activa: true },
  { id: 'seed-5', config_id: 'default', etiqueta: '2x1 en llaveros',    descripcion: 'Llévate dos y paga uno',                 color: '#FF8D75', color_texto: '#151F28', peso: 1, sort_order: 5, activa: true },
];

/** Paleta sugerida para opciones nuevas: alterna claro/oscuro por posición. */
export const RULETA_PALETA: { color: string; color_texto: string }[] = [
  { color: '#011E54', color_texto: '#FAFAFB' },
  { color: '#FFC93C', color_texto: '#151F28' },
  { color: '#EC3813', color_texto: '#FAFAFB' },
  { color: '#C0E8FD', color_texto: '#151F28' },
  { color: '#FF8D75', color_texto: '#151F28' },
  { color: '#1F8A5B', color_texto: '#FAFAFB' },
  { color: '#8B6FD8', color_texto: '#FAFAFB' },
  { color: '#151F28', color_texto: '#FAFAFB' },
];

type FilaOpcion = Partial<RuletaOpcion> & { id: string };

@Injectable({ providedIn: 'root' })
export class RuletaService {
  private sb = inject(SupabaseService);

  readonly config   = signal<RuletaConfig>(RULETA_CONFIG_DEFECTO);
  readonly opciones = signal<RuletaOpcion[]>(RULETA_OPCIONES_DEFECTO);
  readonly cargando = signal(false);
  readonly error    = signal<string | null>(null);
  /** true mientras se estén mostrando los valores de respaldo, no los de la BD. */
  readonly usandoDefectos = signal(true);

  /** Solo las que giran de verdad, en el orden en que se dibujan. */
  readonly opcionesActivas = computed(() =>
    this.opciones()
      .filter(o => o.activa)
      .sort((a, b) => a.sort_order - b.sort_order),
  );

  async load(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);

    const [cfg, ops] = await Promise.all([
      this.sb.db.from('ruleta_config').select('*').eq('id', 'default').maybeSingle(),
      this.sb.db.from('ruleta_opciones').select('*').eq('config_id', 'default').order('sort_order', { ascending: true }),
    ]);

    if (cfg.error || ops.error) {
      // Sin tabla (migración sin aplicar) o sin red: la página sigue jugable
      // con los valores de respaldo en vez de quedarse vacía.
      this.error.set(cfg.error?.message ?? ops.error?.message ?? null);
      this.config.set(RULETA_CONFIG_DEFECTO);
      this.opciones.set(RULETA_OPCIONES_DEFECTO);
      this.usandoDefectos.set(true);
      this.cargando.set(false);
      return;
    }

    this.config.set(cfg.data ? { ...RULETA_CONFIG_DEFECTO, ...cfg.data } : RULETA_CONFIG_DEFECTO);
    this.opciones.set(
      (ops.data?.length ?? 0) > 0
        ? (ops.data as RuletaOpcion[])
        : RULETA_OPCIONES_DEFECTO,
    );
    this.usandoDefectos.set(!cfg.data || (ops.data?.length ?? 0) === 0);
    this.cargando.set(false);
  }

  async guardarConfig(cambios: Partial<RuletaConfig>): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('ruleta_config')
      .upsert({ ...cambios, id: 'default', actualizado_en: new Date().toISOString() });
    return { error: error?.message ?? null };
  }

  /**
   * Deja la tabla de opciones igual a `opciones`: primero escribe las que se
   * quedan y solo al final borra las que el admin quitó, para que un fallo a
   * mitad de camino no deje la ruleta sin opciones.
   */
  async guardarOpciones(opciones: FilaOpcion[]): Promise<{ error: string | null }> {
    const nuevas     = opciones.filter(o => this.esIdTemporal(o.id));
    const existentes = opciones.filter(o => !this.esIdTemporal(o.id));

    if (existentes.length > 0) {
      const { error } = await this.sb.db
        .from('ruleta_opciones')
        .upsert(existentes.map(o => ({ ...this.aFila(o), id: o.id })));
      if (error) return { error: error.message };
    }

    if (nuevas.length > 0) {
      const { error } = await this.sb.db
        .from('ruleta_opciones')
        .insert(nuevas.map(o => this.aFila(o)));
      if (error) return { error: error.message };
    }

    const conservar = existentes.map(o => o.id);
    const query = this.sb.db.from('ruleta_opciones').delete().eq('config_id', 'default');
    const borrado = conservar.length > 0
      ? await query.not('id', 'in', '(' + conservar.join(',') + ')')
      : await query;
    if (borrado.error) return { error: borrado.error.message };

    return { error: null };
  }

  /**
   * Abre una ronda nueva: todo el mundo recupera su turno. Devuelve el número
   * de la ronda que queda en curso.
   */
  async nuevaRonda(): Promise<{ ronda: number | null; error: string | null }> {
    const { data, error } = await this.sb.db.rpc('ruleta_nueva_ronda');
    if (error) return { ronda: null, error: error.message };
    const ronda = Number(data);
    this.config.update(c => ({ ...c, ronda }));
    return { ronda, error: null };
  }

  /** Registra un giro. Silencioso: un fallo aquí no debe romper el juego. */
  async registrarGiro(opcion: RuletaOpcion): Promise<void> {
    if (!this.config().registrar_giros) return;
    const opcion_id = this.esIdTemporal(opcion.id) ? null : opcion.id;
    await this.sb.db.from('ruleta_giros').insert({ opcion_id, etiqueta: opcion.etiqueta });
  }

  async ultimosGiros(limite = 20): Promise<{ etiqueta: string; creado_en: string }[]> {
    const { data, error } = await this.sb.db
      .from('ruleta_giros')
      .select('etiqueta, creado_en')
      .order('creado_en', { ascending: false })
      .limit(limite);
    return error ? [] : (data ?? []);
  }

  /** Los ids que aún no existen en la BD (filas recién añadidas o de respaldo). */
  esIdTemporal(id: string): boolean {
    return id.startsWith('tmp-') || id.startsWith('seed-');
  }

  private aFila(o: FilaOpcion) {
    return {
      config_id:   'default',
      etiqueta:    (o.etiqueta ?? '').trim() || 'Sin nombre',
      descripcion: o.descripcion?.trim() || null,
      color:       o.color ?? '#EC3813',
      color_texto: o.color_texto ?? '#FAFAFB',
      peso:        Math.max(1, Math.min(100, Math.round(o.peso ?? 1))),
      sort_order:  o.sort_order ?? 0,
      activa:      o.activa ?? true,
    };
  }
}
