// Rutas de Supabase Storage para las imágenes de producto.
//
// El bug que motiva estas pruebas: duplicarProducto copiaba cover_url y fotos
// tal cual, así que el duplicado apuntaba a los archivos físicos del original.
import { BUCKET_PRODUCTOS, planCopiaImagenes, rutaImagen, rutaDesdeUrlPublica } from './productos-storage';

const base = `https://xyz.supabase.co/storage/v1/object/public/${BUCKET_PRODUCTOS}/`;

describe('rutaImagen', () => {
  it('guarda cada producto en su propia carpeta', () => {
    expect(rutaImagen('abc-123', 'cover.jpg')).toBe('abc-123/cover.jpg');
  });

  it('sanea los caracteres que Storage no admite en el nombre', () => {
    expect(rutaImagen('abc', 'mi foto (1).jpg')).toBe('abc/mi_foto__1_.jpg');
  });

  it('no deja que el nombre escape de la carpeta del producto', () => {
    expect(rutaImagen('abc', '../otro/cover.jpg')).toBe('abc/.._otro_cover.jpg');
  });
});

describe('rutaDesdeUrlPublica', () => {
  it('extrae la ruta interna de una URL pública del bucket', () => {
    expect(rutaDesdeUrlPublica(`${base}abc-123/cover.jpg`)).toBe('abc-123/cover.jpg');
  });

  it('ignora los parámetros de consulta que agrega Supabase', () => {
    expect(rutaDesdeUrlPublica(`${base}abc-123/cover.jpg?t=1700000000`)).toBe('abc-123/cover.jpg');
  });

  it('devuelve null para una URL que no vive en nuestro bucket', () => {
    expect(rutaDesdeUrlPublica('https://cdn.ajeno.com/foto.jpg')).toBeNull();
  });

  it('devuelve null para una cadena vacía', () => {
    expect(rutaDesdeUrlPublica('')).toBeNull();
  });
});

describe('planCopiaImagenes', () => {
  it('manda la portada del duplicado a la carpeta del producto nuevo', () => {
    const plan = planCopiaImagenes({ cover_url: `${base}viejo/cover.jpg`, fotos: [] }, 'nuevo');
    expect(plan.copias).toEqual([{ from: 'viejo/cover.jpg', to: 'nuevo/cover.jpg' }]);
  });

  it('copia también cada foto de la galería', () => {
    const plan = planCopiaImagenes(
      { cover_url: null, fotos: [`${base}viejo/foto_0.jpg`, `${base}viejo/foto_1.png`] },
      'nuevo',
    );
    expect(plan.copias.map(c => c.to)).toEqual(['nuevo/foto_0.jpg', 'nuevo/foto_1.png']);
  });

  it('deja las URLs externas intactas sin intentar copiarlas', () => {
    const plan = planCopiaImagenes({ cover_url: 'https://cdn.ajeno.com/x.jpg', fotos: [] }, 'nuevo');
    expect(plan.copias).toEqual([]);
    expect(plan.cover_url).toBe('https://cdn.ajeno.com/x.jpg');
  });

  it('no deja ninguna ruta del original en las URLs resultantes', () => {
    const plan = planCopiaImagenes(
      { cover_url: `${base}viejo/cover.jpg`, fotos: [`${base}viejo/foto_0.jpg`] },
      'nuevo',
    );
    expect(plan.cover_url).not.toContain('viejo/');
    expect(plan.fotos.every(f => !f.includes('viejo/'))).toBe(true);
  });

  it('resuelve la URL nueva con el resolvedor que le pasen', () => {
    const plan = planCopiaImagenes(
      { cover_url: `${base}viejo/cover.jpg`, fotos: [] },
      'nuevo',
      ruta => `https://cdn.test/${ruta}`,
    );
    expect(plan.cover_url).toBe('https://cdn.test/nuevo/cover.jpg');
  });

  it('sobrevive a un producto sin imágenes', () => {
    const plan = planCopiaImagenes({ cover_url: null, fotos: [] }, 'nuevo');
    expect(plan).toEqual({ copias: [], cover_url: null, fotos: [] });
  });
});
