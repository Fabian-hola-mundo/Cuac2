import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ProductoEvento {
  id: string;
  evento_id: string | null;
  nombre: string;
  categoria: string;
  personaje: string | null;
  precio: number;
  stock_inicial: number;
  stock_actual: number;
  activo: boolean;
  creado_en: string;
  cover_url: string | null;
  fotos: string[];
  material: string[];
  color: string | null;
  flag: string | null;
  descripcion: string | null;
}

export interface VentaEvento {
  id: string;
  producto_id: string;
  cantidad: number;
  dispositivo: string | null;
  vendido_en: string;
  sincronizado: boolean;
  canal: 'evento' | 'web';
  evento_id: string;
  productos_evento?: { nombre: string; categoria: string; precio?: number };
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

export const CAT_TONES: Record<string, string> = {
  tote: '#C9D9F6', llavero: '#FCEFC2', gorra: '#D7EBDD',
  pañoleta: '#FCE0EC', sticker: '#E5DDF7', amigurumi: '#FBE0D5',
  charm: '#DDE3EA',
};

export const CHARACTERS = [
  { id: 'cuac',       label: 'Cuac'       },
  { id: 'yeison',     label: 'Yeison'     },
  { id: 'roar',       label: 'Roar'       },
  { id: 'kiki',       label: 'Kiki'       },
  { id: 'abejandro',  label: 'Abejandro'  },
  { id: 'atolita',    label: 'Atolita'    },
  { id: 'colibriana', label: 'Colibriana' },
  { id: 'tiburcio',   label: 'Tiburcio'   },
];

@Injectable({ providedIn: 'root' })
export class InventarioService {
  readonly productos = signal<ProductoEvento[]>([]);
  readonly cargando  = signal(false);
  readonly error     = signal<string | null>(null);

  constructor(private sb: SupabaseService) {}

  /** Carga TODOS los productos (catálogo global — sin filtrar por evento) */
  async cargarTodos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    const { data, error } = await this.sb.db
      .from('productos_evento')
      .select('*')
      .order('creado_en', { ascending: false });
    if (error) {
      this.error.set(error.message);
      this.cargando.set(false);
      return;
    }
    this.productos.set(
      (data ?? []).map(p => ({
        ...p,
        fotos:    p.fotos    ?? [],
        material: p.material ?? [],
      }))
    );
    this.cargando.set(false);
  }

  /** Mantiene compatibilidad con el POS — filtra por evento activo */
  async cargarProductos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    const { data, error } = await this.sb.db
      .from('productos_evento')
      .select('*')
      .eq('evento_id', EVENTO_ACTIVO)
      .order('creado_en', { ascending: false });
    if (error) {
      this.error.set(error.message);
      this.cargando.set(false);
      return;
    }
    this.productos.set(data ?? []);
    this.cargando.set(false);
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
    await this.cargarTodos();
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
    await this.cargarTodos();
    return { error: null };
  }

  async duplicarProducto(id: string): Promise<{ error: string | null }> {
    const original = await this.getProducto(id);
    if (!original) return { error: 'Producto no encontrado' };
    const { id: _id, creado_en: _ce, stock_actual: _sa, ...rest } = original;
    const { error } = await this.sb.db
      .from('productos_evento')
      .insert({ ...rest, nombre: `${rest.nombre} (copia)`, stock_actual: rest.stock_inicial });
    if (error) return { error: error.message };
    await this.cargarTodos();
    return { error: null };
  }

  async toggleActivo(id: string, activo: boolean): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('productos_evento')
      .update({ activo })
      .eq('id', id);
    if (error) return { error: error.message };
    await this.cargarTodos();
    return { error: null };
  }

  async getVentas(
    desde?: string,
    hasta?: string,
    canal?: 'evento' | 'web'
  ): Promise<VentaEvento[]> {
    let q = this.sb.db
      .from('ventas_evento')
      .select('*, productos_evento(nombre, categoria, precio, evento_id)')
      .order('vendido_en', { ascending: false });
    if (desde) q = q.gte('vendido_en', `${desde}T00:00:00`);
    if (hasta) q = q.lte('vendido_en', `${hasta}T23:59:59`);
    if (canal) q = q.eq('canal', canal);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async uploadProductoImage(
    productoId: string,
    file: File,
    name: string
  ): Promise<{ url: string | null; error: string | null }> {
    const safeName = name.replace(/[^a-z0-9._-]/gi, '_');
    const path = `${productoId}/${safeName}`;
    const { error } = await this.sb.db.storage
      .from('productos')
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) return { url: null, error: error.message };
    const { data } = this.sb.db.storage
      .from('productos')
      .getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

}
