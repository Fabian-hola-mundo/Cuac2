import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { VentaEvento } from './inventario.service';

export interface Evento {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: 'activo' | 'finalizado';
}

/** Navegador que ha abierto el POS, con lo que lleva vendido. */
export interface DispositivoPos {
  id: string;
  nombre: string;
  email: string | null;
  plataforma: string | null;
  user_agent: string | null;
  pantalla: string | null;
  primer_uso: string;
  ultimo_uso: string;
  ultimo_evento_id: string | null;
  ventas: number;
  unidades: number;
  ultima_venta: string | null;
}

@Injectable({ providedIn: 'root' })
export class EventosService {
  constructor(private sb: SupabaseService) {}

  async getEventos(): Promise<Evento[]> {
    const { data, error } = await this.sb.db
      .from('eventos')
      .select('*')
      .order('fecha_inicio', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getEventoActivo(): Promise<Evento | null> {
    const { data, error } = await this.sb.db
      .from('eventos')
      .select('*')
      .eq('estado', 'activo')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getEventoById(id: string): Promise<Evento | null> {
    const { data, error } = await this.sb.db
      .from('eventos')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  async crearEvento(nombre: string): Promise<{ error: string | null }> {
    const activo = await this.getEventoActivo();
    if (activo) {
      return { error: `Ya hay un evento activo: "${activo.nombre}". Finalízalo primero.` };
    }
    const { error } = await this.sb.db
      .from('eventos')
      .insert({ nombre, fecha_inicio: new Date().toISOString(), estado: 'activo' });
    if (error) return { error: error.message };
    return { error: null };
  }

  async finalizarEvento(id: string): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('eventos')
      .update({ estado: 'finalizado', fecha_fin: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  }

  async getVentasEvento(evento: Evento): Promise<VentaEvento[]> {
    const fin = evento.fecha_fin ?? new Date().toISOString();
    const { data, error } = await this.sb.db
      .from('ventas_evento')
      .select('*, productos_evento(nombre, categoria, precio), producto_variantes(opciones)')
      .gte('vendido_en', evento.fecha_inicio)
      .lte('vendido_en', fin)
      .order('vendido_en', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /** Avisa cuando entra una venta nueva (POS u otra). Devuelve la función para dejar de escuchar. */
  escucharVentas(onInsert: () => void): () => void {
    const canal = this.sb.db
      .channel(`evento-ventas-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ventas_evento' }, () => onInsert())
      .subscribe();
    return () => { this.sb.db.removeChannel(canal); };
  }

  async getDispositivosPos(): Promise<DispositivoPos[]> {
    const { data, error } = await this.sb.db
      .from('pos_dispositivos_resumen')
      .select('*')
      .order('ultimo_uso', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getTotalUnidadesEvento(evento: Evento): Promise<number> {
    const ventas = await this.getVentasEvento(evento);
    return ventas.reduce((sum, v) => sum + v.cantidad, 0);
  }
}
