// src/app/core/utils/encuadre-foco.ts
//
// Encuadre no destructivo de las imágenes del portafolio. La foto se guarda
// completa y lo que se guarda aparte es cómo mostrarla: un punto (x, y en % de
// la foto) y un zoom. Así sirve para cualquier proporción de caja —la tarjeta
// del grid puede ser 4/3, 3/4, 1/1 o 16/9 según su lugar— y una misma foto
// puede encuadrarse distinto en la tarjeta y en el hero.
//
// Se pinta con `background-size: cover`, `background-position: x% y%` y
// `transform: scale(zoom)` con origen en ese mismo punto. Con x, y entre 0 y
// 100 y zoom ≥ 1 la foto siempre cubre la caja: no quedan huecos.
// Lógica pura: se prueba sin DOM (ver encuadre-foco.spec.ts).

export interface Foco {
  /** Posición horizontal, 0 (borde izquierdo) a 100 (borde derecho). */
  x: number;
  /** Posición vertical, 0 (arriba) a 100 (abajo). */
  y: number;
  /** 1 = la foto cubre justo la caja; más es acercar. */
  zoom: number;
}

export const FOCO_CENTRO: Foco = { x: 50, y: 50, zoom: 1 };
export const FOCO_ZOOM_MAX = 5;

const entre = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;

/** Acepta lo que venga de la base (null, campos sueltos, valores fuera de rango). */
export function normalizarFoco(f: Partial<Foco> | null | undefined): Foco {
  if (!f || typeof f !== 'object') return { ...FOCO_CENTRO };
  return {
    x: Number.isFinite(f.x) ? entre(f.x!, 0, 100) : 50,
    y: Number.isFinite(f.y) ? entre(f.y!, 0, 100) : 50,
    zoom: Number.isFinite(f.zoom) ? entre(f.zoom!, 1, FOCO_ZOOM_MAX) : 1,
  };
}

/**
 * Desborde de la foto, en px, a lo ancho y a lo alto de una caja de
 * `cajaAncho`×`cajaAlto`: lo que sobra a los lados ya con el zoom aplicado.
 */
export function desborde(
  foco: Foco, fotoAncho: number, fotoAlto: number, cajaAncho: number, cajaAlto: number,
): { x: number; y: number } {
  const s = Math.max(cajaAncho / fotoAncho, cajaAlto / fotoAlto) * foco.zoom;
  return { x: fotoAncho * s - cajaAncho, y: fotoAlto * s - cajaAlto };
}

/**
 * Arrastrar la foto `dx`, `dy` px en pantalla. Mover la foto a la derecha deja
 * ver más de su lado izquierdo, por eso el punto baja. Con zoom el origen del
 * escalado se mueve junto con el punto; la relación sigue siendo lineal y su
 * pendiente es justo el desborde total.
 */
export function moverFoco(
  foco: Foco, dx: number, dy: number,
  fotoAncho: number, fotoAlto: number, cajaAncho: number, cajaAlto: number,
): Foco {
  const d = desborde(foco, fotoAncho, fotoAlto, cajaAncho, cajaAlto);
  const paso = (delta: number, sobra: number) => (sobra > 0.5 ? (-100 * delta) / sobra : 0);
  return normalizarFoco({
    ...foco,
    x: foco.x + paso(dx, d.x),
    y: foco.y + paso(dy, d.y),
  });
}

/**
 * Propiedades CSS custom para la caja que pinta la foto. Las hojas de estilo
 * las leen con valores por defecto, así una foto sin encuadre queda centrada.
 */
export function varsFoco(f: Partial<Foco> | null | undefined): Record<string, string> {
  const n = normalizarFoco(f);
  return { '--fx': `${n.x}%`, '--fy': `${n.y}%`, '--fz': `${n.zoom}` };
}

/** Lo mismo como estilos directos, para el lienzo de vista previa del editor. */
export function estiloFoco(f: Foco): Record<string, string> {
  const pos = `${f.x}% ${f.y}%`;
  return {
    'background-position': pos,
    'transform-origin': pos,
    transform: `scale(${f.zoom})`,
  };
}
