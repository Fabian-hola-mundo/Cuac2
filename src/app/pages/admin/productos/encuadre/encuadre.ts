// src/app/pages/admin/productos/encuadre/encuadre.ts
//
// Geometría del encuadre de la portada. La tarjeta de la tienda y la ficha son
// cuadradas, así que la portada se guarda cuadrada y el admin decide qué parte
// de la foto entra. Lógica pura: se prueba sin DOM (ver encuadre.spec.ts).

/** Lado de la portada guardada, igual que el máximo de la compresión. */
export const LADO_SALIDA = 1600;
export const ZOOM_MAX = 5;

export interface Encuadre {
  /** 1 = la foto cubre justo el cuadro; <1 la deja entera con márgenes. */
  zoom: number;
  /** Desplazamiento del centro de la foto respecto al del cuadro, en px del cuadro. */
  x: number;
  y: number;
}

/** Escala que hace que la foto cubra el cuadro (zoom 1). */
export function escalaCubrir(ancho: number, alto: number, lado: number): number {
  return Math.max(lado / ancho, lado / alto);
}

/** Zoom con el que la foto entra entera (puede ser <1). */
export function zoomEntera(ancho: number, alto: number): number {
  return Math.min(ancho, alto) / Math.max(ancho, alto);
}

/**
 * Mantiene la foto dentro de lo razonable: si es más grande que el cuadro no
 * deja huecos; si es más chica, no deja que se salga del cuadro.
 */
export function limitar(e: Encuadre, ancho: number, alto: number, lado: number): Encuadre {
  const zoom = Math.min(ZOOM_MAX, Math.max(zoomEntera(ancho, alto), e.zoom));
  const s = escalaCubrir(ancho, alto, lado) * zoom;
  const maxX = Math.abs(ancho * s - lado) / 2;
  const maxY = Math.abs(alto * s - lado) / 2;
  const fijar = (v: number, max: number) => Math.min(max, Math.max(-max, v)) || 0;
  return { zoom, x: fijar(e.x, maxX), y: fijar(e.y, maxY) };
}

/** Rectángulo donde dibujar la foto en un lienzo cuadrado de `salida` px. */
export function rectDibujo(
  e: Encuadre, ancho: number, alto: number, lado: number, salida: number,
): { x: number; y: number; ancho: number; alto: number } {
  const k = salida / lado;
  const s = escalaCubrir(ancho, alto, lado) * e.zoom;
  return {
    x: (lado / 2 + e.x - (ancho * s) / 2) * k,
    y: (lado / 2 + e.y - (alto * s) / 2) * k,
    ancho: ancho * s * k,
    alto: alto * s * k,
  };
}
