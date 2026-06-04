import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

export type TipoMensaje = 'comentario' | 'producto' | 'duda' | 'pedido';

@Injectable({ providedIn: 'root' })
export class MensajesService {
  private sb = inject(SupabaseService);

  readonly sending = signal(false);
  readonly error   = signal<string | null>(null);

  async send(tipo: TipoMensaje, mensaje: string, correo?: string): Promise<void> {
    this.sending.set(true);
    this.error.set(null);
    const { error } = await this.sb.db
      .from('mensajes')
      .insert({ tipo, mensaje, correo: correo ?? null });
    this.sending.set(false);
    if (error) this.error.set('No se pudo enviar el mensaje. Intenta de nuevo.');
  }
}
