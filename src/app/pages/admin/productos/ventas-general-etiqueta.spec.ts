// src/app/pages/admin/productos/ventas-general-etiqueta.spec.ts
import { etiquetaEnOrden } from './ventas-general.component';

describe('etiquetaEnOrden', () => {
  // jsonb devuelve las claves ordenadas por largo: { Color, Talla } aunque la opción 1 sea Talla.
  const c = { Color: 'Negro', Talla: 'M' };

  it('sigue el orden de las opciones del producto, no el de las claves del jsonb', () => {
    expect(etiquetaEnOrden(c, ['Talla', 'Color'])).toBe('M · Negro');
  });

  it('sin opciones conocidas cae al orden de las claves', () => {
    expect(etiquetaEnOrden(c, undefined)).toBe('Negro · M');
    expect(etiquetaEnOrden(c, [])).toBe('Negro · M');
  });

  it('no pierde valores de opciones que ya no existen', () => {
    expect(etiquetaEnOrden(c, ['Talla'])).toBe('M · Negro');
  });
});
