import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Injectable({ providedIn: 'root' })
export class MensajesUnreadService {
  private sb = inject(SupabaseService);

  readonly count = signal(0);

  async load(): Promise<void> {
    const { count } = await this.sb.db
      .from('mensajes')
      .select('*', { count: 'exact', head: true })
      .eq('leido', false);
    this.count.set(count ?? 0);
  }

  decrement(): void {
    this.count.update(n => Math.max(0, n - 1));
  }
}
