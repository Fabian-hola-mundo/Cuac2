import { Injectable, signal } from '@angular/core';
import type { Combinacion, OpcionDef, ValorOpcion } from '../../../../supabase/functions/_shared/variantes';
import { SupabaseService } from './supabase.service';
import { validarImagen } from '../../pages/admin/productos/galeria';
import { comprimirImagen, conExtension } from '../../pages/admin/productos/comprimir-imagen';
import {
  BUCKET_PRODUCTOS,
  planCopiaImagenes,
  rutaImagen,
} from '../../pages/admin/productos/productos-storage';

export type { Combinacion, OpcionDef, ValorOpcion };

export interface ProductoOpcion { nombre: string; posicion: number; valores: ValorOpcion[] }

export interface ProductoVariante {
  id: string;
  producto_id: string;
  opciones: Combinacion;
  precio: number | null;
  stock_actual: number;
  activo: boolean;
  posicion: number;
}

/** Variante como la ve la tienda: `disponible` ya descuenta reservas vigentes. */
export interface VariantePublica extends ProductoVariante { disponible: number }

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
  destacado: boolean;
  descripcion: string | null;
}

/**
 * Lo que la tienda pública necesita de un producto. `cargarTodos()` bajaba el
 * catálogo entero con `select('*')` —fotos, descripción, stock_inicial,
 * evento_id— para pintar una grilla que usa trece campos.
 */
export type ProductoPublico = Pick<
  ProductoEvento,
  | 'id' | 'nombre' | 'categoria' | 'personaje' | 'precio' | 'stock_actual'
  | 'activo' | 'creado_en' | 'cover_url' | 'color' | 'flag' | 'material' | 'destacado'
> & {
  /** true si tiene al menos una variante activa: el «+» de la tarjeta lleva a la ficha. */
  tieneVariantes?: boolean;
  precioMin?: number;
  precioMax?: number;
};

const COLUMNAS_PUBLICAS =
  'id, nombre, categoria, personaje, precio, stock_actual, activo, creado_en, cover_url, color, flag, material, destacado';

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
  variante_id?: string | null;
  producto_variantes?: { opciones: Combinacion } | null;
}

export interface MovimientoProducto {
  tipo: 'creacion' | 'restock' | 'ajuste' | 'venta';
  cantidad: number;   // positivo = entrada de stock, negativo = salida (venta)
  nota: string | null;
  fecha: string;       // ISO timestamp
}

export const EVENTO_ACTIVO = 'sofa-2026';

export const CATEGORIAS = [
  { id: 'tee',       label: 'Camisetas'  },
  { id: 'tote',      label: 'Tote bags'  },
  { id: 'libreta',   label: 'Libretas'   },
  { id: 'sticker',   label: 'Stickers'   },
  { id: 'pin',       label: 'Pines'      },
  { id: 'llavero',   label: 'Llaveros'   },
  { id: 'gorra',     label: 'Gorras'     },
  { id: 'pañoleta',  label: 'Pañoletas'  },
  { id: 'peluche',   label: 'Peluches'   },
  { id: 'print',     label: 'Prints'     },
  { id: 'amigurumi', label: 'Amigurumis' },
  { id: 'charm',     label: 'Charms'     },
];

/**
 * `productos_evento.categoria` es texto libre, así que una categoría nueva es
 * sólo un id que no está en CATEGORIAS. Estos dos helpers son los que permiten
 * crear categorías sin tabla ni migración: el formulario slugifica lo que se
 * escribe y la tienda sabe mostrar una etiqueta legible para lo que no conoce.
 */
const SIN_TILDE: Record<string, string> = {
  'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u',
};

export function slugCategoria(texto: string): string {
  return texto
    .trim().toLowerCase()
    // Se quitan las tildes pero se conserva la ñ: 'pañoleta' ya es un id del
    // catálogo fijo y normalizarla a 'panoleta' partiría en dos la categoría.
    .replace(/[áéíóúü]/g, c => SIN_TILDE[c])
    .replace(/[^a-z0-9ñ]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Etiqueta de una categoría: la del catálogo fijo, o el id capitalizado. */
export function etiquetaCategoria(id: string): string {
  const conocida = CATEGORIAS.find(c => c.id === id);
  if (conocida) return conocida.label;
  return capitalizar(id.replace(/-/g, ' '));
}

/**
 * Los materiales pasaron de ser cinco casillas con id a texto libre. Los
 * productos viejos guardaron el id ('algodon'), así que se traduce; lo escrito
 * a mano se muestra tal cual.
 */
const MATERIALES_LEGADO: Record<string, string> = {
  algodon: 'Algodón orgánico',
  lona:    'Lona reciclada',
  papel:   'Papel reciclado',
  vinilo:  'Vinilo mate',
  esmalte: 'Esmalte / metal',
};

export function etiquetaMaterial(valor: string): string {
  return MATERIALES_LEGADO[valor] ?? capitalizar(valor.trim());
}

/**
 * Etiquetas especiales del catálogo fijo. A diferencia de las categorías, el
 * valor de `flag` es el texto que se pinta en la insignia, así que una etiqueta
 * nueva se guarda tal cual se escribe (no slugificada): "Edición limitada" debe
 * verse con su tilde en la tarjeta.
 */
export const ETIQUETAS_FIJAS = [
  { id: 'new',  label: 'Nuevo'             },
  { id: 'last', label: 'Últimas unidades'  },
];

/** Una insignia no puede ser un párrafo: entra en una esquina de la tarjeta. */
export const MAX_LARGO_ETIQUETA = 22;

export function etiquetaFlag(flag: string | null | undefined): string {
  if (!flag) return '';
  return ETIQUETAS_FIJAS.find(e => e.id === flag)?.label ?? flag.trim();
}

/** true si la etiqueta la escribió el admin y no es una de las fijas. */
export function esEtiquetaPropia(flag: string | null | undefined): boolean {
  return !!flag && !ETIQUETAS_FIJAS.some(e => e.id === flag);
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

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

  /** Catálogo de la tienda pública: sólo productos activos y columnas visibles. */
  readonly catalogo         = signal<ProductoPublico[]>([]);
  readonly cargandoCatalogo = signal(false);
  readonly errorCatalogo    = signal<string | null>(null);

  constructor(private sb: SupabaseService) {}

  /**
   * Carga el catálogo público. Devuelve el error en una señal propia porque la
   * tienda tiene que poder distinguir "no hay productos" de "no pudimos
   * cargarlos": antes un Supabase caído se veía como "La tienda está siendo
   * preparada. Vuelve pronto."
   */
  async cargarCatalogo(): Promise<void> {
    this.cargandoCatalogo.set(true);
    this.errorCatalogo.set(null);
    const [prodRes, dispRes] = await Promise.all([
      this.sb.db
        .from('productos_evento')
        .select(`${COLUMNAS_PUBLICAS}, producto_variantes(precio, activo)`)
        .eq('activo', true)
        .order('creado_en', { ascending: false }),
      this.sb.db.rpc('stock_disponible'),
    ]);
    if (prodRes.error) {
      this.errorCatalogo.set(prodRes.error.message);
      this.cargandoCatalogo.set(false);
      return;
    }
    // Si falla la lectura de reservas se muestra el stock físico: el servidor
    // vuelve a validar al crear el pedido.
    const disponible = new Map<string, number>(
      ((dispRes.data ?? []) as { producto_id: string; variante_id: string | null; disponible: number }[])
        .filter(r => r.variante_id === null)
        .map(r => [r.producto_id, r.disponible]),
    );
    this.catalogo.set(
      ((prodRes.data ?? []) as any[]).map(({ producto_variantes, ...p }) => {
        const activas = ((producto_variantes ?? []) as { precio: number | null; activo: boolean }[]).filter(v => v.activo);
        const precios = activas.map(v => v.precio ?? p.precio);
        return {
          ...p,
          material: p.material ?? [],
          stock_actual: disponible.get(p.id) ?? p.stock_actual,
          tieneVariantes: activas.length > 0,
          precioMin: precios.length ? Math.min(...precios) : p.precio,
          precioMax: precios.length ? Math.max(...precios) : p.precio,
        } as ProductoPublico;
      }),
    );
    this.cargandoCatalogo.set(false);
  }

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

  /**
   * Categorías realmente en uso, para que una categoría nueva aparezca en el
   * formulario y en los filtros sin tener que tocar la lista fija.
   */
  async getCategoriasUsadas(): Promise<string[]> {
    const { data, error } = await this.sb.db
      .from('productos_evento')
      .select('categoria');
    if (error) return [];
    return [...new Set((data ?? []).map(p => p.categoria).filter(Boolean))] as string[];
  }

  /** Etiquetas especiales ya escritas, para reusarlas sin volver a teclearlas. */
  async getEtiquetasUsadas(): Promise<string[]> {
    const { data, error } = await this.sb.db
      .from('productos_evento')
      .select('flag');
    if (error) return [];
    return [...new Set((data ?? []).map(p => p.flag).filter(Boolean))] as string[];
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

  /**
   * Igual que `getProducto` pero separando "no existe" de "no se pudo leer".
   * La ficha pública mostraba "Este producto no existe o ya no está disponible"
   * ante cualquier fallo de red, y el visitante se iba creyendo que el producto
   * había desaparecido.
   */
  async getProductoPublico(id: string): Promise<{
    producto: ProductoEvento | null;
    opciones: ProductoOpcion[];
    variantes: VariantePublica[];
    error: string | null;
  }> {
    const vacio = { producto: null, opciones: [], variantes: [] };
    const [prodRes, opRes, varRes, dispRes] = await Promise.all([
      this.sb.db.from('productos_evento').select('*').eq('id', id).maybeSingle(),
      this.sb.db.from('producto_opciones').select('nombre, posicion, valores').eq('producto_id', id).order('posicion'),
      this.sb.db.from('producto_variantes').select('*').eq('producto_id', id).eq('activo', true).order('posicion'),
      this.sb.db.rpc('stock_disponible', { p_producto_ids: [id] }),
    ]);
    const error = prodRes.error ?? opRes.error ?? varRes.error;
    if (error) return { ...vacio, error: error.message };
    if (!prodRes.data) return { ...vacio, error: null };

    const disp = new Map<string | null, number>(
      ((dispRes.data ?? []) as { variante_id: string | null; disponible: number }[])
        .map(r => [r.variante_id, r.disponible]),
    );
    const producto = { ...prodRes.data, stock_actual: disp.get(null) ?? prodRes.data.stock_actual } as ProductoEvento;
    const variantes = ((varRes.data ?? []) as ProductoVariante[])
      .map(v => ({ ...v, disponible: disp.get(v.id) ?? v.stock_actual }));
    return { producto, opciones: (opRes.data ?? []) as ProductoOpcion[], variantes, error: null };
  }

  /** Opciones y TODAS las variantes (también inactivas) para el admin. */
  async getVariantesAdmin(productoId: string): Promise<{ opciones: ProductoOpcion[]; variantes: ProductoVariante[] }> {
    const [opRes, varRes] = await Promise.all([
      this.sb.db.from('producto_opciones').select('nombre, posicion, valores').eq('producto_id', productoId).order('posicion'),
      this.sb.db.from('producto_variantes').select('*').eq('producto_id', productoId).order('posicion'),
    ]);
    if (opRes.error) throw opRes.error;
    if (varRes.error) throw varRes.error;
    return { opciones: (opRes.data ?? []) as ProductoOpcion[], variantes: (varRes.data ?? []) as ProductoVariante[] };
  }

  /** Variantes (todas) y orden de opciones de cada producto, para la lista del admin. */
  async getVariantesTodas(): Promise<Map<string, { orden: string[]; variantes: ProductoVariante[] }>> {
    const [opRes, varRes] = await Promise.all([
      this.sb.db.from('producto_opciones').select('producto_id, nombre, posicion'),
      this.sb.db.from('producto_variantes').select('*').order('posicion'),
    ]);
    if (opRes.error) throw opRes.error;
    if (varRes.error) throw varRes.error;
    const m = new Map<string, { orden: string[]; variantes: ProductoVariante[] }>();
    for (const v of (varRes.data ?? []) as ProductoVariante[]) {
      if (!m.has(v.producto_id)) m.set(v.producto_id, { orden: [], variantes: [] });
      m.get(v.producto_id)!.variantes.push(v);
    }
    const ops = ((opRes.data ?? []) as { producto_id: string; nombre: string; posicion: number }[])
      .sort((a, b) => a.posicion - b.posicion);
    for (const o of ops) m.get(o.producto_id)?.orden.push(o.nombre);
    return m;
  }

  async guardarVariantes(
    productoId: string,
    opciones: OpcionDef[],
    variantes: { opciones: Combinacion; precio: number | null; stock_inicial: number; activo: boolean }[],
  ): Promise<{ resultado: { creadas: number; actualizadas: number; desactivadas: number } | null; error: string | null }> {
    const { data, error } = await this.sb.db.rpc('guardar_variantes', {
      p_producto_id: productoId,
      p_opciones: opciones,
      p_variantes: variantes,
    });
    if (error) return { resultado: null, error: error.message };
    return { resultado: data, error: null };
  }

  /**
   * Inserta y devuelve el id real. El formulario lo necesita para subir las
   * imágenes a la carpeta definitiva del producto en vez de a una temporal.
   */
  async createProducto(
    payload: Omit<ProductoEvento, 'id' | 'creado_en' | 'stock_actual'>
  ): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await this.sb.db
      .from('productos_evento')
      .insert({ ...payload, stock_actual: payload.stock_inicial })
      .select('id')
      .single();
    if (error) return { id: null, error: error.message };
    await this.cargarTodos();
    return { id: data.id as string, error: null };
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
    this.parchear(id, payload);
    return { error: null };
  }

  /**
   * Duplica el producto y, con él, sus imágenes: el duplicado estrena copias en
   * su propia carpeta de Storage. Antes heredaba las URLs del original, así que
   * los dos productos compartían archivo y editar la portada de uno cambiaba la
   * del otro.
   */
  async duplicarProducto(id: string): Promise<{ error: string | null; aviso: string | null }> {
    const original = await this.getProducto(id);
    if (!original) return { error: 'Producto no encontrado', aviso: null };
    const { id: _id, creado_en: _ce, stock_actual: _sa, ...rest } = original;

    const { data, error } = await this.sb.db
      .from('productos_evento')
      .insert({
        ...rest,
        nombre: `${rest.nombre} (copia)`,
        stock_actual: rest.stock_inicial,
        cover_url: null,
        fotos: [],
      })
      .select('id')
      .single();
    if (error) return { error: error.message, aviso: null };

    const bucket = this.sb.db.storage.from(BUCKET_PRODUCTOS);
    const plan = planCopiaImagenes(
      { cover_url: original.cover_url, fotos: original.fotos },
      data.id as string,
      ruta => bucket.getPublicUrl(ruta).data.publicUrl,
    );

    // Si una copia falla, el duplicado se queda sin esa imagen pero existe y es
    // editable: preferible a abortar dejando el registro a medias.
    const copiadas = await Promise.all(
      plan.copias.map(async c => !(await bucket.copy(c.from, c.to)).error),
    );
    if (copiadas.some(Boolean)) {
      await this.sb.db
        .from('productos_evento')
        .update({ cover_url: plan.cover_url, fotos: plan.fotos })
        .eq('id', data.id);
    }

    // Las fotos por valor apuntan a URLs del original; se conservan (archivos
    // públicos del original). El admin puede reasignarlas.
    let variantesFallaron = false;
    try {
      const { opciones, variantes } = await this.getVariantesAdmin(id);
      if (opciones.length > 0) {
        const { error: errVar } = await this.guardarVariantes(
          data.id as string,
          opciones.map(o => ({ nombre: o.nombre, valores: o.valores })),
          variantes.filter(v => v.activo).map(v => ({ opciones: v.opciones, precio: v.precio, stock_inicial: 0, activo: true })),
        );
        if (errVar) variantesFallaron = true;
      }
    } catch {
      variantesFallaron = true;
    }

    await this.cargarTodos();
    // El duplicado existe y es editable; sólo hay que avisar si le faltan fotos o variantes.
    const avisos: string[] = [];
    if (copiadas.includes(false)) {
      avisos.push('Duplicado creado, pero alguna imagen no se copió. Revísalo antes de publicarlo.');
    }
    if (variantesFallaron) {
      avisos.push('Duplicado creado, pero no se copiaron las variantes. Revísalas antes de publicarlo.');
    }
    return { error: null, aviso: avisos.length ? avisos.join(' ') : null };
  }

  async toggleActivo(id: string, activo: boolean): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('productos_evento')
      .update({ activo })
      .eq('id', id);
    if (error) return { error: error.message };
    this.parchear(id, { activo });
    return { error: null };
  }

  async restockProducto(
    productoId: string,
    cantidad: number,
    nota?: string,
    varianteId: string | null = null,
  ): Promise<{ error: string | null }> {
    const { error } = await this.sb.db.rpc('registrar_restock', {
      p_producto_id: productoId,
      p_cantidad: cantidad,
      p_nota: nota || null,
      p_variante_id: varianteId,
    });
    if (error) return { error: error.message };
    if (varianteId) {
      // El trigger cambió el total del producto.
      await this.cargarTodos();
    } else {
      const actual = this.productos().find(p => p.id === productoId)?.stock_actual ?? 0;
      this.parchear(productoId, { stock_actual: actual + cantidad });
    }
    return { error: null };
  }

  /** Fija el stock a un valor absoluto y registra el delta como movimiento de ajuste. */
  async ajustarStock(
    productoId: string,
    nuevoStock: number,
    nota?: string,
    varianteId: string | null = null,
  ): Promise<{ error: string | null }> {
    const { error } = await this.sb.db.rpc('registrar_ajuste', {
      p_producto_id: productoId,
      p_nuevo_stock: nuevoStock,
      p_nota: nota || null,
      p_variante_id: varianteId,
    });
    if (error) return { error: error.message };
    if (varianteId) {
      await this.cargarTodos();
    } else {
      this.parchear(productoId, { stock_actual: nuevoStock });
    }
    return { error: null };
  }

  /**
   * Aplica el cambio sobre la señal en vez de recargar el catálogo entero.
   * Un toggle de visibilidad no justifica volver a bajar toda la tabla.
   */
  private parchear(id: string, cambios: Partial<ProductoEvento>): void {
    this.productos.update(list =>
      list.map(p => (p.id === id ? { ...p, ...cambios } : p)),
    );
  }

  async getHistorialProducto(
    productoId: string,
    varianteId: string | null = null,
  ): Promise<MovimientoProducto[]> {
    let movQ = this.sb.db
      .from('producto_movimientos')
      .select('tipo, cantidad, nota, creado_en')
      .eq('producto_id', productoId);
    let ventasQ = this.sb.db
      .from('ventas_evento')
      .select('cantidad, vendido_en')
      .eq('producto_id', productoId);
    if (varianteId) {
      movQ = movQ.eq('variante_id', varianteId);
      ventasQ = ventasQ.eq('variante_id', varianteId);
    }
    const [movRes, ventasRes] = await Promise.all([movQ, ventasQ]);
    if (movRes.error) throw movRes.error;
    if (ventasRes.error) throw ventasRes.error;

    const movimientos: MovimientoProducto[] = (movRes.data ?? []).map(m => ({
      tipo: m.tipo as MovimientoProducto['tipo'],
      cantidad: m.cantidad,
      nota: m.nota ?? null,
      fecha: m.creado_en,
    }));

    const ventas: MovimientoProducto[] = (ventasRes.data ?? []).map(v => ({
      tipo: 'venta' as const,
      cantidad: -v.cantidad,
      nota: null,
      fecha: v.vendido_en,
    }));

    return [...movimientos, ...ventas].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }

  async getVentas(
    desde?: string,
    hasta?: string,
    canal?: 'evento' | 'web'
  ): Promise<VentaEvento[]> {
    let q = this.sb.db
      .from('ventas_evento')
      .select('*, productos_evento(nombre, categoria, precio, evento_id), producto_variantes(opciones)')
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
    // Última línea de defensa: el formulario ya valida al elegir el archivo,
    // pero nada garantiza que sea el único que llame aquí.
    const invalida = validarImagen(file);
    if (invalida) return { url: null, error: invalida };

    // Se guarda una versión de 1600px de lado en vez del original del celular.
    // Si la compresión falla se sube el archivo tal cual: mejor una foto pesada
    // que un producto sin foto.
    const comprimida = await comprimirImagen(file);
    const cuerpo     = comprimida?.blob ?? file;
    const nombre     = comprimida ? conExtension(name, comprimida.ext) : name;

    const path = rutaImagen(productoId, nombre);
    const { error } = await this.sb.db.storage
      .from(BUCKET_PRODUCTOS)
      .upload(path, cuerpo, { upsert: true, contentType: cuerpo.type || file.type || undefined });
    if (error) return { url: null, error: error.message };
    const { data } = this.sb.db.storage
      .from(BUCKET_PRODUCTOS)
      .getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

}
