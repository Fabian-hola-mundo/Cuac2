// src/app/pages/admin/notifications/notifications.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ResenasNuevasService } from '../resenas/resenas-nuevas.service';

export interface AdminNotif {
  id: string;
  type: 'mensaje' | 'cotizacion' | 'stock' | 'evento' | 'resena';
  title: string;
  sub: string;       // subtítulo breve
  time: string;      // ISO timestamp
  route: string[];   // argumento de Router.navigate()
  tone: 'rio' | 'lila' | 'sol' | 'rosa';
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private sb = inject(SupabaseService);
  private resenas = inject(ResenasNuevasService);
  private channel: RealtimeChannel | null = null;
  // Las reseñas no van por realtime (la columna del correo está restringida),
  // así que se consultan cada minuto.
  private pollResenas: ReturnType<typeof setInterval> | null = null;

  readonly items = signal<AdminNotif[]>([]);
  readonly count = computed(() => this.items().length);

  async load(): Promise<void> {
    if (!this.sb.session()) return;
    const [mensajes, cotizaciones, stock, eventos, resenas] = await Promise.all([
      this.fetchMensajes().catch(() => [] as AdminNotif[]),
      this.fetchCotizaciones().catch(() => [] as AdminNotif[]),
      this.fetchStock().catch(() => [] as AdminNotif[]),
      this.fetchEventos().catch(() => [] as AdminNotif[]),
      this.fetchResenas().catch(() => [] as AdminNotif[]),
    ]);
    const all = [...mensajes, ...cotizaciones, ...stock, ...eventos, ...resenas]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20);
    this.items.set(all);
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

  /** Vuelve a pedir las reseñas nuevas sin tocar el resto de la lista. */
  async refrescarResenas(): Promise<void> {
    if (!this.sb.session()) return;
    const resenas = await this.fetchResenas().catch(() => null);
    if (!resenas) return;
    this.items.update(list =>
      [...resenas, ...list.filter(n => n.type !== 'resena')]
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 20));
  }

  quitarTipo(type: AdminNotif['type']): void {
    this.items.update(list => list.filter(n => n.type !== type));
  }

  private async fetchMensajes(): Promise<AdminNotif[]> {
    const { data } = await this.sb.db
      .from('mensajes')
      .select('id, mensaje, correo, created_at')
      .eq('leido', false)
      .order('created_at', { ascending: false })
      .limit(5);
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
    const { data } = await this.sb.db
      .from('cotizaciones')
      .select('id, nombre, empresa, created_at')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(5);
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

  private async fetchStock(): Promise<AdminNotif[]> {
    const { data } = await this.sb.db
      .from('productos_evento')
      .select('id, nombre, stock_actual, creado_en')
      .eq('activo', true)
      .lte('stock_actual', 3)
      .order('stock_actual', { ascending: true })
      .limit(5);
    return (data ?? []).map(p => ({
      id: `stk-${p.id}`,
      type: 'stock' as const,
      title: `Stock bajo · ${p.nombre}`,
      sub: `Solo ${p.stock_actual} unidad${p.stock_actual === 1 ? '' : 'es'} disponible${p.stock_actual === 1 ? '' : 's'}`,
      time: new Date().toISOString(),
      route: ['/admin/productos'],
      tone: 'sol' as const,
    }));
  }

  private async fetchEventos(): Promise<AdminNotif[]> {
    const now = new Date().toISOString();
    const in7days = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const { data } = await this.sb.db
      .from('eventos')
      .select('id, nombre, fecha_inicio')
      .eq('estado', 'activo')
      .gte('fecha_inicio', now)
      .lte('fecha_inicio', in7days)
      .order('fecha_inicio', { ascending: true })
      .limit(3);
    return (data ?? []).map(e => ({
      id: `evt-${e.id}`,
      type: 'evento' as const,
      title: `Evento próximo · ${e.nombre}`,
      sub: new Date(e.fecha_inicio).toLocaleDateString('es-CL', {
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
        { event: 'UPDATE', schema: 'public', table: 'productos_evento' },
        payload => {
          const p = payload.new as any;
          if (p.activo && p.stock_actual <= 3) {
            const notif: AdminNotif = {
              id: `stk-${p.id}`,
              type: 'stock',
              title: `Stock bajo · ${p.nombre}`,
              sub: `Solo ${p.stock_actual} unidad${p.stock_actual === 1 ? '' : 'es'} disponible${p.stock_actual === 1 ? '' : 's'}`,
              time: new Date().toISOString(),
              route: ['/admin/productos'],
              tone: 'sol',
            };
            this.prepend(notif);
          }
        }
      )
      .subscribe();

    this.pollResenas ??= setInterval(() => this.refrescarResenas(), 60_000);
  }

  cleanup(): void {
    if (this.pollResenas) {
      clearInterval(this.pollResenas);
      this.pollResenas = null;
    }
    if (this.channel) {
      this.sb.db.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private prepend(notif: AdminNotif): void {
    this.items.update(list => [notif, ...list.filter(n => n.id !== notif.id)].slice(0, 20));
  }
}
