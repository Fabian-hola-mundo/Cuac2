import { describe, it, expect } from 'vitest';
import {
  normalizarTexto, coincideBusqueda, ordenarCatalogo, agregarAlCarrito, cambiarCantidad,
  totalCarrito, unidadesCarrito, restaurarCarrito, atajosBilletes, calcularVueltas,
  nuevoCobro, armarTransaccion, migrarColaVieja, sumarPendientes, resumenPendientes,
  type Producto, type Variante, type Linea,
} from '../../../public/pos/pos-logic.js';

const prod = (id: string, over: Partial<Producto> = {}): Producto => ({
  id, nombre: 'P' + id, categoria: 'Cat', precio: 10000, stock_actual: 5, activo: true, fotos: [], ...over,
});
const vari = (id: string, producto_id: string, over: Partial<Variante> = {}): Variante => ({
  id, producto_id, opciones: { Talla: 'M', Color: 'Rojo' }, precio: null, stock_actual: 5, ...over,
});
const ctx = {
  transaccion_id: 't1', metodo_pago: 'efectivo' as const, evento_id: 'ev', dispositivo: 'Caja 1',
  dispositivo_id: 'd1', comentario: null as string | null, vendido_en: '2026-10-09T10:00:00Z',
};

describe('normalizarTexto', () => {
  it('minúsculas, sin tildes, espacios colapsados', () => {
    expect(normalizarTexto('  PIÑA   Colada ')).toBe('pina colada');
  });
});

describe('coincideBusqueda', () => {
  it('casos', () => {
    expect(coincideBusqueda({ nombre: 'Sticker Piña', categoria: 'Stickers' }, 'pina')).toBe(true);
    expect(coincideBusqueda({ nombre: 'Pin Pato astronauta', categoria: 'Pines' }, 'astro pato')).toBe(true);
    expect(coincideBusqueda({ nombre: 'Tote', categoria: 'Bolsos' }, 'bols')).toBe(true);
    expect(coincideBusqueda({ nombre: 'Tote', categoria: null }, 'pin')).toBe(false);
    expect(coincideBusqueda({ nombre: 'Tote', categoria: null }, '  ')).toBe(true);
  });
});

describe('ordenarCatalogo', () => {
  it('el agotado no sube y respeta el límite', () => {
    const [a, b, c] = [prod('a'), prod('b'), prod('c')];
    const agotado = prod('z', { stock_actual: 0 });
    const r = ordenarCatalogo([a, b, c, agotado], [
      { producto_id: agotado.id, unidades: 9 }, { producto_id: c.id, unidades: 5 }, { producto_id: b.id, unidades: 3 },
    ], 2);
    expect(r.map(x => [x.producto.id, x.rango])).toEqual([['c', 1], ['b', 2], ['a', null], ['z', null]]);
  });
});

describe('carrito', () => {
  it('tope de stock en tres toques', () => {
    const p = prod('a', { stock_actual: 2 });
    let c: Linea[] = [];
    for (let i = 0; i < 3; i++) c = agregarAlCarrito(c, p, null);
    expect(c.length).toBe(1);
    expect(c[0].cantidad).toBe(2);
    expect(c[0].clave).toBe('a|');
  });
  it('precio de variante prevalece', () => {
    const p = prod('a', { precio: 45000 });
    const v = vari('v1', 'a', { precio: 55000 });
    const c = agregarAlCarrito([], p, v);
    expect(c[0].precio_unitario).toBe(55000);
    expect(c[0].clave).toBe('a|v1');
    expect(c[0].etiqueta_variante).toBe('Rojo · M');
  });
  it('etiqueta explícita prevalece', () => {
    const c = agregarAlCarrito([], prod('a'), vari('v1', 'a'), 'Rojo / M');
    expect(c[0].etiqueta_variante).toBe('Rojo / M');
  });
  it('etiqueta por defecto no depende del orden de claves', () => {
    const p = prod('a');
    const x = agregarAlCarrito([], p, vari('v1', 'a', { opciones: { Talla: 'M', Color: 'Rojo' } }));
    const y = agregarAlCarrito([], p, vari('v1', 'a', { opciones: { Color: 'Rojo', Talla: 'M' } }));
    expect(x[0].etiqueta_variante).toBe(y[0].etiqueta_variante);
  });
  it('producto agotado ya en el carrito quita la línea', () => {
    let c = agregarAlCarrito([], prod('a'), null);
    c = agregarAlCarrito(c, prod('a', { stock_actual: 0 }), null);
    expect(c).toEqual([]);
  });
  it('precio null cuenta 0 y no muta la entrada', () => {
    const p = prod('a', { precio: null });
    const base: Linea[] = [];
    const c = agregarAlCarrito(base, p, null);
    expect(base.length).toBe(0);
    expect(c[0].precio_unitario).toBeNull();
    expect(totalCarrito(c)).toBe(0);
  });
  it('cambiarCantidad y totales', () => {
    const p = prod('a', { precio: 1000, stock_actual: 3 });
    let c = agregarAlCarrito([], p, null);
    c = cambiarCantidad(c, 'a|', 5);
    expect(c[0].cantidad).toBe(3);
    expect(totalCarrito(c)).toBe(3000);
    expect(unidadesCarrito(c)).toBe(3);
    expect(cambiarCantidad(cambiarCantidad(c, 'a|', -2), 'a|', -1)).toEqual([]);
  });
  it('el tope de stock cuenta las líneas de precio dictado del mismo producto', () => {
    const p = prod('a', { precio: 40000, stock_actual: 3 });
    const dictada: Linea = {
      clave: 'a||vx', producto_id: 'a', variante_id: null, nombre: 'Pa', etiqueta_variante: null,
      cantidad: 2, precio_unitario: 35000, stock_max: 3,
    };
    let c = agregarAlCarrito([dictada], p, null);
    expect(c.map(l => [l.clave, l.cantidad, l.stock_max])).toEqual([['a||vx', 2, 3], ['a|', 1, 1]]);
    c = agregarAlCarrito(c, p, null);
    expect(c.find(l => l.clave === 'a|')!.cantidad).toBe(1);
    const lleno = agregarAlCarrito([{ ...dictada, cantidad: 3 }], p, null);
    expect(lleno.map(l => l.clave)).toEqual(['a||vx']);
  });
  it('cambiarCantidad -1 desde 1 elimina', () => {
    const c = agregarAlCarrito([], prod('a'), null);
    expect(cambiarCantidad(c, 'a|', -1)).toEqual([]);
  });
});

describe('restaurarCarrito', () => {
  it('descarta ausentes y recorta al stock', () => {
    const p = prod('a', { stock_actual: 1 });
    const guardado: Linea[] = [
      { clave: 'a|', producto_id: 'a', variante_id: null, nombre: 'Pa', etiqueta_variante: null, cantidad: 3, precio_unitario: 10000, stock_max: 5 },
      { clave: 'x|', producto_id: 'x', variante_id: null, nombre: 'Px', etiqueta_variante: null, cantidad: 1, precio_unitario: 10000, stock_max: 5 },
    ];
    const r = restaurarCarrito(guardado, [p], {});
    expect(r.descartadas).toBe(1);
    expect(r.carrito.length).toBe(1);
    expect(r.carrito[0].cantidad).toBe(1);
    expect(r.carrito[0].stock_max).toBe(1);
  });
  it('descarta variante agotada', () => {
    const p = prod('a');
    const v = vari('v1', 'a', { stock_actual: 0 });
    const guardado: Linea[] = [
      { clave: 'a|v1', producto_id: 'a', variante_id: 'v1', nombre: 'Pa', etiqueta_variante: null, cantidad: 1, precio_unitario: 1, stock_max: 5 },
    ];
    expect(restaurarCarrito(guardado, [p], { a: [v] })).toEqual({ carrito: [], descartadas: 1 });
  });
});

describe('cobro', () => {
  it('atajosBilletes', () => {
    expect(atajosBilletes(66000)).toEqual([70000, 80000, 100000]);
    expect(atajosBilletes(20000)).toEqual([30000, 40000, 50000]);
  });
  it('calcularVueltas', () => {
    expect(calcularVueltas(66000, 100000)).toBe(34000);
    expect(calcularVueltas(66000, 50000)).toBeNull();
    expect(calcularVueltas(66000, null)).toBeNull();
    expect(calcularVueltas(66000, 66000)).toBe(0);
  });
  it('nuevoCobro distintos', () => {
    expect(nuevoCobro().transaccion_id).not.toBe(nuevoCobro().transaccion_id);
  });
});

describe('armarTransaccion', () => {
  const c = agregarAlCarrito([], prod('a', { precio: 2000 }), null);
  it('comentario vacío a null, lineas mapeadas', () => {
    const t = armarTransaccion(c, { ...ctx, comentario: '   ' });
    expect(t.comentario).toBeNull();
    expect(t.lineas).toEqual([{ producto_id: 'a', variante_id: null, cantidad: 1, precio_unitario: 2000 }]);
    expect(t.metodo_pago).toBe('efectivo');
  });
  it('comentario máximo 280', () => {
    expect(armarTransaccion(c, { ...ctx, comentario: 'x'.repeat(300) }).comentario!.length).toBe(280);
  });
});

describe('migrarColaVieja', () => {
  it('producto ausente da precio null; defaults', () => {
    const p = prod('a', { precio: 3000 });
    const v = vari('v1', 'a', { precio: 4000 });
    let n = 0;
    const r = migrarColaVieja([
      { producto_id: 'zz', cantidad: 2, dispositivo: 'D', vendido_en: 't', sincronizado: false },
      { producto_id: 'a', variante_id: 'v1', cantidad: 1, dispositivo: 'D', dispositivo_id: 'd1', comentario: 'hola', vendido_en: 't2', sincronizado: false, evento_id: 'E2' },
    ], [p], { a: [v] }, () => 'u' + ++n);
    expect(r.length).toBe(2);
    expect(r[0]).toMatchObject({ transaccion_id: 'u1', metodo_pago: null, evento_id: 'Venta-regular', vendido_en: 't' });
    expect(r[0].lineas).toEqual([{ producto_id: 'zz', variante_id: null, cantidad: 2, precio_unitario: null }]);
    expect(r[1]).toMatchObject({ evento_id: 'E2', dispositivo_id: 'd1', comentario: 'hola' });
    expect(r[1].lineas[0].precio_unitario).toBe(4000);
  });
});

describe('pendientes', () => {
  const cola = [
    armarTransaccion(agregarAlCarrito([], prod('b', { precio: 1000 }), null), ctx),
    armarTransaccion(cambiarCantidad(agregarAlCarrito([], prod('n', { precio: 500 }), null), 'n|', 2), ctx),
  ];
  it('sumarPendientes suma y reordena', () => {
    const r = sumarPendientes([{ producto_id: 'a', unidades: 5 }, { producto_id: 'b', unidades: 1 }], cola);
    expect(r).toEqual([{ producto_id: 'a', unidades: 5 }, { producto_id: 'n', unidades: 3 }, { producto_id: 'b', unidades: 2 }]);
  });
  it('resumenPendientes', () => {
    expect(resumenPendientes(cola)).toEqual({ ventas: 2, total: 2500 });
  });
});
