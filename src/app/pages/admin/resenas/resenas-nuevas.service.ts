// src/app/pages/admin/resenas/resenas-nuevas.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

export interface ResenaNueva {
  id:         string;
  nombre:     string;
  comentario: string;
  created_at: string;
}

/**
 * Reseñas que nadie ha revisado todavía: sin publicar y con `leida = false`.
 * La marca vive en la base (032), así que es la misma en todos los dispositivos;
 * abrir /admin/resenas las marca como leídas.
 */
@Injectable({ providedIn: 'root' })
export class ResenasNuevasService {
  private sb = inject(SupabaseService);

  readonly count = signal(0);

  /** Cuenta las nuevas y devuelve las más recientes para la campana. */
  async cargar(limite = 5): Promise<ResenaNueva[]> {
    if (!this.sb.session()) return [];
    const { data, count, error } = await this.sb.db
      .from('resenas')
      .select('id, nombre, comentario, created_at', { count: 'exact' })
      .eq('visible', false)
      .eq('leida', false)
      .order('created_at', { ascending: false })
      .limit(limite);
    if (error) { console.error('[resenas] nuevas:', error.message); return []; }
    this.count.set(count ?? 0);
    return (data ?? []) as ResenaNueva[];
  }

  async marcarVistas(): Promise<void> {
    this.count.set(0);
    const { error } = await this.sb.db.rpc('admin_marcar_resenas_leidas');
    if (error) console.error('[resenas] marcar leídas:', error.message);
  }
}
