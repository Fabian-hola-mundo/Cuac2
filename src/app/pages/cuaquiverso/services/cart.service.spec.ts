import { TestBed } from '@angular/core/testing';
import { CartService, claveLinea, migrarCarritoV1 } from './cart.service';

const base = { name: 'Gorra', sub: 'Gorra', price: 40000, color: 'rio', categoria: 'gorra' };

describe('CartService con variantes', () => {
  beforeEach(() => { localStorage.clear(); TestBed.configureTestingModule({}); });

  it('dos variantes del mismo producto son dos líneas', () => {
    const cart = TestBed.inject(CartService);
    cart.add({ ...base, id: 'g', varianteId: 'n', varianteLabel: 'Negro', stock: 3 });
    cart.add({ ...base, id: 'g', varianteId: 'r', varianteLabel: 'Rosa', stock: 3 });
    cart.add({ ...base, id: 'g', varianteId: 'n', varianteLabel: 'Negro', stock: 3 });
    expect(cart.items().map(i => [i.varianteId, i.qty])).toEqual([['n', 2], ['r', 1]]);
  });

  it('updateQty y remove actúan sobre la línea', () => {
    const cart = TestBed.inject(CartService);
    cart.add({ ...base, id: 'g', varianteId: 'n', stock: 5 });
    cart.add({ ...base, id: 'g', varianteId: 'r', stock: 5 });
    cart.updateQty(claveLinea({ id: 'g', varianteId: 'r' }), 4);
    cart.remove(claveLinea({ id: 'g', varianteId: 'n' }));
    expect(cart.items().map(i => [i.varianteId, i.qty])).toEqual([['r', 4]]);
  });

  it('el tope usa el stock de la variante', () => {
    const cart = TestBed.inject(CartService);
    expect(cart.add({ ...base, id: 'g', varianteId: 'n', stock: 1 })).toBe(true);
    expect(cart.add({ ...base, id: 'g', varianteId: 'n', stock: 1 })).toBe(false);
  });
});

describe('migrarCarritoV1', () => {
  it('conserva las líneas válidas como líneas sin variante', () => {
    const v1 = JSON.stringify({ guardadoEn: Date.now(), items: [{ ...base, id: 'p', qty: 2 }, { id: 3 }] });
    expect(migrarCarritoV1(v1)).toEqual([{ ...base, id: 'p', qty: 2 }]);
  });

  it('descarta un v1 vencido o corrupto', () => {
    expect(migrarCarritoV1(JSON.stringify({ guardadoEn: 0, items: [{ ...base, id: 'p', qty: 1 }] }))).toEqual([]);
    expect(migrarCarritoV1('{no')).toEqual([]);
    expect(migrarCarritoV1(null)).toEqual([]);
  });
});
