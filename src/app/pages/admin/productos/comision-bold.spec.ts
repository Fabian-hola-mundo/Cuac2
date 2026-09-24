// La ganancia real que muestra el formulario de producto sale de aquí, así que
// la aritmética se prueba fuera del componente: un error de redondeo en esta
// pantalla se traduce en poner precios con la ganancia equivocada.
import { COMISION_BOLD_POR_DEFECTO, comisionBold } from './comision-bold';

describe('comisionBold', () => {
  it('descuenta la tarifa por defecto con IVA sobre la comisión', () => {
    // 45.000 × 2,99% = 1.345,5 → +19% de IVA = 1.601,145 → 1.601
    const { comision, ganancia } = comisionBold(45_000);
    expect(comision).toBe(1601);
    expect(ganancia).toBe(43_399);
  });

  it('la comisión y la ganancia siempre suman el precio', () => {
    for (const precio of [1000, 28_000, 45_000, 199_900]) {
      const { comision, ganancia } = comisionBold(precio);
      expect(comision + ganancia).toBe(precio);
    }
  });

  it('sin IVA cobra sólo el porcentaje base', () => {
    const { comision } = comisionBold(100_000, 3, false);
    expect(comision).toBe(3000);
  });

  it('acepta un porcentaje distinto al de por defecto', () => {
    const { comision } = comisionBold(100_000, 2, false);
    expect(comision).toBe(2000);
    expect(COMISION_BOLD_POR_DEFECTO).toBeGreaterThan(0);
  });

  it('sin precio no inventa una comisión', () => {
    expect(comisionBold(null)).toEqual({ comision: 0, ganancia: 0 });
    expect(comisionBold(0)).toEqual({ comision: 0, ganancia: 0 });
  });

  it('ignora porcentajes imposibles en vez de devolver una ganancia mayor al precio', () => {
    expect(comisionBold(10_000, -5)).toEqual({ comision: 0, ganancia: 10_000 });
    expect(comisionBold(10_000, NaN)).toEqual({ comision: 0, ganancia: 10_000 });
  });
});
