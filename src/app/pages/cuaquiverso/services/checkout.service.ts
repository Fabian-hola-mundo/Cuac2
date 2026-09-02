// src/app/pages/cuaquiverso/services/checkout.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CartItem } from './cart.service';
import { BoldCheckoutConfig } from './bold.service';

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
    form:     CheckoutForm,
    items:    CartItem[],
    subtotal: number,
    codigoDescuento?: { codigo: string; monto: number },
  ): Promise<{ referencia: string; bold: BoldCheckoutConfig }> {
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
        codigo_descuento: codigoDescuento?.codigo ?? null,
        descuento_monto:  codigoDescuento?.monto  ?? 0,
      },
    });

    if (error) throw new Error(error.message);
    if (!data?.bold?.integritySignature) throw new Error('Respuesta inválida del servidor');
    return data as { referencia: string; bold: BoldCheckoutConfig };
  }

  // Va por RPC y no por la tabla: 'pedidos' ya no tiene lectura anónima, porque
  // con USING (true) la anon key podía volcar los datos personales de todos los
  // clientes. obtener_pedido devuelve un solo pedido y sólo los campos que esta
  // pantalla muestra (sin documento ni celular).
  async obtenerPedido(referencia: string): Promise<PedidoDetalle | null> {
    const { data, error } = await this.supabase.db
      .rpc('obtener_pedido', { p_referencia: referencia });

    if (error || !data) return null;
    return data as PedidoDetalle;
  }
}
