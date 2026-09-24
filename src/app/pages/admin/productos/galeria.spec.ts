// Reglas de la galería del formulario de producto: qué archivo se acepta y cómo
// se acumula la selección. Estaban implícitas en el componente (que reemplazaba
// la selección anterior y no validaba nada) y ahora viven aparte para probarse.
import {
  MAX_FOTOS,
  MAX_BYTES,
  agregarAGaleria,
  quitarDeGaleria,
  totalGaleria,
  validarImagen,
} from './galeria';

function archivo(nombre: string, tipo = 'image/jpeg', bytes = 1024): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

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
    const inicial = agregarAGaleria({ existentes: [], nuevos: [] }, [archivo('1.jpg')]);
    const final = agregarAGaleria(inicial.estado, [archivo('2.jpg')]);
    expect(final.estado.nuevos.map(f => f.name)).toEqual(['1.jpg', '2.jpg']);
  });

  it('conserva las fotos ya subidas al agregar nuevas', () => {
    const { estado } = agregarAGaleria(
      { existentes: ['https://cdn/1.jpg'], nuevos: [] },
      [archivo('2.jpg')],
    );
    expect(estado.existentes).toEqual(['https://cdn/1.jpg']);
    expect(estado.nuevos).toHaveLength(1);
  });

  it('rechaza los archivos inválidos y deja pasar los válidos', () => {
    const { estado, rechazados } = agregarAGaleria({ existentes: [], nuevos: [] }, [
      archivo('ok.jpg'),
      archivo('malo.pdf', 'application/pdf'),
    ]);
    expect(estado.nuevos.map(f => f.name)).toEqual(['ok.jpg']);
    expect(rechazados).toHaveLength(1);
  });

  it('corta en el máximo de fotos contando las ya subidas', () => {
    const existentes = Array.from({ length: MAX_FOTOS - 1 }, (_, i) => `https://cdn/${i}.jpg`);
    const { estado, rechazados } = agregarAGaleria({ existentes, nuevos: [] }, [
      archivo('cabe.jpg'),
      archivo('sobra.jpg'),
    ]);
    expect(totalGaleria(estado)).toBe(MAX_FOTOS);
    expect(estado.nuevos.map(f => f.name)).toEqual(['cabe.jpg']);
    expect(rechazados.join(' ')).toContain('sobra.jpg');
  });

  it('no muta el estado que recibe', () => {
    const previo = { existentes: [] as string[], nuevos: [] as File[] };
    agregarAGaleria(previo, [archivo('1.jpg')]);
    expect(previo.nuevos).toHaveLength(0);
  });
});

describe('quitarDeGaleria', () => {
  it('quita una foto ya subida por su posición', () => {
    const estado = { existentes: ['https://cdn/a.jpg', 'https://cdn/b.jpg'], nuevos: [archivo('c.jpg')] };
    const out = quitarDeGaleria(estado, 0);
    expect(out.estado.existentes).toEqual(['https://cdn/b.jpg']);
    expect(out.estado.nuevos).toHaveLength(1);
  });

  it('quita un archivo nuevo usando el índice global de la grilla', () => {
    const estado = { existentes: ['https://cdn/a.jpg'], nuevos: [archivo('b.jpg'), archivo('c.jpg')] };
    const out = quitarDeGaleria(estado, 2);
    expect(out.estado.existentes).toEqual(['https://cdn/a.jpg']);
    expect(out.estado.nuevos.map(f => f.name)).toEqual(['b.jpg']);
  });

  it('informa cuál archivo nuevo salió, para poder revocar su blob', () => {
    const b = archivo('b.jpg');
    const out = quitarDeGaleria({ existentes: [], nuevos: [b] }, 0);
    expect(out.archivoQuitado).toBe(b);
  });

  it('no reporta archivo quitado cuando se elimina una foto ya subida', () => {
    const out = quitarDeGaleria({ existentes: ['https://cdn/a.jpg'], nuevos: [] }, 0);
    expect(out.archivoQuitado).toBeNull();
  });
});
