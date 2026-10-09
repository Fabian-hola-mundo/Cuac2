// src/app/pages/admin/productos/variantes-editor/filas.spec.ts
import { agregarValoresPendientes, contarDesactivadas, reconciliarFilas } from './filas';

const v = (valor: string) => ({ valor, foto_url: null });
const EXISTENTES = [
  { id: 'sn', producto_id: 'p', opciones: { Talla: 'S', Color: 'Negro' }, precio: null, stock_actual: 3, activo: true, posicion: 0 },
  { id: 'sr', producto_id: 'p', opciones: { Talla: 'S', Color: 'Rosa' }, precio: 9, stock_actual: 1, activo: true, posicion: 1 },
];

describe('reconciliarFilas', () => {
  it('conserva stock/precio/id de las combinaciones existentes y crea las nuevas en 0', () => {
    const filas = reconciliarFilas(
      [{ nombre: 'Talla', valores: [v('S'), v('M')] }, { nombre: 'Color', valores: [v('Negro')] }],
      [], EXISTENTES);
    expect(filas.map(f => [f.etiqueta, f.id, f.stock, f.existente])).toEqual([
      ['S · Negro', 'sn', 3, true],
      ['M · Negro', null, 0, false],
    ]);
  });

  it('conserva lo que el admin ya escribió en filas nuevas al añadir otro valor', () => {
    const previas = reconciliarFilas([{ nombre: 'Talla', valores: [v('M')] }], [], []);
    previas[0].stock = 7; previas[0].precio = 60000;
    const filas = reconciliarFilas([{ nombre: 'Talla', valores: [v('M'), v('L')] }], previas, []);
    expect(filas.map(f => [f.etiqueta, f.stock, f.precio])).toEqual([['M', 7, 60000], ['L', 0, null]]);
  });

  it('conserva el stock escrito a mano en una existente y recuerda su base', () => {
    const opciones = [{ nombre: 'Talla', valores: [v('S')] }, { nombre: 'Color', valores: [v('Negro')] }];
    const previas = reconciliarFilas(opciones, [], EXISTENTES);
    previas[0].stock = 10;
    const filas = reconciliarFilas(opciones, previas, EXISTENTES);
    expect(filas.map(f => [f.etiqueta, f.stock, f.stockBase])).toEqual([['S · Negro', 10, 3]]);
  });
});

describe('contarDesactivadas', () => {
  it('cuenta las existentes activas que ya no están en las filas', () => {
    const filas = reconciliarFilas([{ nombre: 'Talla', valores: [v('S')] }, { nombre: 'Color', valores: [v('Negro')] }], [], EXISTENTES);
    expect(contarDesactivadas(EXISTENTES, filas, ['Talla', 'Color'])).toBe(1);
  });
});

// La base compara las opciones como JSON exacto: { Color: 'Negro' } no es
// { Talla: 'S', Color: 'Negro' }. Una variante con claves de más no es la misma.
describe('quitar una opción', () => {
  it('las filas que quedan son nuevas y todas las existentes activas se desactivan', () => {
    const filas = reconciliarFilas([{ nombre: 'Color', valores: [v('Negro')] }], [], EXISTENTES);
    expect(filas.map(f => [f.etiqueta, f.id, f.stock, f.existente])).toEqual([['Negro', null, 0, false]]);
    expect(contarDesactivadas(EXISTENTES, filas, ['Color'])).toBe(2);
  });

  it('una opción sin nombre cuenta igual que quitarla', () => {
    const filas = reconciliarFilas(
      [{ nombre: '  ', valores: [v('S')] }, { nombre: 'Color', valores: [v('Negro')] }], [], EXISTENTES);
    expect(filas.map(f => [f.etiqueta, f.id, f.stock, f.existente])).toEqual([['Negro', null, 0, false]]);
    expect(contarDesactivadas(EXISTENTES, filas, ['Color'])).toBe(2);
  });
});

describe('agregarValoresPendientes', () => {
  it('suma a cada opción el valor escrito sin Enter, recortado', () => {
    const ops = [{ nombre: 'Talla', valores: [v('S')] }, { nombre: 'Color', valores: [] }];
    expect(agregarValoresPendientes(ops, { 0: ' M ', 1: 'Negro' })).toEqual([
      { nombre: 'Talla', valores: [v('S'), v('M')] },
      { nombre: 'Color', valores: [v('Negro')] },
    ]);
  });

  it('ignora vacíos y repetidos (sin distinguir mayúsculas)', () => {
    const ops = [{ nombre: 'Talla', valores: [v('S')] }];
    expect(agregarValoresPendientes(ops, { 0: 's ' })).toBe(ops);
    expect(agregarValoresPendientes(ops, { 0: '   ' })).toBe(ops);
    expect(agregarValoresPendientes(ops, {})).toBe(ops);
  });
});
