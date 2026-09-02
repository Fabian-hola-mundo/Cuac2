// src/app/pages/cuaquiverso/services/bold-shared.spec.ts
//
// Prueba las piezas puras de `supabase/functions/_shared/bold.ts`, que corren en
// las edge functions pero se verifican desde aquí: el builder de pruebas de
// Angular sólo descubre specs dentro de src/.
//
// Vectores de referencia calculados aparte con node:crypto, no con este módulo,
// para que la prueba fije el formato documentado por Bold y no se limite a
// repetir lo que la implementación haga.
import {
  base64Utf8,
  estadoDesdeEvento,
  firmaIntegridad,
  firmaWebhook,
  firmasIguales,
} from '../../../../../supabase/functions/_shared/bold';

describe('firmaIntegridad', () => {
  // Bold: SHA-256 de {orderId}{amount}{currency}{llaveSecreta}.
  // El ejemplo de la documentación concatena "inv033439400COPkgfq2nN0o52XqnuXZWIN2F".
  it('hashea la concatenación en el orden que exige Bold', async () => {
    const firma = await firmaIntegridad('inv03343', 9400, 'COP', 'kgfq2nN0o52XqnuXZWIN2F');
    expect(firma).toBe('620a64c6eab8858d0f96d4f818a1d77be5e9b9eb9dc681f527de1af54fc1b739');
  });

  it('cambia si cambia cualquier parte de la concatenación', async () => {
    const base  = await firmaIntegridad('CQV-1', 50000, 'COP', 's3cr3t');
    const otro  = await firmaIntegridad('CQV-2', 50000, 'COP', 's3cr3t');
    const monto = await firmaIntegridad('CQV-1', 50001, 'COP', 's3cr3t');
    const llave = await firmaIntegridad('CQV-1', 50000, 'COP', 'otra');
    expect(new Set([base, otro, monto, llave]).size).toBe(4);
  });

  // Wompi cobraba en centavos; Bold cobra en pesos sin decimales. Si alguien
  // vuelve a multiplicar por 100 el hash deja de cuadrar con el monto enviado.
  it('serializa el monto sin decimales', async () => {
    const conEntero  = await firmaIntegridad('CQV-1', 50000, 'COP', 's3cr3t');
    const conDecimal = await firmaIntegridad('CQV-1', 50000.0, 'COP', 's3cr3t');
    expect(conEntero).toBe(conDecimal);
  });
});

describe('base64Utf8', () => {
  it('codifica bytes UTF-8, no latin1', () => {
    // btoa() a secas revienta con estos caracteres; el cuerpo del webhook
    // trae nombres de comprador, así que puede llegar con tildes y eñes.
    expect(base64Utf8('Piñata Ñandú café')).toBe('UGnDsWF0YSDDkWFuZMO6IGNhZsOp');
  });

  it('no lanza con caracteres fuera de latin1', () => {
    expect(() => base64Utf8('emoji 🦆 y 日本語')).not.toThrow();
  });
});

describe('firmaWebhook', () => {
  const cuerpo = JSON.stringify({
    id: 'evt-1',
    type: 'SALE_APPROVED',
    data: { metadata: { reference: 'CQV-20260901-1234' } },
  });

  // Bold: HMAC-SHA256(llaveSecreta, base64(cuerpoCrudo)) en hexadecimal.
  it('calcula el HMAC sobre el cuerpo en base64', async () => {
    const firma = await firmaWebhook(cuerpo, 'llave-secreta-de-prueba');
    expect(firma).toBe('8efeb71bc900b01f251a2b177284789bc4d68c322fcf2cdf71cee6d6d57027b0');
  });

  it('cambia si el cuerpo fue manipulado', async () => {
    const original   = await firmaWebhook(cuerpo, 'llave-secreta-de-prueba');
    const manipulado = await firmaWebhook(
      cuerpo.replace('CQV-20260901-1234', 'CQV-20260901-9999'),
      'llave-secreta-de-prueba',
    );
    expect(manipulado).not.toBe(original);
  });
});

describe('firmasIguales', () => {
  const a = '8efeb71bc900b01f251a2b177284789bc4d68c322fcf2cdf71cee6d6d57027b0';

  it('acepta la firma correcta', () => {
    expect(firmasIguales(a, a)).toBe(true);
  });

  it('rechaza una firma alterada en un solo carácter', () => {
    expect(firmasIguales(a, a.replace(/0$/, '1'))).toBe(false);
  });

  it('rechaza firmas de longitud distinta', () => {
    expect(firmasIguales(a, a.slice(0, -2))).toBe(false);
  });

  it('rechaza la firma vacía o ausente', () => {
    expect(firmasIguales('', a)).toBe(false);
    expect(firmasIguales(null, a)).toBe(false);
  });
});

describe('estadoDesdeEvento', () => {
  it('mapea los eventos de venta a estados del pedido', () => {
    expect(estadoDesdeEvento('SALE_APPROVED')).toBe('aprobado');
    expect(estadoDesdeEvento('SALE_REJECTED')).toBe('rechazado');
    expect(estadoDesdeEvento('VOID_APPROVED')).toBe('cancelado');
  });

  it('ignora los eventos que no cambian el estado', () => {
    // Una anulación fallida deja el pedido como estaba.
    expect(estadoDesdeEvento('VOID_REJECTED')).toBeNull();
    expect(estadoDesdeEvento('ALGO_NUEVO')).toBeNull();
    expect(estadoDesdeEvento('')).toBeNull();
  });
});
