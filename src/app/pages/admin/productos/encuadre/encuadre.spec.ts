// src/app/pages/admin/productos/encuadre/encuadre.spec.ts
import { ZOOM_MAX, escalaCubrir, limitar, rectDibujo, zoomEntera } from './encuadre';

describe('encuadre', () => {
  it('con zoom 1 y centrado, una foto vertical cubre el cuadro y recorta arriba y abajo', () => {
    // 900×1600 en un cuadro de 400: escala 400/900, alto resultante 711
    const r = rectDibujo({ zoom: 1, x: 0, y: 0 }, 900, 1600, 400, 1600);
    expect(r.ancho).toBeCloseTo(1600);
    expect(r.alto).toBeCloseTo(1600 * 1600 / 900);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(-(r.alto - 1600) / 2);
  });

  it('no deja mover la foto hasta dejar un hueco', () => {
    const e = limitar({ zoom: 1, x: 500, y: -999 }, 900, 1600, 400);
    expect(e.x).toBe(0);                        // a lo ancho ya cubre justo
    expect(e.y).toBeCloseTo(-(1600 * escalaCubrir(900, 1600, 400) - 400) / 2);
  });

  it('el zoom va de "foto entera" a ZOOM_MAX', () => {
    expect(limitar({ zoom: 0.01, x: 0, y: 0 }, 900, 1600, 400).zoom).toBeCloseTo(zoomEntera(900, 1600));
    expect(limitar({ zoom: 99, x: 0, y: 0 }, 900, 1600, 400).zoom).toBe(ZOOM_MAX);
  });

  it('con la foto entera queda dentro del cuadro, sin salirse', () => {
    const z = zoomEntera(900, 1600);
    const e = limitar({ zoom: z, x: 0, y: 0 }, 900, 1600, 400);
    const r = rectDibujo(e, 900, 1600, 400, 400);
    expect(r.alto).toBeCloseTo(400);
    expect(r.ancho).toBeCloseTo(225);
    // se puede mover a lo ancho, pero sin salirse del cuadro
    const movida = limitar({ ...e, x: 1000 }, 900, 1600, 400);
    expect(rectDibujo(movida, 900, 1600, 400, 400).x + 225).toBeCloseTo(400);
  });
});
