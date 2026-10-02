// Dashboard, Pedidos, Clientes y Pagos salen de las filas de `pedidos`. Antes
// leían arreglos vacíos de una maqueta y nunca mostraban los pedidos reales.
import { mapearPedidos } from './admin-data.service';

const fila = (over: Record<string, unknown>) => ({
  id: 'aaaaaaaa-0000-0000-0000-000000000000',
  referencia: 'CUAC-1',
  estado: 'aprobado',
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'Ana@Correo.com ',
  celular: '3001234567',
  ciudad: 'Bogotá',
  direccion: 'Calle 1',
  total: 50000,
  bold_payment_id: 'BOLD-1',
  creado_en: '2026-10-01T15:00:00Z',
  pedido_items: [
    { nombre: 'Camiseta Cuac', sub: 'Camiseta', variante_label: 'M · Rosa', precio: 20000, cantidad: 2 },
    { nombre: 'Sticker Kiki', sub: 'Sticker', variante_label: null, precio: 10000, cantidad: 1 },
  ],
  ...over,
}) as any;

describe('mapearPedidos', () => {
  it('traduce el estado y suma las unidades', () => {
    const { orders } = mapearPedidos([
      fila({}),
      fila({ id: 'b', referencia: 'CUAC-2', estado: 'pendiente' }),
      fila({ id: 'c', referencia: 'CUAC-3', estado: 'rechazado' }),
      fila({ id: 'd', referencia: 'CUAC-4', estado: 'cancelado' }),
    ]);
    expect(orders.map(o => o.status)).toEqual(['paid', 'pending', 'failed', 'cancelled']);
    expect(orders[0]).toMatchObject({ id: 'CUAC-1', customer: 'Ana Pérez', items: 3, total: 50000 });
  });

  it('trae los artículos del pedido con su variante y precio', () => {
    const { orders } = mapearPedidos([fila({}), fila({ id: 'b', referencia: 'CUAC-2', pedido_items: null })]);
    expect(orders[0].lines).toEqual([
      { name: 'Camiseta Cuac', detail: 'Camiseta', variant: 'M · Rosa', price: 20000, qty: 2 },
      { name: 'Sticker Kiki', detail: 'Sticker', variant: null, price: 10000, qty: 1 },
    ]);
    expect(orders[1].lines).toEqual([]);
  });

  it('agrupa los pedidos de un mismo correo en un cliente', () => {
    const { customers } = mapearPedidos([
      fila({ id: 'b', referencia: 'CUAC-2', email: 'ana@correo.com', creado_en: '2026-10-02T15:00:00Z' }),
      fila({}),
      fila({ id: 'c', referencia: 'CUAC-3', email: 'otro@correo.com', estado: 'rechazado' }),
    ]);
    expect(customers).toHaveLength(2);
    const ana = customers.find(c => c.id === 'ana@correo.com')!;
    expect(ana).toMatchObject({ orders: 2, spent: 100000, tag: 'Activo', since: '2026-10-01' });
    expect(customers.find(c => c.id === 'otro@correo.com')!.tag).toBe('Fallido');
  });

  it('crea un pago por pedido con el id de Bold cuando existe', () => {
    const { payments } = mapearPedidos([fila({}), fila({ id: 'b', referencia: 'CUAC-2', bold_payment_id: null })]);
    expect(payments.map(p => p.id)).toEqual(['BOLD-1', 'PAG-CUAC-2']);
    expect(payments[0]).toMatchObject({ orderId: 'CUAC-1', amount: 50000, net: 50000, status: 'paid' });
  });
});
