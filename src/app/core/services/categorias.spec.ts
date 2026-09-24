// Crear una categoría nueva es escribir texto que termina siendo un id en
// `productos_evento.categoria`. Si el slug fuera inconsistente, "Tote bags" y
// "tote-bags" serían dos categorías distintas en el filtro de la tienda.
import {
  esEtiquetaPropia,
  etiquetaCategoria,
  etiquetaFlag,
  etiquetaMaterial,
  slugCategoria,
} from './inventario.service';

describe('slugCategoria', () => {
  it('normaliza lo que escribe el admin', () => {
    expect(slugCategoria('  Termos  ')).toBe('termos');
    expect(slugCategoria('Tote Bags')).toBe('tote-bags');
    expect(slugCategoria('Libretas / Cuadernos')).toBe('libretas-cuadernos');
  });

  it('quita tildes pero conserva la ñ, que ya es parte de un id del catálogo', () => {
    expect(slugCategoria('Pañoleta')).toBe('pañoleta');
    expect(slugCategoria('Camisetas Básicas')).toBe('camisetas-basicas');
  });

  it('no deja guiones sueltos en los extremos', () => {
    expect(slugCategoria('  ¡Pines!  ')).toBe('pines');
    expect(slugCategoria('---')).toBe('');
  });
});

describe('etiquetaCategoria', () => {
  it('usa la etiqueta del catálogo fijo cuando la conoce', () => {
    expect(etiquetaCategoria('tote')).toBe('Tote bags');
  });

  it('inventa una legible para las categorías nuevas', () => {
    expect(etiquetaCategoria('termos')).toBe('Termos');
    expect(etiquetaCategoria('tote-bags')).toBe('Tote bags');
  });
});

describe('etiquetaFlag / esEtiquetaPropia', () => {
  it('traduce las etiquetas fijas y no las trata como propias', () => {
    expect(etiquetaFlag('new')).toBe('Nuevo');
    expect(etiquetaFlag('last')).toBe('Últimas unidades');
    expect(esEtiquetaPropia('new')).toBe(false);
    // 'last' NO puede pintarse como etiqueta libre: el stock es quien decide si
    // quedan pocas unidades, y volver a pintarla sería el bug que ya se corrigió.
    expect(esEtiquetaPropia('last')).toBe(false);
  });

  it('devuelve tal cual el texto que escribe el admin', () => {
    expect(etiquetaFlag('Edición limitada')).toBe('Edición limitada');
    expect(esEtiquetaPropia('Edición limitada')).toBe(true);
  });

  it('sin etiqueta no hay insignia', () => {
    expect(etiquetaFlag(null)).toBe('');
    expect(esEtiquetaPropia(null)).toBe(false);
    expect(esEtiquetaPropia('')).toBe(false);
  });
});

describe('etiquetaMaterial', () => {
  it('traduce los ids de la lista vieja de casillas', () => {
    expect(etiquetaMaterial('algodon')).toBe('Algodón orgánico');
  });

  it('muestra tal cual lo que se escribe ahora', () => {
    expect(etiquetaMaterial('lino crudo')).toBe('Lino crudo');
  });
});
