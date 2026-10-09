import { resolverLineas } from '../../../../supabase/functions/_shared/variantes';

const PRODUCTOS = [
  { id: 'gorra', nombre: 'Gorra', categoria: 'gorra', precio: 40000, activo: true },
  { id: 'pin',   nombre: 'Pin',   categoria: 'pin',   precio: 8000,  activo: true },
];
const VARIANTES = [
  { id: 'g-n', producto_id: 'gorra', opciones: { Color: 'Negro' }, precio: null,  activo: true },
  { id: 'g-r', producto_id: 'gorra', opciones: { Color: 'Rosa' },  precio: 45000, activo: true },
  { id: 'g-v', producto_id: 'gorra', opciones: { Color: 'Verde' }, precio: null,  activo: false },
];
const OPCIONES = [{ producto_id: 'gorra', nombre: 'Color', posicion: 0 }];

describe('resolverLineas', () => {
  it('toma el precio de la variante o del producto y arma la etiqueta', () => {
    const r = resolverLineas(
      [{ id: 'gorra', variante_id: 'g-r', cantidad: 2 }, { id: 'gorra', variante_id: 'g-n', cantidad: 1 },
       { id: 'pin', cantidad: 3 }],
      PRODUCTOS, VARIANTES, OPCIONES);
    if (!r.ok) throw new Error(r.error);
    expect(r.lineas.map(l => [l.precio, l.varianteLabel])).toEqual([[45000, 'Rosa'], [40000, 'Negro'], [8000, null]]);
  });

  it('rechaza con 400 un producto con variantes pedido sin variante (carrito viejo)', () => {
    const r = resolverLineas([{ id: 'gorra', cantidad: 1 }], PRODUCTOS, VARIANTES, OPCIONES);
    expect(r).toEqual({ ok: false, status: 400,
      error: '"Gorra" ahora tiene opciones. Quítalo del carrito y vuelve a agregarlo eligiendo la tuya.' });
  });

  it('rechaza variantes inactivas o de otro producto', () => {
    expect(resolverLineas([{ id: 'gorra', variante_id: 'g-v', cantidad: 1 }], PRODUCTOS, VARIANTES, OPCIONES).ok).toBe(false);
    expect(resolverLineas([{ id: 'pin', variante_id: 'g-n', cantidad: 1 }], PRODUCTOS, VARIANTES, OPCIONES).ok).toBe(false);
  });

  it('rechaza con 422 productos inexistentes o inactivos', () => {
    const r = resolverLineas([{ id: 'nada', cantidad: 1 }], PRODUCTOS, VARIANTES, OPCIONES);
    expect(r).toEqual({ ok: false, status: 422, error: 'Alguno de los productos ya no está disponible' });
  });
});
