import {
  CLAVE_PEDIDO_PENDIENTE, PedidoPendiente, formatoCuenta, guardarPedidoPendiente,
  leerPedidoPendiente, limpiarPedidoPendiente, limpiarPedidoPendienteDe, segundosRestantes,
} from './pedido-pendiente';

function storageFalso(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k),
    clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, get length() { return m.size; },
  } as Storage;
}

const AHORA = Date.parse('2026-09-29T12:00:00Z');
const P: PedidoPendiente = {
  token: 't', referencia: 'CQV-1', expiraEn: '2026-09-29T12:15:00Z', huella: 'h',
  bold: { apiKey: 'k', orderId: 'CQV-1', amount: '1', currency: 'COP', integritySignature: 's',
          redirectionUrl: 'https://x/?ref=t', description: 'd', customerData: '{}', billingAddress: '{}' },
};

describe('pedido pendiente', () => {
  it('sobrevive a una recarga mientras la reserva está vigente', () => {
    const s = storageFalso();
    guardarPedidoPendiente(s, P);
    expect(leerPedidoPendiente(s, AHORA)).toEqual(P);
  });

  it('se descarta y se borra al vencer', () => {
    const s = storageFalso();
    guardarPedidoPendiente(s, P);
    expect(leerPedidoPendiente(s, Date.parse('2026-09-29T12:15:01Z'))).toBeNull();
    expect(s.getItem(CLAVE_PEDIDO_PENDIENTE)).toBeNull();
  });

  it('conserva el descuento aplicado al pedido', () => {
    const s = storageFalso();
    const conDesc: PedidoPendiente = { ...P, descuento: { codigo: 'CUAC10', monto: 5000 } };
    guardarPedidoPendiente(s, conDesc);
    expect(leerPedidoPendiente(s, AHORA)).toEqual(conDesc);
  });

  it('lee entradas viejas sin descuento', () => {
    const s = storageFalso();
    s.setItem(CLAVE_PEDIDO_PENDIENTE, JSON.stringify(P));
    const leido = leerPedidoPendiente(s, AHORA);
    expect(leido).toEqual(P);
    expect(leido?.descuento).toBeUndefined();
  });

  it('descarta un descuento mal formado sin perder el pedido', () => {
    const s = storageFalso();
    s.setItem(CLAVE_PEDIDO_PENDIENTE, JSON.stringify({ ...P, descuento: { codigo: 5 } }));
    const leido = leerPedidoPendiente(s, AHORA);
    expect(leido?.token).toBe('t');
    expect(leido?.descuento).toBeUndefined();
  });

  it('tolera JSON corrupto y storage ausente', () => {
    const s = storageFalso();
    s.setItem(CLAVE_PEDIDO_PENDIENTE, '{no');
    expect(leerPedidoPendiente(s, AHORA)).toBeNull();
    expect(leerPedidoPendiente(null, AHORA)).toBeNull();
    expect(() => guardarPedidoPendiente(null, P)).not.toThrow();
  });

  it('limpia', () => {
    const s = storageFalso();
    guardarPedidoPendiente(s, P);
    limpiarPedidoPendiente(s);
    expect(leerPedidoPendiente(s, AHORA)).toBeNull();
  });

  it('cuenta regresiva', () => {
    expect(segundosRestantes(P.expiraEn, AHORA)).toBe(900);
    expect(segundosRestantes(P.expiraEn, Date.parse('2026-09-29T12:20:00Z'))).toBe(0);
    expect(formatoCuenta(754)).toBe('12:34');
    expect(formatoCuenta(5)).toBe('0:05');
  });
});

describe('limpiarPedidoPendienteDe', () => {
  it('borra el pedido guardado si el token coincide', () => {
    const s = storageFalso();
    guardarPedidoPendiente(s, { ...P, expiraEn: new Date(Date.now() + 600_000).toISOString() });
    limpiarPedidoPendienteDe(s, 't');
    expect(s.getItem(CLAVE_PEDIDO_PENDIENTE)).toBeNull();
  });

  it('no toca el pedido guardado si es de otro token', () => {
    const s = storageFalso();
    guardarPedidoPendiente(s, { ...P, expiraEn: new Date(Date.now() + 600_000).toISOString() });
    limpiarPedidoPendienteDe(s, 'otro');
    expect(s.getItem(CLAVE_PEDIDO_PENDIENTE)).not.toBeNull();
  });

  it('tolera storage nulo', () => {
    expect(() => limpiarPedidoPendienteDe(null, 't')).not.toThrow();
  });
});
