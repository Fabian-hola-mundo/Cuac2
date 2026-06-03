// src/app/pages/cuaquiverso/services/checkout.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CartItem } from './cart.service';

export interface CheckoutForm {
  nombre:       string;
  apellido:     string;
  email:        string;
  celular:      string;
  tipoDoc:      string;
  numDoc:       string;
  departamento: string;
  ciudad:       string;
  direccion:    string;
  barrio:       string;
  codigoPostal: string;
  nota:         string;
}

export interface PedidoItem {
  nombre:   string;
  sub:      string;
  precio:   number;
  cantidad: number;
  color:    string;
}

export interface PedidoDetalle {
  id:          string;
  referencia:  string;
  estado:      string;
  nombre:      string;
  apellido:    string;
  email:       string;
  ciudad:      string;
  direccion:   string;
  barrio:      string | null;
  subtotal:    number;
  total:       number;
  creado_en:   string;
  pedido_items: PedidoItem[];
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private supabase = inject(SupabaseService);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  async crearPedido(
    form: CheckoutForm,
    items: CartItem[],
    subtotal: number,
  ): Promise<{ referencia: string; wompi_url: string }> {
    const { data, error } = await this.supabase.db.functions.invoke('crear-pedido', {
      body: {
        form,
        items: items.map(i => ({
          nombre:   i.name,
          sub:      i.sub,
          precio:   i.price,
          cantidad: i.qty,
          color:    i.color,
        })),
        subtotal,
      },
    });

    if (error) throw new Error(error.message);
    if (!data?.wompi_url) throw new Error('Respuesta inválida del servidor');
    return data as { referencia: string; wompi_url: string };
  }

  async obtenerPedido(referencia: string): Promise<PedidoDetalle | null> {
    const { data, error } = await this.supabase.db
      .from('pedidos')
      .select(`
        id, referencia, estado, nombre, apellido, email,
        ciudad, direccion, barrio, subtotal, total, creado_en,
        pedido_items ( nombre, sub, precio, cantidad, color )
      `)
      .eq('referencia', referencia)
      .single();

    if (error || !data) return null;
    return data as PedidoDetalle;
  }
}
