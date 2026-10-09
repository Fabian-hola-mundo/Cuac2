// src/app/core/utils/variantes-shared.spec.ts
//
// Prueba `supabase/functions/_shared/variantes.ts`, que usan a la vez la
// tienda, el admin y la edge function crear-pedido (la etiqueta que queda en
// el pedido la arma el servidor con estas mismas funciones).
import {
  OpcionDef,
  VarianteConStock,
  claveCombinacion,
  etiquetaVariante,
  generarCombinaciones,
  normalizarOpciones,
  rangoPrecios,
  valorDisponible,
  varianteDeSeleccion,
} from '../../../../supabase/functions/_shared/variantes';

const v = (valor: string) => ({ valor, foto_url: null });
const TALLA: OpcionDef = { nombre: 'Talla', valores: [v('S'), v('M')] };
const COLOR: OpcionDef = { nombre: 'Color', valores: [v('Negro'), v('Rosa')] };
const ORDEN = ['Talla', 'Color'];

describe('normalizarOpciones', () => {
  it('recorta espacios y quita valores repetidos sin importar mayúsculas', () => {
    const r = normalizarOpciones([{ nombre: ' Color ', valores: [v('Rosa '), v('rosa'), v(''), v('Negro')] }]);
    expect(r).toEqual([{ nombre: 'Color', valores: [v('Rosa'), v('Negro')] }]);
  });

  it('descarta opciones sin nombre o sin valores y nombres repetidos', () => {
    const r = normalizarOpciones([
      { nombre: '', valores: [v('X')] },
      { nombre: 'Talla', valores: [] },
      { nombre: 'Color', valores: [v('Rojo')] },
      { nombre: 'color', valores: [v('Azul')] },
    ]);
    expect(r).toEqual([{ nombre: 'Color', valores: [v('Rojo')] }]);
  });

  it('conserva la foto del primer valor', () => {
    const r = normalizarOpciones([{ nombre: 'Color', valores: [{ valor: 'Rosa', foto_url: 'a.jpg' }, v('rosa')] }]);
    expect(r[0].valores[0].foto_url).toBe('a.jpg');
  });
});

describe('generarCombinaciones', () => {
  it('produce el producto cartesiano en orden', () => {
    expect(generarCombinaciones([TALLA, COLOR])).toEqual([
      { Talla: 'S', Color: 'Negro' }, { Talla: 'S', Color: 'Rosa' },
      { Talla: 'M', Color: 'Negro' }, { Talla: 'M', Color: 'Rosa' },
    ]);
  });

  it('sin opciones no hay combinaciones', () => {
    expect(generarCombinaciones([])).toEqual([]);
  });
});

describe('claveCombinacion y etiquetaVariante', () => {
  it('la clave no depende del orden de las propiedades', () => {
    expect(claveCombinacion({ Color: 'Rosa', Talla: 'M' }, ORDEN))
      .toBe(claveCombinacion({ Talla: 'M', Color: 'Rosa' }, ORDEN));
  });

  it('la etiqueta sigue el orden de las opciones', () => {
    expect(etiquetaVariante({ Color: 'Rosa', Talla: 'M' }, ORDEN)).toBe('M · Rosa');
  });
});

const VARS: VarianteConStock[] = [
  { id: 'sn', opciones: { Talla: 'S', Color: 'Negro' }, precio: null,  activo: true, disponible: 0 },
  { id: 'sr', opciones: { Talla: 'S', Color: 'Rosa'  }, precio: null,  activo: true, disponible: 2 },
  { id: 'mn', opciones: { Talla: 'M', Color: 'Negro' }, precio: 55000, activo: true, disponible: 1 },
  { id: 'mr', opciones: { Talla: 'M', Color: 'Rosa'  }, precio: null,  activo: false, disponible: 5 },
];

describe('varianteDeSeleccion', () => {
  it('encuentra la variante cuando todas las opciones están elegidas', () => {
    expect(varianteDeSeleccion(VARS, { Talla: 'M', Color: 'Negro' }, ORDEN)?.id).toBe('mn');
  });

  it('devuelve null con selección incompleta o inactiva', () => {
    expect(varianteDeSeleccion(VARS, { Talla: 'M' }, ORDEN)).toBeNull();
    expect(varianteDeSeleccion(VARS, { Talla: 'M', Color: 'Rosa' }, ORDEN)).toBeNull();
  });
});

describe('valorDisponible', () => {
  it('sin selección previa: el valor está si alguna combinación activa tiene stock', () => {
    expect(valorDisponible(VARS, {}, 'Color', 'Negro')).toBe(true);   // M·Negro
    expect(valorDisponible(VARS, {}, 'Color', 'Rosa')).toBe(true);    // S·Rosa
  });

  it('respeta lo ya elegido en otras opciones', () => {
    expect(valorDisponible(VARS, { Talla: 'S' }, 'Color', 'Negro')).toBe(false);
    expect(valorDisponible(VARS, { Talla: 'M' }, 'Color', 'Rosa')).toBe(false); // inactiva
  });

  it('ignora la selección actual de la misma opción', () => {
    expect(valorDisponible(VARS, { Talla: 'S', Color: 'Rosa' }, 'Talla', 'M')).toBe(false);
    expect(valorDisponible(VARS, { Talla: 'M', Color: 'Rosa' }, 'Talla', 'S')).toBe(true);
  });
});

describe('rangoPrecios', () => {
  it('usa el precio base cuando la variante no tiene precio', () => {
    expect(rangoPrecios(VARS, 50000)).toEqual({ min: 50000, max: 55000 });
  });

  it('null si no hay variantes activas', () => {
    expect(rangoPrecios([], 50000)).toBeNull();
  });
});
