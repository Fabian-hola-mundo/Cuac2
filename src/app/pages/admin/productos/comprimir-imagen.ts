// Redimensiona y recomprime las fotos de producto antes de subirlas a Storage.
//
// Antes se subía el `File` tal cual: una foto de celular de 4032×3024 y ~4 MB
// terminaba sirviéndose completa en una miniatura de 180px de la grilla y en la
// caja de 340px de la ficha. Con doce productos visibles eso son decenas de MB
// en datos móviles, y el LCP de la ficha es esa misma foto.
//
// Se hace en el navegador del admin, una sola vez por imagen, en vez de
// transformar en cada visita: no hay servicio de transformación en el plan
// actual de Supabase Storage.

/** Lado mayor de la imagen guardada. Suficiente para zoom en la ficha. */
export const MAX_LADO = 1600;

const CALIDAD = 0.82;

export interface ImagenComprimida {
  blob: Blob;
  /** Extensión que corresponde al tipo resultante ('webp' o 'jpg'). */
  ext: string;
}

/** Reescribe la extensión del nombre para que coincida con el tipo real. */
export function conExtension(nombre: string, ext: string): string {
  const base = nombre.replace(/\.[^.]+$/, '');
  return `${base}.${ext}`;
}

/**
 * Devuelve la versión comprimida, o null si no se pudo (formato no soportado,
 * canvas bloqueado, imagen corrupta). El llamador sube el original en ese caso:
 * una foto pesada es mejor que un producto sin foto.
 */
export async function comprimirImagen(file: File): Promise<ImagenComprimida | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
  const ancho  = Math.round(bitmap.width  * escala);
  const alto   = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width  = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); return null; }
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  // WebP donde se pueda; si el navegador no lo soporta, toBlob devuelve PNG y
  // el fallback a JPEG evita subir un PNG gigante creyendo que es WebP.
  const webp = await aBlob(canvas, 'image/webp');
  if (webp && webp.type === 'image/webp') {
    return webp.size < file.size ? { blob: webp, ext: 'webp' } : null;
  }

  const jpeg = await aBlob(canvas, 'image/jpeg');
  if (jpeg && jpeg.type === 'image/jpeg' && jpeg.size < file.size) {
    return { blob: jpeg, ext: 'jpg' };
  }
  return null;
}

function aBlob(canvas: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, tipo, CALIDAD));
}
