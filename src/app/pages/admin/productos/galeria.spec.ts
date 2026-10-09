// Reglas de la galería del formulario de producto: qué archivo se acepta y cómo
// se acumula la selección. Estaban implícitas en el componente (que reemplazaba
// la selección anterior y no validaba nada) y ahora viven aparte para probarse.
import {
  EstadoGaleria,
  MAX_FOTOS,
  MAX_BYTES,
  agregarAGaleria,
  esArchivo,
  quitarDeGaleria,
  reemplazarEnGaleria,
  totalGaleria,
  validarImagen,
} from './galeria';

function archivo(nombre: string, tipo = 'image/jpeg', bytes = 1024): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}
const nombres = (e: EstadoGaleria) => e.items.map(it => (esArchivo(it) ? it.file.name : it.url));

describe('validarImagen', () => {
  it('acepta JPG, PNG y WebP', () => {
    expect(validarImagen(archivo('a.jpg', 'image/jpeg'))).toBeNull();
    expect(validarImagen(archivo('a.png', 'image/png'))).toBeNull();
    expect(validarImagen(archivo('a.webp', 'image/webp'))).toBeNull();
  });

  it('rechaza un formato no soportado nombrando el archivo', () => {
    const err = validarImagen(archivo('catalogo.pdf', 'application/pdf'));
    expect(err).toContain('catalogo.pdf');
  });

  it('rechaza un archivo más pesado que el máximo', () => {
    expect(validarImagen(archivo('grande.jpg', 'image/jpeg', MAX_BYTES + 1))).toContain('grande.jpg');
  });

  it('acepta un archivo justo en el límite de peso', () => {
    expect(validarImagen(archivo('limite.jpg', 'image/jpeg', MAX_BYTES))).toBeNull();
  });
});

describe('agregarAGaleria', () => {
  it('acumula la nueva selección en vez de reemplazar la anterior', () => {
    const inicial = agregarAGaleria({ items: [] }, [archivo('1.jpg')]);
    const final = agregarAGaleria(inicial.estado, [archivo('2.jpg')]);
    expect(nombres(final.estado)).toEqual(['1.jpg', '2.jpg']);
  });

  it('conserva las fotos ya subidas al agregar nuevas', () => {
    const { estado } = agregarAGaleria({ items: [{ url: 'https://cdn/1.jpg' }] }, [archivo('2.jpg')]);
    expect(nombres(estado)).toEqual(['https://cdn/1.jpg', '2.jpg']);
  });

  it('rechaza los archivos inválidos y deja pasar los válidos', () => {
    const { estado, rechazados } = agregarAGaleria({ items: [] }, [
      archivo('ok.jpg'),
      archivo('malo.pdf', 'application/pdf'),
    ]);
    expect(nombres(estado)).toEqual(['ok.jpg']);
    expect(rechazados).toHaveLength(1);
  });

  it('corta en el máximo de fotos contando las ya subidas', () => {
    const items = Array.from({ length: MAX_FOTOS - 1 }, (_, i) => ({ url: `https://cdn/${i}.jpg` }));
    const { estado, rechazados } = agregarAGaleria({ items }, [archivo('cabe.jpg'), archivo('sobra.jpg')]);
    expect(totalGaleria(estado)).toBe(MAX_FOTOS);
    expect(nombres(estado).at(-1)).toBe('cabe.jpg');
    expect(rechazados.join(' ')).toContain('sobra.jpg');
  });

  it('no muta el estado que recibe', () => {
    const previo: EstadoGaleria = { items: [] };
    agregarAGaleria(previo, [archivo('1.jpg')]);
    expect(previo.items).toHaveLength(0);
  });
});

describe('quitarDeGaleria', () => {
  it('quita por la posición de la grilla, sea subida o nueva', () => {
    const c = archivo('c.jpg');
    const estado: EstadoGaleria = { items: [{ url: 'https://cdn/a.jpg' }, { file: c }, { url: 'https://cdn/b.jpg' }] };
    expect(nombres(quitarDeGaleria(estado, 0).estado)).toEqual(['c.jpg', 'https://cdn/b.jpg']);
    const out = quitarDeGaleria(estado, 1);
    expect(nombres(out.estado)).toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
    expect(out.quitado).toEqual({ file: c });   // para revocar su blob
  });
});

describe('reemplazarEnGaleria', () => {
  it('cambia una foto ya subida por un archivo sin moverla de lugar', () => {
    const girada = archivo('girada.webp', 'image/webp');
    const estado: EstadoGaleria = { items: [{ url: 'https://cdn/a.jpg' }, { url: 'https://cdn/b.jpg' }, { file: archivo('c.jpg') }] };
    const out = reemplazarEnGaleria(estado, 1, girada);
    expect(nombres(out.estado)).toEqual(['https://cdn/a.jpg', 'girada.webp', 'c.jpg']);
    expect(out.anterior).toEqual({ url: 'https://cdn/b.jpg' });
    expect(nombres(estado)[1]).toBe('https://cdn/b.jpg');   // no muta
  });

  it('ignora un índice fuera de rango', () => {
    const estado: EstadoGaleria = { items: [{ url: 'https://cdn/a.jpg' }] };
    expect(reemplazarEnGaleria(estado, 3, archivo('x.jpg'))).toEqual({ estado, anterior: null });
  });
});
