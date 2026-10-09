import { Component, computed, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule }     from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { EventosService, Evento } from '../../../core/services/eventos.service';
import { VentaEvento }      from '../../../core/services/inventario.service';
import {
  MetodoCuadre, agruparTransacciones, filtrar, cuadre, cajas, dias, montoLinea,
} from './cuadre';

@Component({
  selector: 'app-evento-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './evento-detail.component.html',
  styleUrl: './evento-detail.component.scss',
})
export class EventoDetailComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private svc    = inject(EventosService);

  readonly evento     = signal<Evento | null>(null);
  readonly ventas     = signal<VentaEvento[]>([]);
  readonly cargando   = signal(true);
  readonly errorMsg   = signal<string | null>(null);

  // Confirm dialog state
  confirmOpen     = signal(false);
  finalizando     = signal(false);
  finalizeError   = signal<string | null>(null);

  // Computed KPIs
  totalUnidades = computed(() =>
    this.ventas().reduce((acc, v) => acc + v.cantidad, 0)
  );

  totalCOP = computed(() =>
    this.ventas().reduce((acc, v) => acc + montoLinea(v), 0)
  );

  hasPrecio = computed(() =>
    this.ventas().some(v => v.productos_evento?.precio != null)
  );

  productosDistintos = computed(() =>
    new Set(this.ventas().map(v => v.producto_id)).size
  );

  diasEvento = computed(() => {
    const e = this.evento();
    if (!e) return 0;
    const inicio = new Date(e.fecha_inicio);
    const fin    = e.fecha_fin ? new Date(e.fecha_fin) : new Date();
    return Math.max(1, Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
  });

  topProductos = computed(() => {
    const map = new Map<string, { nombre: string; categoria: string; total: number }>();
    for (const v of this.ventas()) {
      const nombre    = v.productos_evento?.nombre ?? v.producto_id;
      const categoria = v.productos_evento?.categoria ?? '—';
      const prev      = map.get(nombre) ?? { nombre, categoria, total: 0 };
      map.set(nombre, { nombre, categoria, total: prev.total + v.cantidad });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  });

  ventasPorDia = computed(() => {
    const map = new Map<string, number>();
    for (const v of this.ventas()) {
      const dia = v.vendido_en.slice(0, 10);
      map.set(dia, (map.get(dia) ?? 0) + v.cantidad);
    }
    return Array.from(map.entries())
      .map(([dia, unidades]) => ({ dia, unidades }))
      .sort((a, b) => a.dia.localeCompare(b.dia));
  });

  // Cuadre de caja y ventas por transacción
  readonly filtroCaja = signal<string | null>(null);
  readonly filtroDia  = signal<string | null>(null);
  readonly visibles   = signal(50);

  readonly metodos: { clave: MetodoCuadre; etiqueta: string; tono: string; nota?: string }[] = [
    { clave: 'efectivo',      etiqueta: 'Efectivo',      tono: 'selva' },
    { clave: 'qr',            etiqueta: 'QR',            tono: 'rio' },
    { clave: 'datafono',      etiqueta: 'Datáfono',      tono: 'sol' },
    { clave: 'sin_registrar', etiqueta: 'Sin registrar', tono: 'neutro', nota: 'versión anterior del POS' },
  ];

  readonly transacciones = computed(() => agruparTransacciones(this.ventas()));
  readonly filtradas = computed(() =>
    filtrar(this.transacciones(), { caja: this.filtroCaja(), dia: this.filtroDia() }));
  readonly cuadreActual = computed(() => cuadre(this.filtradas()));
  readonly listaCajas = computed(() => {
    const l = cajas(this.transacciones());
    const repetidos = new Set(l.map(c => c.nombre).filter((n, i, a) => a.indexOf(n) !== i));
    return l.map(c => ({
      clave: c.clave,
      etiqueta: repetidos.has(c.nombre) && c.clave.startsWith('nombre:') ? c.nombre + ' (sin id)' : c.nombre,
    }));
  });
  readonly listaDias = computed(() => dias(this.transacciones()));

  private destruido = false;
  private quitarCanal?: () => void;
  private recarga?: ReturnType<typeof setTimeout>;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/admin/eventos']); return; }
    await this.cargar(id);
    if (this.destruido || !this.evento()) return;
    // Ventas nuevas: se vuelve a leer, agrupando ráfagas en una sola lectura.
    this.quitarCanal = this.svc.escucharVentas(() => this.programarRecarga(), () => this.programarRecarga());
    // Al volver a la pestaña el canal pudo perder avisos.
    document.addEventListener('visibilitychange', this.alVolver);
  }

  private programarRecarga() {
    if (this.destruido) return;
    clearTimeout(this.recarga);
    this.recarga = setTimeout(() => void this.refrescarVentas(), 2000);
  }

  private readonly alVolver = () => {
    if (document.visibilityState === 'visible') this.programarRecarga();
  };

  ngOnDestroy() {
    this.destruido = true;
    clearTimeout(this.recarga);
    this.quitarCanal?.();
    document.removeEventListener('visibilitychange', this.alVolver);
  }

  private async refrescarVentas() {
    const e = this.evento();
    if (!e || this.destruido) return;
    try { this.ventas.set(await this.svc.getVentasEvento(e)); } catch { /* se reintenta con la próxima venta */ }
  }

  cambiarCaja(v: string) { this.filtroCaja.set(v || null); this.visibles.set(50); }
  cambiarDia(v: string)  { this.filtroDia.set(v || null);  this.visibles.set(50); }

  etiquetaMetodo(m: MetodoCuadre) { return this.metodos.find(x => x.clave === m)!.etiqueta; }

  fmtHora(iso: string) {
    return new Date(iso).toLocaleString('es-CO', {
      timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit',
    });
  }

  fmtDia(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  }

  private async cargar(id: string) {
    this.cargando.set(true);
    this.errorMsg.set(null);
    try {
      const e = await this.svc.getEventoById(id);
      if (!e) { this.router.navigate(['/admin/eventos']); return; }
      this.evento.set(e);
      const v = await this.svc.getVentasEvento(e);
      this.ventas.set(v);
    } catch (err: any) {
      this.errorMsg.set(err.message);
    }
    this.cargando.set(false);
  }

  volver() { this.router.navigate(['/admin/eventos']); }

  abrirConfirm()  { this.confirmOpen.set(true); this.finalizeError.set(null); }
  cerrarConfirm() { this.confirmOpen.set(false); }

  async finalizar() {
    const e = this.evento();
    if (!e) return;
    this.finalizando.set(true);
    this.finalizeError.set(null);
    const { error } = await this.svc.finalizarEvento(e.id);
    if (error) {
      this.finalizeError.set(error);
      this.finalizando.set(false);
    } else {
      this.cerrarConfirm();
      await this.cargar(e.id);
    }
  }

  fmtFecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  fmtCOP(n: number) { return '$' + n.toLocaleString('es-CO'); }
}
