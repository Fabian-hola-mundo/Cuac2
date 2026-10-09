import { agruparTransacciones, cajas, cuadre, dias, diaLocal, filtrar, montoLinea } from './cuadre';
import type { VentaEvento } from '../../../core/services/inventario.service';

const base = {
  sincronizado: true, evento_id: 'sofa-2026', producto_id: 'p', canal: null,
} as const;

const ventas: VentaEvento[] = [
  { ...base, id: 'a', transaccion_id: 'T1', metodo_pago: 'efectivo', precio_unitario: 8000, cantidad: 2,
    dispositivo: 'Caja 1', dispositivo_id: 'd1', vendido_en: '2026-10-12T15:00:00Z',
    productos_evento: { nombre: 'Sticker', categoria: 'sticker' },
    producto_variantes: { opciones: { Talla: 'M', Color: 'Rojo' } } },
  { ...base, id: 'b', transaccion_id: 'T1', metodo_pago: 'efectivo', precio_unitario: 45000, cantidad: 1,
    dispositivo: 'Caja 1', dispositivo_id: 'd1', vendido_en: '2026-10-12T15:00:00Z', comentario: 'regalo',
    productos_evento: { nombre: 'Tee', categoria: 'tee' } },
  { ...base, id: 'c', transaccion_id: 'T2', metodo_pago: 'qr', precio_unitario: 5000, cantidad: 3,
    dispositivo: 'Caja 2', dispositivo_id: 'd2', vendido_en: '2026-10-12T16:00:00Z',
    productos_evento: { nombre: 'Pin', categoria: 'pin' } },
  { ...base, id: 'old', transaccion_id: null, metodo_pago: null, precio_unitario: null, cantidad: 1,
    dispositivo: 'Caja 1', dispositivo_id: null, vendido_en: '2026-10-11T15:00:00Z',
    productos_evento: { nombre: 'Viejo', categoria: 'pin', precio: 4000 } },
  { ...base, id: 'w', canal: 'web', cantidad: 99, dispositivo: null, vendido_en: '2026-10-12T17:00:00Z',
    productos_evento: { nombre: 'Web', categoria: 'pin', precio: 1000 } },
];

describe('cuadre', () => {
  const tx = agruparTransacciones(ventas);

  it('agrupa por transacción y excluye web', () => {
    expect(tx).toHaveLength(3);
    expect(tx.find(t => t.id === 'T1')!.total).toBe(61000);
    expect(tx.find(t => t.id === 'T1')!.lineas).toHaveLength(2);
    expect(tx.map(t => t.id)).toEqual(['T2', 'T1', 'old']);
  });

  it('arma variante con valores ordenados por nombre de opción y comentario', () => {
    const t1 = tx.find(t => t.id === 'T1')!;
    expect(t1.lineas[0].variante).toBe('Rojo / M');
    expect(t1.lineas[1].variante).toBeNull();
    expect(t1.comentario).toBe('regalo');
    expect(t1.caja).toBe('d1');
    expect(t1.cajaNombre).toBe('Caja 1');
  });

  it('cuadre por medio con las cuatro claves', () => {
    expect(cuadre(tx)).toEqual({
      efectivo: { total: 61000, ventas: 1 }, qr: { total: 15000, ventas: 1 },
      datafono: { total: 0, ventas: 0 }, sin_registrar: { total: 4000, ventas: 1 } });
  });

  it('montoLinea usa precio guardado y cae a 0 sin precio', () => {
    expect(montoLinea({ ...ventas[0], productos_evento: { nombre: 'x', categoria: 'y', precio: 1 } })).toBe(16000);
    expect(montoLinea({ ...ventas[3], productos_evento: { nombre: 'x', categoria: 'y' } })).toBe(0);
  });

  it('diaLocal usa hora de Bogotá', () => {
    expect(diaLocal('2026-10-12T03:30:00Z')).toBe('2026-10-11');
  });

  it('filtra por caja y día', () => {
    expect(filtrar(tx, { caja: 'd2', dia: null }).map(t => t.id)).toEqual(['T2']);
    expect(filtrar(tx, { caja: null, dia: '2026-10-11' }).map(t => t.id)).toEqual(['old']);
    expect(filtrar(tx, { caja: null, dia: null })).toHaveLength(3);
  });

  it('lista cajas y días únicos', () => {
    expect(cajas(tx)).toEqual([
      { clave: 'd2', nombre: 'Caja 2' }, { clave: 'd1', nombre: 'Caja 1' },
      { clave: 'nombre:Caja 1', nombre: 'Caja 1' }]);
    expect(dias(tx)).toEqual(['2026-10-12', '2026-10-11']);
  });
});
