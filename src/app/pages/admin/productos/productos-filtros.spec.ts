// Lógica pura de la tabla de productos del admin: filtros combinados, orden y
// KPIs de cabecera. Vive fuera del componente para poder probarse sin TestBed,
// igual que bold-shared.spec.ts prueba las piezas puras de las edge functions.
import {
  UMBRAL_STOCK_BAJO,
  chipStock,
  calcularKpis,
  contarPorEstado,
  filtrarProductos,
  ordenarProductos,
} from './productos-filtros';
import type { ProductoEvento } from '../../../core/services/inventario.service';

function producto(over: Partial<ProductoEvento> = {}): ProductoEvento {
  return {
    id: over.id ?? 'p1',
    evento_id: null,
    nombre: 'Tote bag Cuac',
    categoria: 'tote',
    personaje: null,
    precio: 28000,
    stock_inicial: 10,
    stock_actual: 10,
    activo: true,
    creado_en: '2026-01-01T00:00:00Z',
    cover_url: null,
    fotos: [],
    material: [],
    color: null,
    flag: null,
    destacado: false,
    descripcion: null,
    ...over,
  };
}

// El componente pasa su propio traductor de id → label de categoría.
const label = (id: string) => (id === 'tote' ? 'Tote bags' : id);

describe('filtrarProductos', () => {
  it('devuelve todo cuando no hay filtros activos', () => {
    const list = [producto({ id: 'a' }), producto({ id: 'b' })];
    const out = filtrarProductos(list, { categoria: 'all', estado: 'all', busqueda: '' }, label);
    expect(out.map(p => p.id)).toEqual(['a', 'b']);
  });

  it('filtra por categoría', () => {
    const list = [producto({ id: 'a', categoria: 'tote' }), producto({ id: 'b', categoria: 'pin' })];
    const out = filtrarProductos(list, { categoria: 'pin', estado: 'all', busqueda: '' }, label);
    expect(out.map(p => p.id)).toEqual(['b']);
  });

  it('encuentra por nombre sin distinguir mayúsculas ni acentos', () => {
    const list = [producto({ id: 'a', nombre: 'Pañoleta Kiki' }), producto({ id: 'b', nombre: 'Pin Roar' })];
    const out = filtrarProductos(list, { categoria: 'all', estado: 'all', busqueda: 'PANOLETA' }, label);
    expect(out.map(p => p.id)).toEqual(['a']);
  });

  it('encuentra por personaje, no sólo por nombre', () => {
    const list = [producto({ id: 'a', personaje: 'kiki' }), producto({ id: 'b', personaje: 'roar' })];
    const out = filtrarProductos(list, { categoria: 'all', estado: 'all', busqueda: 'roar' }, label);
    expect(out.map(p => p.id)).toEqual(['b']);
  });

  it('encuentra por el label de la categoría, no sólo por su id', () => {
    const list = [producto({ id: 'a', categoria: 'tote' }), producto({ id: 'b', categoria: 'pin' })];
    const out = filtrarProductos(list, { categoria: 'all', estado: 'all', busqueda: 'Tote bags' }, label);
    expect(out.map(p => p.id)).toEqual(['a']);
  });

  it('filtra los agotados', () => {
    const list = [producto({ id: 'a', stock_actual: 0 }), producto({ id: 'b', stock_actual: 5 })];
    const out = filtrarProductos(list, { categoria: 'all', estado: 'agotado', busqueda: '' }, label);
    expect(out.map(p => p.id)).toEqual(['a']);
  });

  it('cuenta como stock bajo lo que está bajo el umbral pero no en cero', () => {
    const list = [
      producto({ id: 'cero', stock_actual: 0 }),
      producto({ id: 'bajo', stock_actual: UMBRAL_STOCK_BAJO - 1 }),
      producto({ id: 'justo', stock_actual: UMBRAL_STOCK_BAJO }),
    ];
    const out = filtrarProductos(list, { categoria: 'all', estado: 'bajo', busqueda: '' }, label);
    expect(out.map(p => p.id)).toEqual(['bajo']);
  });

  it('filtra los inactivos', () => {
    const list = [producto({ id: 'a', activo: false }), producto({ id: 'b', activo: true })];
    const out = filtrarProductos(list, { categoria: 'all', estado: 'inactivo', busqueda: '' }, label);
    expect(out.map(p => p.id)).toEqual(['a']);
  });

  it('combina categoría, estado y búsqueda a la vez', () => {
    const list = [
      producto({ id: 'ok', categoria: 'pin', nombre: 'Pin Kiki', stock_actual: 0 }),
      producto({ id: 'otra-cat', categoria: 'tote', nombre: 'Tote Kiki', stock_actual: 0 }),
      producto({ id: 'con-stock', categoria: 'pin', nombre: 'Pin Kiki', stock_actual: 9 }),
      producto({ id: 'otro-nombre', categoria: 'pin', nombre: 'Pin Roar', stock_actual: 0 }),
    ];
    const out = filtrarProductos(list, { categoria: 'pin', estado: 'agotado', busqueda: 'kiki' }, label);
    expect(out.map(p => p.id)).toEqual(['ok']);
  });

  it('no muta el arreglo original', () => {
    const list = [producto({ id: 'a' }), producto({ id: 'b', activo: false })];
    filtrarProductos(list, { categoria: 'all', estado: 'inactivo', busqueda: '' }, label);
    expect(list).toHaveLength(2);
  });
});

describe('ordenarProductos', () => {
  it('ordena por nombre respetando el alfabeto español', () => {
    const list = [producto({ id: 'z', nombre: 'Zorro' }), producto({ id: 'n', nombre: 'Ñandú' }), producto({ id: 'a', nombre: 'Ábaco' })];
    const out = ordenarProductos(list, 'nombre', 'asc');
    expect(out.map(p => p.id)).toEqual(['a', 'n', 'z']);
  });

  it('ordena por precio de mayor a menor', () => {
    const list = [producto({ id: 'b', precio: 10 }), producto({ id: 'a', precio: 90 }), producto({ id: 'c', precio: 50 })];
    const out = ordenarProductos(list, 'precio', 'desc');
    expect(out.map(p => p.id)).toEqual(['a', 'c', 'b']);
  });

  it('ordena por stock actual', () => {
    const list = [producto({ id: 'b', stock_actual: 7 }), producto({ id: 'a', stock_actual: 0 })];
    const out = ordenarProductos(list, 'stock_actual', 'asc');
    expect(out.map(p => p.id)).toEqual(['a', 'b']);
  });

  it('ordena por fecha de creación como fecha, no como texto', () => {
    const list = [
      producto({ id: 'viejo', creado_en: '2026-01-09T00:00:00Z' }),
      producto({ id: 'nuevo', creado_en: '2026-01-10T00:00:00Z' }),
    ];
    const out = ordenarProductos(list, 'creado_en', 'desc');
    expect(out.map(p => p.id)).toEqual(['nuevo', 'viejo']);
  });

  it('no muta el arreglo original', () => {
    const list = [producto({ id: 'b', precio: 10 }), producto({ id: 'a', precio: 90 })];
    ordenarProductos(list, 'precio', 'desc');
    expect(list.map(p => p.id)).toEqual(['b', 'a']);
  });
});

describe('calcularKpis', () => {
  it('valora el inventario con el stock actual, no con el inicial', () => {
    const list = [
      producto({ id: 'a', precio: 1000, stock_inicial: 10, stock_actual: 3 }),
      producto({ id: 'b', precio: 500, stock_inicial: 10, stock_actual: 2 }),
    ];
    expect(calcularKpis(list).valorInventario).toBe(4000);
  });

  it('cuenta activos, agotados y stock bajo por separado', () => {
    const list = [
      producto({ id: 'a', activo: true, stock_actual: 10 }),
      producto({ id: 'b', activo: true, stock_actual: 0 }),
      producto({ id: 'c', activo: false, stock_actual: 1 }),
    ];
    const kpis = calcularKpis(list);
    expect(kpis).toMatchObject({ total: 3, activos: 2, agotados: 1, bajos: 1 });
  });

  it('devuelve ceros con el catálogo vacío', () => {
    expect(calcularKpis([])).toMatchObject({ total: 0, activos: 0, agotados: 0, bajos: 0, valorInventario: 0 });
  });
});

describe('contarPorEstado', () => {
  it('cuenta cada estado incluyendo el total en all', () => {
    const list = [
      producto({ id: 'a', activo: true, stock_actual: 10 }),
      producto({ id: 'b', activo: true, stock_actual: 0 }),
      producto({ id: 'c', activo: false, stock_actual: 2 }),
    ];
    expect(contarPorEstado(list)).toEqual({ all: 3, activo: 2, inactivo: 1, bajo: 1, agotado: 1 });
  });
});

describe('chipStock', () => {
  it('todo valor de stock sale como chip, con el tono según el umbral', () => {
    expect([0, 1, 2, 3, 5, 120].map(chipStock)).toEqual([
      { tono: 'err',  texto: 'Agotado' },
      { tono: 'warn', texto: '1 ud.' },
      { tono: 'warn', texto: '2 ud.' },
      { tono: 'ok',   texto: '3 ud.' },
      { tono: 'ok',   texto: '5 ud.' },
      { tono: 'ok',   texto: '120 ud.' },
    ]);
  });
});
