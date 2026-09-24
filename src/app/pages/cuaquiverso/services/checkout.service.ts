// src/app/pages/cuaquiverso/services/checkout.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CartItem } from './cart.service';
import { BoldCheckoutConfig } from './bold.service';
import { mensajeDeErrorEdge } from './edge-error';

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

/** Los cuatro valores que admite `pedidos.estado` (ver 005_pedidos.sql). */
export type EstadoPedido = 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado';

export interface PedidoDetalle {
  id:          string;
  referencia:  string;
  /**
   * Nace 'pendiente' y sólo lo mueve el webhook de Bold. El navegador vuelve de
   * la pasarela por `redirectionUrl` antes —y con independencia— de que ese
   * webhook llegue, así que la confirmación no puede dar por hecho que un
   * pedido que existe es un pedido pagado.
   */
  estado:      EstadoPedido;
  nombre:      string;
  apellido:    string;
  email:       string;
  ciudad:      string;
  direccion:   string;
  barrio:      string | null;
  subtotal:    number;
  total:       number;
  creado_en:   string;
  /**
   * Lo decide y lo guarda el servidor al crear el pedido. Antes la pantalla de
   * confirmación recalculaba la promesa en el cliente con el umbral escrito a
   * mano, y el pedido no registraba en ninguna parte que ese envío iba
   * prepagado: quien empacaba no tenía cómo saberlo.
   */
  envio_gratis: boolean;
  pedido_items: PedidoItem[];
}

/**
 * El token de confirmación no viene suelto en la respuesta de `crear-pedido`:
 * viaja dentro de la `redirectionUrl` que firma el servidor. Sacarlo de ahí es
 * lo que permite al checkout preguntar por el estado del pedido mientras el
 * modal de Bold está abierto, sin tocar la edge function.
 */
export function tokenDeConfirmacion(redirectionUrl: string): string | null {
  try {
    return new URL(redirectionUrl).searchParams.get('ref');
  } catch {
    return null;
  }
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
        // El id es lo que el servidor usa para buscar el precio real; precio y
        // subtotal se envían sólo por compatibilidad y el servidor los ignora.
        items: items.map(i => ({
          id:       i.id,
          nombre:   i.name,
          sub:      i.sub,
          precio:   i.price,
          cantidad: i.qty,
          color:    i.color,
        })),
        subtotal,
        codigo_descuento: codigoDescuento?.codigo ?? null,
      },
    });

    // `error.message` es siempre la cadena genérica de supabase-js; el motivo
    // que el comprador necesita leer ("sólo quedan 2 de...") está en el cuerpo.
    if (error) {
      throw new Error(await mensajeDeErrorEdge(
        error,
        'No pudimos crear tu pedido. Revisa tu conexión e intenta de nuevo.',
      ));
    }
    if (!data?.bold?.integritySignature) throw new Error('Respuesta inválida del servidor');
    return data as { referencia: string; bold: BoldCheckoutConfig };
  }

  // Va por RPC y no por la tabla: 'pedidos' ya no tiene lectura anónima, porque
  // con USING (true) la anon key podía volcar los datos personales de todos los
  // clientes. obtener_pedido devuelve un solo pedido y sólo los campos que esta
  // pantalla muestra (sin documento ni celular).
  //
  // Lanza si la lectura falla y devuelve null sólo si el token no corresponde a
  // ningún pedido: antes los dos casos se colapsaban en null y a quien acababa
  // de pagar con una red inestable se le decía que su pedido no existía.
  async obtenerPedido(token: string): Promise<PedidoDetalle | null> {
    const { data, error } = await this.supabase.db
      .rpc('obtener_pedido', { p_token: token });

    if (error) {
      throw new Error('No pudimos consultar tu pedido. Revisa tu conexión e intenta de nuevo.');
    }
    return (data as PedidoDetalle | null) ?? null;
  }

  /**
   * Respaldo del webhook de Bold. Le pide a la edge function `verificar-pago`
   * que consulte —servidor a servidor— el estado real de la venta en Bold y,
   * si ya está pagada, mueva el pedido. Se llama desde la confirmación mientras
   * el pedido sigue 'pendiente', por si el webhook de Bold no llega.
   *
   * `boldOrderId` es el identificador que Bold añade a la URL de retorno
   * (`bold-order-id`) e identifica la venta concreta. Devuelve el estado que
   * quedó, o null si no se pudo verificar (un fallo aquí no rompe el sondeo).
   */
  async verificarPago(referencia: string, boldOrderId?: string | null): Promise<EstadoPedido | null> {
    try {
      const { data, error } = await this.supabase.db.functions.invoke('verificar-pago', {
        body: { referencia, boldOrderId: boldOrderId ?? null },
      });
      if (error || !data?.ok) return null;
      return (data.estado as EstadoPedido) ?? null;
    } catch {
      return null;
    }
  }
}
