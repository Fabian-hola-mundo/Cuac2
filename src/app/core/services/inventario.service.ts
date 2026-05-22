import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ProductoEvento {
  id: string;
  evento_id: string;
  nombre: string;
  categoria: string;
  precio: number;
  stock_inicial: number;
  stock_actual: number;
  activo: boolean;
  creado_en: string;
}

export interface VentaEvento {
  id: string;
  producto_id: string;
  cantidad: number;
  dispositivo: string | null;
  vendido_en: string;
  sincronizado: boolean;
  productos_evento?: { nombre: string; categoria: string };
}

export const EVENTO_ACTIVO = 'sofa-2026';

export const CATEGORIAS = [
  { id: 'tote',      label: 'Tote bags'  },
  { id: 'llavero',   label: 'Llaveros'   },
  { id: 'gorra',     label: 'Gorras'     },
  { id: 'pañoleta',  label: 'Pañoletas'  },
  { id: 'sticker',   label: 'Stickers'   },
  { id: 'amigurumi', label: 'Amigurumis' },
  { id: 'charm',     label: 'Charms'     },
];

@Injectable({ providedIn: 'root' })
export class InventarioService {
  readonly productos = signal<ProductoEvento[]>([]);
  readonly cargando  = signal(false);
  readonly error     = signal<string | null>(null);

  constructor(private sb: SupabaseService) {}

  async cargarProductos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    const { data, error } = await this.sb.db
      .from('productos_evento')
      .select('*')
      .eq('evento_id', EVENTO_ACTIVO)
      .order('creado_en', { ascending: false });
    this.cargando.set(false);
    if (error) { this.error.set(error.message); return; }
    this.productos.set(data ?? []);
  }

  async getProducto(id: string): Promise<ProductoEvento | null> {
    const { data, error } = await this.sb.db
      .from('productos_evento')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  async createProducto(
    payload: Omit<ProductoEvento, 'id' | 'creado_en' | 'stock_actual'>
  ): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('productos_evento')
      .insert({ ...payload, stock_actual: payload.stock_inicial });
    if (error) return { error: error.message };
    await this.cargarProductos();
    return { error: null };
  }

  async updateProducto(
    id: string,
    payload: Partial<Omit<ProductoEvento, 'id' | 'creado_en' | 'stock_actual'>>
  ): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('productos_evento')
      .update(payload)
      .eq('id', id);
    if (error) return { error: error.message };
    await this.cargarProductos();
    return { error: null };
  }

  async getVentas(desde?: string, hasta?: string): Promise<VentaEvento[]> {
    let q = this.sb.db
      .from('ventas_evento')
      .select('*, productos_evento(nombre, categoria)')
      .order('vendido_en', { ascending: false });
    if (desde) q = q.gte('vendido_en', `${desde}T00:00:00`);
    if (hasta) q = q.lte('vendido_en', `${hasta}T23:59:59`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }
}
