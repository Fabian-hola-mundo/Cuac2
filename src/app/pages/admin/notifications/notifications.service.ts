// src/app/pages/admin/notifications/notifications.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';

export interface AdminNotif {
  id: string;
  type: 'mensaje' | 'cotizacion' | 'stock' | 'evento';
  title: string;
  sub: string;       // subtítulo breve
  time: string;      // ISO timestamp
  route: string[];   // argumento de Router.navigate()
  tone: 'rio' | 'lila' | 'sol' | 'rosa';
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private sb = inject(SupabaseService);
  private channel: RealtimeChannel | null = null;

  readonly items = signal<AdminNotif[]>([]);
  readonly count = computed(() => this.items().length);

  async load(): Promise<void> {
    const [mensajes, cotizaciones, stock, eventos] = await Promise.all([
      this.fetchMensajes().catch(() => [] as AdminNotif[]),
      this.fetchCotizaciones().catch(() => [] as AdminNotif[]),
      this.fetchStock().catch(() => [] as AdminNotif[]),
      this.fetchEventos().catch(() => [] as AdminNotif[]),
    ]);
    const all = [...mensajes, ...cotizaciones, ...stock, ...eventos]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20);
    this.items.set(all);
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
  }

  cleanup(): void {
    if (this.channel) {
      this.sb.db.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private prepend(notif: AdminNotif): void {
    this.items.update(list => [notif, ...list.filter(n => n.id !== notif.id)].slice(0, 20));
  }
}
