// src/app/pages/admin/notifications/notifications.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ResenasNuevasService } from '../resenas/resenas-nuevas.service';

export interface AdminNotif {
  id: string;
  type: 'mensaje' | 'cotizacion' | 'stock' | 'evento' | 'resena' | 'pedido';
  title: string;
  sub: string;       // subtítulo breve
  time: string;      // ISO timestamp
  route: string[];   // argumento de Router.navigate()
  tone: 'rio' | 'lila' | 'sol' | 'rosa';
  /** Solo pedidos: referencia con la que el dashboard abre el detalle. */
  referencia?: string;
}

const STOCK_BAJO = 3;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private sb = inject(SupabaseService);
  private resenas = inject(ResenasNuevasService);
  private channel: RealtimeChannel | null = null;
  // Realtime no basta: con el celular bloqueado la conexión se cae y lo que
  // entra mientras tanto se pierde. Cada minuto, y al volver a la pestaña, se
  // relee todo. Las reseñas además no van por realtime (la columna del correo
  // está restringida).
  private poll: ReturnType<typeof setInterval> | null = null;
  private alVolver = () => { if (document.visibilityState === 'visible') void this.load(); };

  readonly items = signal<AdminNotif[]>([]);
  readonly count = computed(() => this.items().length);

  async load(): Promise<void> {
    if (!this.sb.session()) return;
    const [pedidos, mensajes, cotizaciones, resenas, stock, eventos] = await Promise.all([
      this.fetchPedidos().catch(() => [] as AdminNotif[]),
      this.fetchMensajes().catch(() => [] as AdminNotif[]),
      this.fetchCotizaciones().catch(() => [] as AdminNotif[]),
      this.fetchResenas().catch(() => [] as AdminNotif[]),
      this.fetchStock().catch(() => [] as AdminNotif[]),
      this.fetchEventos().catch(() => [] as AdminNotif[]),
    ]);
    // Lo que pide acción va primero; el stock y los eventos son recordatorios
    // permanentes y no deben tapar un pedido o una reseña recién llegados.
    const porFecha = (a: AdminNotif, b: AdminNotif) => new Date(b.time).getTime() - new Date(a.time).getTime();
    const accion = [...pedidos, ...mensajes, ...cotizaciones, ...resenas].sort(porFecha);
    this.items.set([...accion, ...eventos, ...stock].slice(0, 30));
  }

  quitarTipo(type: AdminNotif['type']): void {
    this.items.update(list => list.filter(n => n.type !== type));
  }

  /** El pedido ya se revisó: sale de la campana en todos los dispositivos. */
  async marcarPedidoVisto(referencia: string): Promise<void> {
    this.items.update(list => list.filter(n => !(n.type === 'pedido' && n.referencia === referencia)));
    const { error } = await this.sb.db
      .from('pedidos')
      .update({ visto_admin: true })
      .eq('referencia', referencia)
      .eq('visto_admin', false);
    if (error) console.error('[notif] marcar pedido visto:', error.message);
  }

  private notifPedido(p: any): AdminNotif {
    const cliente = [p.nombre, p.apellido].filter(Boolean).join(' ') || 'Sin nombre';
    const total = `$${Number(p.total ?? 0).toLocaleString('es-CO')}`;
    return {
      id: `ped-${p.id}`,
      type: 'pedido',
      title: p.sobreventa
        ? `Pedido pagado sin stock · ${p.referencia ?? ''}`.trim()
        : `Pedido pagado · ${p.referencia ?? ''}`.trim(),
      sub: `${cliente} · ${total}`,
      time: p.creado_en ?? new Date().toISOString(),
      route: ['/admin'],
      tone: 'rosa',
      referencia: p.referencia ?? undefined,
    };
  }

  private async fetchPedidos(): Promise<AdminNotif[]> {
    const { data, error } = await this.sb.db
      .from('pedidos')
      .select('id, referencia, nombre, apellido, total, sobreventa, creado_en')
      .eq('estado', 'aprobado')
      .eq('visto_admin', false)
      .order('creado_en', { ascending: false })
      .limit(10);
    if (error) throw error;
    return (data ?? []).map(p => this.notifPedido(p));
  }

  private async fetchResenas(): Promise<AdminNotif[]> {
    const nuevas = await this.resenas.cargar();
    return nuevas.map(r => ({
      id: `res-${r.id}`,
      type: 'resena' as const,
      title: `Nueva reseña de ${r.nombre}`,
      sub: r.comentario.slice(0, 60),
      time: r.created_at,
      route: ['/admin/resenas'],
      tone: 'sol' as const,
    }));
  }

  private async fetchMensajes(): Promise<AdminNotif[]> {
    const { data, error } = await this.sb.db
      .from('mensajes')
      .select('id, mensaje, correo, created_at')
      .eq('leido', false)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    return (data ?? []).map(m => ({
      id: `msg-${m.id}`,
      type: 'mensaje' as const,
      title: `Mensaje de ${m.correo ?? 'visitante'}`,
      sub: (m.mensaje as string)?.slice(0, 60) ?? '',
      time: m.created_at,
      route: ['/admin/mensajes'],
      tone: 'rio' as const,
    }));
  }

  private async fetchCotizaciones(): Promise<AdminNotif[]> {
    const { data, error } = await this.sb.db
      .from('cotizaciones')
      .select('id, nombre, empresa, created_at')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    return (data ?? []).map(c => ({
      id: `cot-${c.id}`,
      type: 'cotizacion' as const,
      title: `Cotización de ${c.nombre}`,
      sub: c.empresa ?? '',
      time: c.created_at,
      route: ['/admin/cotizaciones'],
      tone: 'lila' as const,
    }));
  }

  private notifStock(id: string, nombre: string, stock: number): AdminNotif {
    return {
      id: `stk-${id}`,
      type: 'stock',
      title: stock === 0 ? `Agotado · ${nombre}` : `Stock bajo · ${nombre}`,
      sub: stock === 0
        ? 'Sin unidades disponibles'
        : `Solo ${stock} unidad${stock === 1 ? '' : 'es'} disponible${stock === 1 ? '' : 's'}`,
      time: new Date().toISOString(),
      route: ['/admin/productos'],
      tone: 'sol',
    };
  }

  private async fetchStock(): Promise<AdminNotif[]> {
    // Un producto con variantes suma el stock de todas: una talla agotada no
    // baja el total, así que las variantes se revisan aparte.
    const [productos, variantes] = await Promise.all([
      this.sb.db
        .from('productos_evento')
        .select('id, nombre, stock_actual, producto_variantes(id)')
        .eq('activo', true)
        .lte('stock_actual', STOCK_BAJO)
        .order('stock_actual', { ascending: true })
        .limit(10),
      this.sb.db
        .from('producto_variantes')
        .select('id, opciones, stock_actual, productos_evento!inner(nombre, activo)')
        .eq('activo', true)
        .eq('productos_evento.activo', true)
        .lte('stock_actual', STOCK_BAJO)
        .order('stock_actual', { ascending: true })
        .limit(10),
    ]);
    if (productos.error) throw productos.error;
    if (variantes.error) throw variantes.error;

    const sinVariantes = (productos.data ?? [])
      .filter((p: any) => !(p.producto_variantes ?? []).length)
      .map(p => this.notifStock(p.id, p.nombre, p.stock_actual));
    const porVariante = (variantes.data ?? []).map((v: any) => {
      const etiqueta = Object.values(v.opciones ?? {}).join(' / ');
      const nombre = v.productos_evento?.nombre ?? 'Producto';
      return this.notifStock(v.id, etiqueta ? `${nombre} (${etiqueta})` : nombre, v.stock_actual);
    });
    return [...sinVariantes, ...porVariante]
      .sort((a, b) => Number(b.title.startsWith('Agotado')) - Number(a.title.startsWith('Agotado')));
  }

  private async fetchEventos(): Promise<AdminNotif[]> {
    const now = new Date().toISOString();
    const in7days = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const { data, error } = await this.sb.db
      .from('eventos')
      .select('id, nombre, fecha_inicio')
      .eq('estado', 'activo')
      .gte('fecha_inicio', now)
      .lte('fecha_inicio', in7days)
      .order('fecha_inicio', { ascending: true })
      .limit(3);
    if (error) throw error;
    return (data ?? []).map(e => ({
      id: `evt-${e.id}`,
      type: 'evento' as const,
      title: `Evento próximo · ${e.nombre}`,
      sub: new Date(e.fecha_inicio).toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'short',
      }),
      time: e.fecha_inicio,
      route: ['/admin/eventos'],
      tone: 'rosa' as const,
    }));
  }

  subscribe(): void {
    if (this.channel) return; // evitar doble suscripción
    if (!this.sb.session()) return;
    this.channel = this.sb.db
      .channel('admin-notif')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        payload => {
          const m = payload.new as any;
          this.prepend({
            id: `msg-${m.id}`,
            type: 'mensaje',
            title: `Mensaje de ${m.correo ?? 'visitante'}`,
            sub: (m.mensaje as string)?.slice(0, 60) ?? '',
            time: m.created_at,
            route: ['/admin/mensajes'],
            tone: 'rio',
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cotizaciones' },
        payload => {
          const c = payload.new as any;
          this.prepend({
            id: `cot-${c.id}`,
            type: 'cotizacion',
            title: `Cotización de ${c.nombre}`,
            sub: c.empresa ?? '',
            time: c.created_at,
            route: ['/admin/cotizaciones'],
            tone: 'lila',
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        payload => {
          // payload.old solo trae la llave (replica identity por defecto): se
          // decide con la fila nueva. Un pedido recibe varios UPDATE (reserva,
          // stock, correo); prepend no duplica porque reemplaza por id.
          const p = payload.new as any;
          if (p.estado === 'aprobado' && !p.visto_admin) this.prepend(this.notifPedido(p));
          else this.items.update(list => list.filter(n => n.id !== `ped-${p.id}`));
        }
      )
      // Las alertas de stock se recalculan enteras: una venta puede bajar una
      // variante y el total del producto a la vez.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'productos_evento' }, () => this.refrescarStock())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'producto_variantes' }, () => this.refrescarStock())
      .subscribe();

    this.poll ??= setInterval(() => void this.load(), 60_000);
    document.addEventListener('visibilitychange', this.alVolver);
  }

  private stockTimer?: ReturnType<typeof setTimeout>;
  private refrescarStock(): void {
    clearTimeout(this.stockTimer);
    this.stockTimer = setTimeout(async () => {
      const stock = await this.fetchStock().catch(() => null);
      if (!stock) return;
      this.items.update(list => {
        const resto = list.filter(n => n.type !== 'stock');
        return [...resto, ...stock].slice(0, 30);
      });
    }, 400);
  }

  cleanup(): void {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
    document.removeEventListener('visibilitychange', this.alVolver);
    clearTimeout(this.stockTimer);
    if (this.channel) {
      this.sb.db.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private prepend(notif: AdminNotif): void {
    this.items.update(list => [notif, ...list.filter(n => n.id !== notif.id)].slice(0, 30));
  }
}
