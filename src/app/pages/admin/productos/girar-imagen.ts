// Giro de fotos en el navegador del admin, en pasos de 90°, y carga de imágenes
// aptas para editarse en un lienzo. Lo usa el editor de imagen (portada y galería).
import { MAX_LADO } from './comprimir-imagen';

export type Giro = 0 | 90 | 180 | 270;

/** Normaliza cualquier múltiplo de 90 (también negativos) a 0–270. */
export function normalizarGiro(grados: number): Giro {
  return ((((Math.round(grados / 90) * 90) % 360) + 360) % 360) as Giro;
}

/** Medidas de la foto después de girarla, ya limitadas a `maxLado`. */
export function medidasGiradas(
  ancho: number, alto: number, grados: number, maxLado = MAX_LADO,
): { ancho: number; alto: number } {
  const g = normalizarGiro(grados);
  const [w, h] = g === 90 || g === 270 ? [alto, ancho] : [ancho, alto];
  const k = Math.min(1, maxLado / Math.max(w, h));
  return { ancho: Math.round(w * k), alto: Math.round(h * k) };
}

/**
 * Carga una imagen apta para dibujar en un lienzo y exportarlo. Una foto ya
 * guardada puede estar en caché sin cabeceras CORS (la pintó un <img> normal) y
 * eso "ensucia" el lienzo: se pide con un parámetro aparte para esquivar esa caché.
 */
export function cargarImagen(src: string): Promise<HTMLImageElement> {
  const url = /^(blob|data):/.test(src) ? src : `${src}${src.includes('?') ? '&' : '?'}edicion=${Date.now()}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.src = url;
  });
}

/** Dibuja la foto girada en un lienzo nuevo (como mucho de `maxLado` px de lado). */
export function lienzoGirado(img: HTMLImageElement, grados: number, maxLado = MAX_LADO): HTMLCanvasElement {
  const g = normalizarGiro(grados);
  const { ancho, alto } = medidasGiradas(img.naturalWidth, img.naturalHeight, g, maxLado);
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(ancho / 2, alto / 2);
  ctx.rotate((g * Math.PI) / 180);
  // Tras rotar, el ancho de la foto queda a lo largo del eje que corresponda.
  const [w, h] = g === 90 || g === 270 ? [alto, ancho] : [ancho, alto];
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return canvas;
}

export async function lienzoAArchivo(canvas: HTMLCanvasElement, nombre: string): Promise<File> {
  const aBlob = (tipo: string) => new Promise<Blob | null>(r => canvas.toBlob(r, tipo, 0.86));
  let blob = await aBlob('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await aBlob('image/jpeg');
  if (!blob) throw new Error('No se pudo exportar la imagen.');
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${nombre.replace(/\.[^.]+$/, '')}.${ext}`, { type: blob.type });
}
