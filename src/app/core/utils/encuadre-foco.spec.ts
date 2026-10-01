// src/app/core/utils/encuadre-foco.spec.ts
import { FOCO_CENTRO, FOCO_ZOOM_MAX, desborde, moverFoco, normalizarFoco, varsFoco } from './encuadre-foco';

/** Borde izquierdo de la foto en pantalla, como lo pinta el CSS. */
function bordeIzq(x: number, zoom: number, fotoW: number, fotoH: number, cajaW: number, cajaH: number) {
  const s0 = Math.max(cajaW / fotoW, cajaH / fotoH);
  const sobra = fotoW * s0 - cajaW;
  const izqSinZoom = -sobra * x / 100;          // background-position x%
  const origen = cajaW * x / 100;                // transform-origin x%
  return origen + zoom * (izqSinZoom - origen);
}

describe('encuadre-foco', () => {
  it('sin datos queda centrado y sin zoom', () => {
    expect(normalizarFoco(null)).toEqual(FOCO_CENTRO);
    expect(normalizarFoco({ x: 20 })).toEqual({ x: 20, y: 50, zoom: 1 });
  });

  it('recorta valores fuera de rango', () => {
    expect(normalizarFoco({ x: -10, y: 140, zoom: 0.2 })).toEqual({ x: 0, y: 100, zoom: 1 });
    expect(normalizarFoco({ x: 50, y: 50, zoom: 99 }).zoom).toBe(FOCO_ZOOM_MAX);
    expect(normalizarFoco({ x: NaN, y: 50, zoom: 1 }).x).toBe(50);
  });

  it('una foto apaisada en caja cuadrada sólo se mueve a lo ancho', () => {
    const d = desborde(FOCO_CENTRO, 2000, 1000, 400, 400);
    expect(d.x).toBeCloseTo(400);
    expect(d.y).toBeCloseTo(0);
    const f = moverFoco(FOCO_CENTRO, 0, 80, 2000, 1000, 400, 400);
    expect(f.y).toBe(50);
  });

  it('la foto sigue al puntero exactamente, también con zoom', () => {
    for (const zoom of [1, 2, 3.5]) {
      const antes = { x: 50, y: 50, zoom };
      const despues = moverFoco(antes, 60, 0, 2000, 1000, 400, 400);
      const movido = bordeIzq(despues.x, zoom, 2000, 1000, 400, 400) - bordeIzq(antes.x, zoom, 2000, 1000, 400, 400);
      expect(movido).toBeCloseTo(60);
    }
  });

  it('no deja pasar del borde de la foto', () => {
    const f = moverFoco({ ...FOCO_CENTRO, zoom: 2 }, 5000, -5000, 1000, 2000, 400, 300);
    expect(f.x).toBe(0);
    expect(f.y).toBe(100);
  });

  it('expone variables CSS con valores por defecto sensatos', () => {
    expect(varsFoco(undefined)).toEqual({ '--fx': '50%', '--fy': '50%', '--fz': '1' });
    expect(varsFoco({ x: 10, y: 80, zoom: 2 })).toEqual({ '--fx': '10%', '--fy': '80%', '--fz': '2' });
  });
});
