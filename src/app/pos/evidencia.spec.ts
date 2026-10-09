import { describe, it, expect } from 'vitest';
import { normalizar, fichas, validarPropuesta, type Catalogo } from '../../../supabase/functions/pos-voz/evidencia.js';

const catalogo: Catalogo = {
  productos: [
    { id: 'orq', nombre: 'Totebag Orquídeas', categoria: 'tote', precio: 40000, stock_actual: 3 },
    { id: 'est', nombre: 'Totebag Estrella', categoria: 'tote', precio: 40000, stock_actual: 5 },
    { id: 'sol', nombre: 'Totebag Sol', categoria: 'tote', precio: 40000, stock_actual: 3 },
    { id: 'bor', nombre: 'Banda Orquídeas', categoria: 'bandas', precio: 20000, stock_actual: 6 },
    { id: 'lib1', nombre: 'Libretas ÚLTIMAS UNIDADES', categoria: 'impresos', precio: 10000, stock_actual: 6 },
    { id: 'lib2', nombre: 'Libretas ÚLTIMAS UNIDADES', categoria: 'produccion-vieja', precio: 10000, stock_actual: 4 },
    { id: 'cab', nombre: 'Cabina de dibujo', categoria: 'actividades', precio: 10000, stock_actual: 100 },
    { id: 'age', nombre: 'Agenda Cuac 2027', categoria: 'agenda', precio: 60000, stock_actual: 4 },
    { id: 'cam', nombre: 'Camiseta Pato', categoria: 'ropa', precio: 70000, stock_actual: 6 },
  ],
  variantes: [
    { id: 'cam-s', producto_id: 'cam', opciones: { talla: 'S' }, precio: null, stock_actual: 2 },
    { id: 'cam-m', producto_id: 'cam', opciones: { talla: 'M' }, precio: null, stock_actual: 4 },
    { id: 'cab-1', producto_id: 'cab', opciones: { Cant: '1persona' }, precio: 10000, stock_actual: 50 },
    { id: 'cab-2', producto_id: 'cab', opciones: { Cant: '2 personas' }, precio: 15000, stock_actual: 48 },
    { id: 'cab-3', producto_id: 'cab', opciones: { Cant: '3 personas' }, precio: 20000, stock_actual: 50 },
  ],
};

const vacio = { lineas: [], dudas: [] };

describe('normalizar', () => {
  it('quita tildes y mayúsculas', () => {
    expect(normalizar('Orquídeas ÑAndú')).toBe('orquideas nandu');
  });
});

describe('fichas', () => {
  it('quita palabras vacías y cortas, separa números pegados', () => {
    expect(fichas('Libretas ÚLTIMAS UNIDADES')).toEqual(['libretas']);
    expect(fichas('1persona')).toEqual(['1', 'persona']);
  });
});

describe('validarPropuesta', () => {
  it('categoría ambigua: «dos tote bags» se vuelve duda con las 3 totes', () => {
    const t = 'ayúdame a registrar la venta de dos tote bags por 80 mil pesos';
    const r = validarPropuesta(
      { lineas: [{ producto_id: 'orq', variante_id: null, cantidad: 2, fragmento: 'dos tote bags' }], dudas: [] },
      catalogo, t,
    );
    expect(r.lineas).toEqual([]);
    expect(r.dudas).toHaveLength(1);
    expect(r.dudas[0].cantidad).toBe(2);
    expect(r.dudas[0].opciones.map(o => o.producto_id).sort()).toEqual(['est', 'orq', 'sol']);
  });

  it('acepta el producto cuando se nombra (singular o plural)', () => {
    const t = 'una totebag orquídea en efectivo';
    const r = validarPropuesta(
      { lineas: [{ producto_id: 'orq', variante_id: null, cantidad: 1, fragmento: 'totebag orquidea' }], dudas: [] },
      catalogo, t,
    );
    expect(r.lineas).toEqual([{ producto_id: 'orq', variante_id: null, cantidad: 1 }]);
    expect(r.dudas).toEqual([]);
  });

  it('la palabra distintiva debe estar en el fragmento de esa línea, no en otra parte', () => {
    const t = 'dos tote bags y una tote orquídea';
    const r = validarPropuesta(
      {
        lineas: [
          { producto_id: 'orq', variante_id: null, cantidad: 2, fragmento: 'dos tote bags' },
          { producto_id: 'orq', variante_id: null, cantidad: 1, fragmento: 'una tote orquidea' },
        ],
        dudas: [],
      },
      catalogo, t,
    );
    expect(r.lineas).toEqual([{ producto_id: 'orq', variante_id: null, cantidad: 1 }]);
    expect(r.dudas).toHaveLength(1);
    expect(r.dudas[0].cantidad).toBe(2);
  });

  it('«una orquídea» sin decir qué es → duda entre tote y banda', () => {
    const r = validarPropuesta(
      { lineas: [{ producto_id: 'orq', variante_id: null, cantidad: 1, fragmento: 'una orquidea' }], dudas: [] },
      catalogo, 'véndeme una orquídea',
    );
    expect(r.lineas).toEqual([]);
    expect(r.dudas[0].opciones.map(o => o.producto_id).sort()).toEqual(['bor', 'orq']);
  });

  it('dos productos con el mismo nombre → duda', () => {
    const r = validarPropuesta(
      { lineas: [{ producto_id: 'lib1', variante_id: null, cantidad: 1, fragmento: 'una libreta' }], dudas: [] },
      catalogo, 'una libreta',
    );
    expect(r.lineas).toEqual([]);
    expect(r.dudas[0].opciones.map(o => o.producto_id).sort()).toEqual(['lib1', 'lib2']);
  });

  it('combinación con números dichos en letras', () => {
    const ok = validarPropuesta(
      { lineas: [{ producto_id: 'cab', variante_id: 'cab-2', cantidad: 1, fragmento: 'cabina para dos personas' }], dudas: [] },
      catalogo, 'una cabina para dos personas',
    );
    expect(ok.lineas).toEqual([{ producto_id: 'cab', variante_id: 'cab-2', cantidad: 1 }]);
    const uno = validarPropuesta(
      { lineas: [{ producto_id: 'cab', variante_id: 'cab-1', cantidad: 1, fragmento: 'cabina de una persona' }], dudas: [] },
      catalogo, 'cabina de una persona',
    );
    expect(uno.lineas).toEqual([{ producto_id: 'cab', variante_id: 'cab-1', cantidad: 1 }]);
    const ambigua = validarPropuesta(
      { lineas: [{ producto_id: 'cab', variante_id: 'cab-2', cantidad: 1, fragmento: 'cabina de personas' }], dudas: [] },
      catalogo, 'cabina de personas',
    );
    expect(ambigua.lineas).toEqual([]);
  });

  it('producto único en su categoría basta con el fragmento', () => {
    const r = validarPropuesta(
      { lineas: [{ producto_id: 'age', variante_id: null, cantidad: 1, fragmento: 'la agenda' }], dudas: [] },
      catalogo, 'vendí la agenda',
    );
    expect(r.lineas).toEqual([{ producto_id: 'age', variante_id: null, cantidad: 1 }]);
  });

  it('fragmento que no está en la transcripción → duda', () => {
    const r = validarPropuesta(
      { lineas: [{ producto_id: 'age', variante_id: null, cantidad: 1, fragmento: 'agenda' }], dudas: [] },
      catalogo, 'vendí una cosa',
    );
    expect(r.lineas).toEqual([]);
    expect(r.dudas[0].opciones).toEqual([{ producto_id: 'age', variante_id: null }]);
  });

  it('producto con combinaciones sin combinación → duda de combinación', () => {
    const r = validarPropuesta(
      { lineas: [{ producto_id: 'cam', variante_id: null, cantidad: 1, fragmento: 'camiseta pato' }], dudas: [] },
      catalogo, 'una camiseta pato',
    );
    expect(r.lineas).toEqual([]);
    expect(r.dudas[0].opciones).toEqual([
      { producto_id: 'cam', variante_id: 'cam-s' },
      { producto_id: 'cam', variante_id: 'cam-m' },
    ]);
  });

  it('combinación dicha → línea; combinación no dicha o ajena → duda', () => {
    const ok = validarPropuesta(
      { lineas: [{ producto_id: 'cam', variante_id: 'cam-m', cantidad: 1, fragmento: 'camiseta pato talla m' }], dudas: [] },
      catalogo, 'una camiseta pato talla m',
    );
    expect(ok.lineas).toEqual([{ producto_id: 'cam', variante_id: 'cam-m', cantidad: 1 }]);
    const noDicha = validarPropuesta(
      { lineas: [{ producto_id: 'cam', variante_id: 'cam-m', cantidad: 1, fragmento: 'camiseta pato' }], dudas: [] },
      catalogo, 'una camiseta pato',
    );
    expect(noDicha.lineas).toEqual([]);
    expect(noDicha.dudas).toHaveLength(1);
    const ajena = validarPropuesta(
      { lineas: [{ producto_id: 'age', variante_id: 'cam-m', cantidad: 1, fragmento: 'agenda' }], dudas: [] },
      catalogo, 'una agenda',
    );
    expect(ajena.lineas).toEqual([{ producto_id: 'age', variante_id: null, cantidad: 1 }]);
  });

  it('filtra ids inexistentes, dudas vacías y cantidades inválidas', () => {
    const r = validarPropuesta(
      {
        lineas: [
          { producto_id: 'nope', variante_id: null, cantidad: 1, fragmento: 'x' },
          { producto_id: 'age', variante_id: null, cantidad: 0, fragmento: 'agenda' },
          { producto_id: 'age', variante_id: null, cantidad: 1.5, fragmento: 'agenda' },
        ],
        dudas: [
          { texto: '¿Cuál?', cantidad: 1, opciones: [{ producto_id: 'nope', variante_id: null }] },
          { texto: '¿Cuál tote?', cantidad: 1, opciones: [{ producto_id: 'sol', variante_id: null }, { producto_id: 'zzz', variante_id: null }] },
        ],
      },
      catalogo, 'una agenda',
    );
    expect(r.lineas).toEqual([]);
    expect(r.dudas).toEqual([{ texto: '¿Cuál tote?', cantidad: 1, opciones: [{ producto_id: 'sol', variante_id: null }] }]);
  });

  it('sin nada → vacío', () => {
    expect(validarPropuesta(vacio, catalogo, 'hola')).toEqual(vacio);
  });
});
