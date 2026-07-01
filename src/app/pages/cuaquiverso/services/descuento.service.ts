// src/app/pages/cuaquiverso/services/descuento.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CartItem } from './cart.service';

@Injectable({ providedIn: 'root' })
export class DescuentoService {
  private supabase = inject(SupabaseService);

  readonly codigoAplicado = signal<string | null>(null);
  readonly montoDescuento = signal(0);
  readonly validando      = signal(false);
  readonly error          = signal<string | null>(null);

  async aplicar(codigo: string, items: CartItem[], subtotal: number): Promise<void> {
    this.validando.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.db.functions.invoke('validar-descuento', {
      body: {
        codigo:   codigo.toUpperCase().trim(),
        subtotal,
        items: items.map(i => ({
          id:        i.id,
          categoria: i.categoria,
          precio:    i.price,
          cantidad:  i.qty,
        })),
      },
    });

    this.validando.set(false);

    if (error) {
      this.error.set('Error al validar el código. Intenta de nuevo.');
      return;
    }

    if (!data?.valido) {
      this.error.set(data?.mensaje ?? 'Código inválido');
      return;
    }

    this.codigoAplicado.set(codigo.toUpperCase().trim());
    this.montoDescuento.set(data.monto_descuento);
  }

  limpiar(): void {
    this.codigoAplicado.set(null);
    this.montoDescuento.set(0);
    this.error.set(null);
  }
}
