// Reglas de las imágenes de producto: qué archivo se acepta y cómo se acumula
// la selección de la galería.
//
// El límite y los formatos se anunciaban en la plantilla del formulario pero no
// se validaban en ninguna parte; aquí quedan en un solo sitio, probados, y los
// usan tanto el formulario como InventarioService antes de subir a Storage.

/** Máximo de fotos de galería por producto (sin contar la portada). */
export const MAX_FOTOS = 8;

/** Tope de peso por imagen. Storage acepta más, pero 5 MB ya es una foto enorme. */
export const MAX_BYTES = 5 * 1024 * 1024;

export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Una foto de la galería: ya guardada en Storage, o elegida y sin subir. */
export type ItemGaleria = { url: string } | { file: File };

/**
 * La galería en el orden que ve el admin. Antes eran dos listas (guardadas
 * primero, nuevas después), y por eso una foto ya subida no podía cambiarse
 * por otra versión —p. ej. girada— sin saltar al final.
 */
export interface EstadoGaleria {
  items: ItemGaleria[];
}

export const esArchivo = (it: ItemGaleria): it is { file: File } => 'file' in it;

export function totalGaleria(estado: EstadoGaleria): number {
  return estado.items.length;
}

/** Devuelve el mensaje de error, o null si la imagen sirve. */
export function validarImagen(file: File): string | null {
  if (!(TIPOS_PERMITIDOS as readonly string[]).includes(file.type)) {
    return `"${file.name}" no es JPG, PNG ni WebP.`;
  }
  if (file.size > MAX_BYTES) {
    const mb = (MAX_BYTES / 1024 / 1024).toFixed(0);
    return `"${file.name}" pesa más de ${mb} MB.`;
  }
  return null;
}

/**
 * Suma la selección a lo que ya había. Antes el componente reemplazaba el
 * arreglo entero, así que elegir fotos dos veces perdía la primera tanda.
 */
export function agregarAGaleria(
  estado: EstadoGaleria,
  seleccion: readonly File[],
): { estado: EstadoGaleria; rechazados: string[] } {
  const items = [...estado.items];
  const rechazados: string[] = [];

  for (const file of seleccion) {
    const error = validarImagen(file);
    if (error) { rechazados.push(error); continue; }
    if (items.length >= MAX_FOTOS) {
      rechazados.push(`"${file.name}" no cabe: máximo ${MAX_FOTOS} fotos.`);
      continue;
    }
    items.push({ file });
  }

  return { estado: { items }, rechazados };
}

/** Quita por el índice que ve el usuario en la grilla y dice qué salió. */
export function quitarDeGaleria(
  estado: EstadoGaleria,
  index: number,
): { estado: EstadoGaleria; quitado: ItemGaleria | null } {
  return {
    estado: { items: estado.items.filter((_, i) => i !== index) },
    quitado: estado.items[index] ?? null,
  };
}

/**
 * Cambia la foto de una posición por otro archivo (p. ej. la misma girada) sin
 * moverla de lugar. Devuelve la anterior para revocar su blob o, si ya estaba
 * subida, borrarla de Storage al guardar.
 */
export function reemplazarEnGaleria(
  estado: EstadoGaleria,
  index: number,
  file: File,
): { estado: EstadoGaleria; anterior: ItemGaleria | null } {
  if (index < 0 || index >= estado.items.length) return { estado, anterior: null };
  return {
    estado: { items: estado.items.map((it, i) => (i === index ? { file } : it)) },
    anterior: estado.items[index],
  };
}
