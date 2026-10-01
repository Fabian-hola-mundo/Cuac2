// src/app/pages/admin/resenas/resenas-nuevas.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

export interface ResenaNueva {
  id:         string;
  nombre:     string;
  comentario: string;
  created_at: string;
}

const CLAVE_VISTO = 'cuac-admin-resenas-vistas-hasta';

/**
 * Reseñas que llegaron desde la última vez que se abrió /admin/resenas.
 * "Nueva" = sin publicar y creada después de esa visita. La marca de visita
 * vive en el navegador: la tabla no tiene columna de leída.
 */
@Injectable({ providedIn: 'root' })
export class ResenasNuevasService {
  private sb = inject(SupabaseService);

  readonly count = signal(0);

  vistoHasta(): string {
    try { return localStorage.getItem(CLAVE_VISTO) ?? new Date(0).toISOString(); }
    catch { return new Date(0).toISOString(); }
  }

  /** Cuenta las nuevas y devuelve las más recientes para la campana. */
  async cargar(limite = 5): Promise<ResenaNueva[]> {
    if (!this.sb.session()) return [];
    const desde = this.vistoHasta();
    const { data, count, error } = await this.sb.db
      .from('resenas')
      .select('id, nombre, comentario, created_at', { count: 'exact' })
      .eq('visible', false)
      .gt('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(limite);
    if (error) { console.error('[resenas] nuevas:', error.message); return []; }
    // Si mientras tanto se abrió /admin/resenas, la respuesta ya está vieja.
    if (this.vistoHasta() !== desde) return [];
    this.count.set(count ?? 0);
    return (data ?? []) as ResenaNueva[];
  }

  marcarVistas(): void {
    try { localStorage.setItem(CLAVE_VISTO, new Date().toISOString()); } catch { /* sin storage */ }
    this.count.set(0);
  }
}
