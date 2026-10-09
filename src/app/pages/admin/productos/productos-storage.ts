// Rutas de Supabase Storage para las imágenes de producto.
//
// Cada producto es dueño de su carpeta `<id>/`. Antes esto no se cumplía en dos
// sitios: al crear se subía a una carpeta `tmp_<timestamp>/` que nunca se
// reasignaba, y al duplicar se copiaban las URLs del original, de modo que dos
// productos compartían los mismos archivos físicos.

export const BUCKET_PRODUCTOS = 'productos';

const MARCA_URL_PUBLICA = `/storage/v1/object/public/${BUCKET_PRODUCTOS}/`;

/** Ruta dentro del bucket. El nombre se sanea para que no escape de la carpeta. */
export function rutaImagen(productoId: string, nombre: string): string {
  return `${productoId}/${nombre.replace(/[^a-z0-9.-]/gi, '_')}`;
}

/** Ruta interna de una URL pública del bucket, o null si la URL es ajena. */
export function rutaDesdeUrlPublica(url: string): string | null {
  const i = url.indexOf(MARCA_URL_PUBLICA);
  if (i === -1) return null;
  const ruta = url.slice(i + MARCA_URL_PUBLICA.length).split('?')[0];
  return ruta || null;
}

export interface ImagenesProducto {
  cover_url: string | null;
  fotos: string[];
}

export interface PlanCopia extends ImagenesProducto {
  copias: { from: string; to: string }[];
}

/** Resuelve la URL pública de una ruta del bucket (lo aporta el cliente de Supabase). */
export type ResolverUrl = (ruta: string) => string;

/**
 * Reubica las imágenes de un producto en la carpeta de otro. Devuelve las copias
 * que hay que ejecutar en Storage y las URLs que debe guardar el producto nuevo.
 * Las URLs ajenas al bucket se conservan tal cual: no son nuestras para copiar.
 */
export function planCopiaImagenes(
  original: ImagenesProducto,
  nuevoId: string,
  resolverUrl: ResolverUrl = ruta => ruta,
): PlanCopia {
  const copias: { from: string; to: string }[] = [];

  const reubicar = (url: string): string => {
    const from = rutaDesdeUrlPublica(url);
    if (!from) return url;
    const to = rutaImagen(nuevoId, from.split('/').pop()!);
    copias.push({ from, to });
    return resolverUrl(to);
  };

  return {
    copias,
    cover_url: original.cover_url ? reubicar(original.cover_url) : null,
    fotos: original.fotos.map(reubicar),
  };
}
