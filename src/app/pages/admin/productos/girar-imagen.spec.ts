// src/app/pages/admin/productos/girar-imagen.spec.ts
import { medidasGiradas, normalizarGiro } from './girar-imagen';

describe('normalizarGiro', () => {
  it('lleva cualquier múltiplo de 90 a 0–270', () => {
    expect([0, 90, 180, 270, 360, 450, -90, -180].map(normalizarGiro)).toEqual([0, 90, 180, 270, 0, 90, 270, 180]);
  });
});

describe('medidasGiradas', () => {
  it('a 90° y 270° intercambia ancho y alto', () => {
    expect(medidasGiradas(900, 1600, 90)).toEqual({ ancho: 1600, alto: 900 });
    expect(medidasGiradas(900, 1600, -90)).toEqual({ ancho: 1600, alto: 900 });
    expect(medidasGiradas(900, 1600, 180)).toEqual({ ancho: 900, alto: 1600 });
  });

  it('una foto grande queda limitada al lado máximo', () => {
    expect(medidasGiradas(4032, 3024, 90, 1600)).toEqual({ ancho: 1200, alto: 1600 });
  });
});
