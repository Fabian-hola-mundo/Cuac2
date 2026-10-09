import { describe, it, expect } from 'vitest';
import {
  repartirPrecio, propuestaACarrito, fusionarCarrito, dudasPendientes, observacionPrecio, totalLineas,
} from '../../../public/pos/voz-logic.js';
import type { Linea, Producto, Variante } from '../../../public/pos/pos-logic.js';

const linea = (id: string, precio: number, cantidad: number, over: Partial<Linea> = {}): Linea => ({
  clave: id + '|', producto_id: id, variante_id: null, nombre: 'P' + id, etiqueta_variante: null,
  cantidad, precio_unitario: precio, stock_max: 10, ...over,
});
const prod = (id: string, over: Partial<Producto> = {}): Producto => ({
  id, nombre: 'P' + id, categoria: 'Cat', precio: 40000, stock_actual: 5, activo: true, ...over,
});

describe('repartirPrecio', () => {
  it('2 × 40.000 a 70.000 → 35.000 c/u', () => {
    const r = repartirPrecio([linea('a', 40000, 2)], 70000, 'x');
    expect(totalLineas(r)).toBe(70000);
    expect(r).toHaveLength(1);
    expect(r[0].precio_unitario).toBe(35000);
    expect(r[0].clave).toBe('a||vx');
  });

  it('proporcional entre productos de distinto precio', () => {
    const r = repartirPrecio([linea('a', 40000, 1), linea('b', 20000, 1)], 30000, 'x');
    expect(r.map(l => l.precio_unitario)).toEqual([20000, 10000]);
  });

  it('residuo exacto en una línea aparte de 1 unidad', () => {
    const r = repartirPrecio([linea('a', 10000, 3)], 100000, 'x');
    expect(totalLineas(r)).toBe(100000);
    expect(r.map(l => [l.cantidad, l.precio_unitario, l.clave])).toEqual([
      [2, 33333, 'a||vx'],
      [1, 33334, 'a||vxr'],
    ]);
    expect(r[0].stock_max + r[1].stock_max).toBe(10);
  });

  it('una sola unidad absorbe el residuo sin partirse', () => {
    const r = repartirPrecio([linea('a', 10000, 1), linea('b', 10000, 1)], 25001, 'x');
    expect(totalLineas(r)).toBe(25001);
    expect(r).toHaveLength(2);
  });

  it('precios 0 → partes iguales', () => {
    const r = repartirPrecio([linea('a', 0, 1), linea('b', 0, 1)], 30000, 'x');
    expect(r.map(l => l.precio_unitario)).toEqual([15000, 15000]);
  });

  it('total ≤ 0 o sin líneas lanza error', () => {
    expect(() => repartirPrecio([linea('a', 1, 1)], 0, 'x')).toThrow();
    expect(() => repartirPrecio([], 1000, 'x')).toThrow();
  });
});

describe('propuestaACarrito', () => {
  const productos = [prod('orq'), prod('sol', { stock_actual: 1 }), prod('cam', { precio: 70000 })];
  const variantes: Record<string, Variante[]> = {
    cam: [{ id: 'cam-m', producto_id: 'cam', opciones: { talla: 'M', color: 'Negro' }, precio: 75000, stock_actual: 2 }],
  };

  it('arma líneas con la forma del carrito, junta repetidas y respeta el stock', () => {
    const r = propuestaACarrito(
      { lineas: [{ producto_id: 'cam', variante_id: 'cam-m', cantidad: 1 }, { producto_id: 'nope', variante_id: null, cantidad: 1 }], dudas: [{ texto: '', cantidad: 3, opciones: [] }] },
      { 0: [{ producto_id: 'orq', variante_id: null, cantidad: 1 }, { producto_id: 'sol', variante_id: null, cantidad: 2 }] },
      productos, variantes,
    );
    expect(r.omitidas).toBe(1);
    expect(r.recortadas).toBe(1);
    expect(r.lineas).toEqual([
      { clave: 'cam|cam-m', producto_id: 'cam', variante_id: 'cam-m', nombre: 'Pcam', etiqueta_variante: 'Negro · M', cantidad: 1, precio_unitario: 75000, stock_max: 2 },
      { clave: 'orq|', producto_id: 'orq', variante_id: null, nombre: 'Porq', etiqueta_variante: null, cantidad: 1, precio_unitario: 40000, stock_max: 5 },
      { clave: 'sol|', producto_id: 'sol', variante_id: null, nombre: 'Psol', etiqueta_variante: null, cantidad: 1, precio_unitario: 40000, stock_max: 1 },
    ]);
  });

  it('agotado se omite', () => {
    const r = propuestaACarrito({ lineas: [{ producto_id: 'x', variante_id: null, cantidad: 1 }], dudas: [] }, {}, [prod('x', { stock_actual: 0 })], {});
    expect(r.lineas).toEqual([]);
    expect(r.omitidas).toBe(1);
  });
});

describe('fusionarCarrito', () => {
  it('suma por clave con tope y no mezcla precios dictados', () => {
    const carrito = [linea('a', 40000, 9)];
    const r = fusionarCarrito(carrito, [linea('a', 40000, 3), linea('a', 35000, 1, { clave: 'a||vx' })]);
    expect(r.map(l => [l.clave, l.cantidad])).toEqual([['a|', 10], ['a||vx', 1]]);
    expect(carrito[0].cantidad).toBe(9);
  });
});

describe('dudasPendientes', () => {
  it('cuenta las dudas cuya suma no llega a la cantidad', () => {
    const prop = { lineas: [], dudas: [{ texto: '', cantidad: 2, opciones: [] }, { texto: '', cantidad: 1, opciones: [] }] };
    expect(dudasPendientes(prop, {})).toBe(2);
    expect(dudasPendientes(prop, { 0: [{ producto_id: 'a', variante_id: null, cantidad: 2 }] })).toBe(1);
    expect(dudasPendientes(prop, { 0: [{ producto_id: 'a', variante_id: null, cantidad: 1 }], 1: [{ producto_id: 'b', variante_id: null, cantidad: 1 }] })).toBe(1);
  });
});

describe('observacionPrecio', () => {
  it('formato es-CO', () => {
    expect(observacionPrecio(70000, 80000)).toBe('Precio dictado $70.000 (catálogo $80.000)');
  });
});
