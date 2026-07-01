import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface CodigoDescuento {
  id:             string;
  codigo:         string;
  tipo:           'porcentaje' | 'fijo';
  valor:          number;
  minimo_orden:   number;
  limite_usos:    number | null;
  usos_actuales:  number;
  productos_ids:  string[] | null;
  categorias_ids: string[] | null;
  activo:         boolean;
  expira_en:      string | null;
  creado_en:      string;
  actualizado_en: string;
}

export type CodigoDescuentoInput = Omit<CodigoDescuento,
  'id' | 'usos_actuales' | 'creado_en' | 'actualizado_en'>;

export interface UsoDescuento {
  referencia:      string;
  creado_en:       string;
  descuento_monto: number;
}

@Injectable({ providedIn: 'root' })
export class DescuentosAdminService {
  private sb = inject(SupabaseService);

  async listar(): Promise<CodigoDescuento[]> {
    const { data, error } = await this.sb.db
      .from('codigos_descuento')
      .select('*')
      .order('creado_en', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CodigoDescuento[];
  }

  async crear(input: CodigoDescuentoInput): Promise<void> {
    const { error } = await this.sb.db
      .from('codigos_descuento')
      .insert({ ...input, codigo: input.codigo.toUpperCase().trim() });
    if (error) throw new Error(error.message);
  }

  async actualizar(id: string, input: Partial<CodigoDescuentoInput>): Promise<void> {
    const { error } = await this.sb.db
      .from('codigos_descuento')
      .update({ ...input, actualizado_en: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.sb.db
      .from('codigos_descuento')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async usosPorCodigo(codigo: string): Promise<UsoDescuento[]> {
    const { data, error } = await this.sb.db
      .from('pedidos')
      .select('referencia, creado_en, descuento_monto')
      .eq('codigo_descuento', codigo)
      .order('creado_en', { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    return (data ?? []) as UsoDescuento[];
  }
}
