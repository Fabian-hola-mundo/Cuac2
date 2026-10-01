// src/app/core/services/resenas.service.ts
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Resena {
  id:            string;
  nombre:        string;
  cargo_empresa: string | null;
  comentario:    string;
  correo:        string | null;
  visible:       boolean;
  proyecto_id:   string | null;
  created_at:    string;
  proyecto?:     { slug: string; title: string } | null;
}

export interface NuevaResena {
  nombre:        string;
  cargo_empresa: string | null;
  comentario:    string;
  correo:        string | null;
}

@Injectable({ providedIn: 'root' })
export class ResenasService {
  private sb = inject(SupabaseService);

  /** Reseñas aprobadas para el home, con el proyecto ligado si lo tienen. */
  async getVisibles(): Promise<Resena[]> {
    const { data, error } = await this.sb.db
      .from('resenas')
      .select('id, nombre, cargo_empresa, comentario, visible, proyecto_id, created_at, proyecto:portfolio_projects(slug, title)')
      .eq('visible', true)
      .order('created_at', { ascending: false });
    if (error) console.error('[resenas] getVisibles:', error.message);
    return (data ?? []) as unknown as Resena[];
  }

  /** Reseñas aprobadas ligadas a un proyecto del portafolio. */
  async getPorProyecto(proyectoId: string): Promise<Resena[]> {
    const { data, error } = await this.sb.db
      .from('resenas')
      .select('id, nombre, cargo_empresa, comentario, visible, proyecto_id, created_at')
      .eq('visible', true)
      .eq('proyecto_id', proyectoId)
      .order('created_at', { ascending: false });
    if (error) console.error('[resenas] getPorProyecto:', error.message);
    return (data ?? []) as Resena[];
  }

  async enviar(r: NuevaResena): Promise<{ error: string | null }> {
    const { error } = await this.sb.db.from('resenas').insert(r);
    if (error) console.error('[resenas] enviar:', error.message);
    return { error: error?.message ?? null };
  }

  // ── Admin ──

  async getTodas(): Promise<Resena[]> {
    // RPC: el correo no se puede seleccionar directamente por la API.
    const { data, error } = await this.sb.db.rpc('admin_listar_resenas');
    if (error) console.error('[resenas] getTodas:', error.message);
    return (data ?? []) as Resena[];
  }

  async actualizar(id: string, patch: Partial<Pick<Resena, 'visible' | 'proyecto_id'>>): Promise<{ error: string | null }> {
    const { error } = await this.sb.db.from('resenas').update(patch).eq('id', id);
    return { error: error?.message ?? null };
  }

  async eliminar(id: string): Promise<{ error: string | null }> {
    const { error } = await this.sb.db.from('resenas').delete().eq('id', id);
    return { error: error?.message ?? null };
  }
}
