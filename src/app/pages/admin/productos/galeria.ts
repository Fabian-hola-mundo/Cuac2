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

export interface EstadoGaleria {
  /** URLs ya guardadas en Supabase Storage. */
  existentes: string[];
  /** Archivos elegidos en esta sesión, todavía sin subir. */
  nuevos: File[];
}

export function totalGaleria(estado: EstadoGaleria): number {
  return estado.existentes.length + estado.nuevos.length;
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
  const nuevos = [...estado.nuevos];
  const rechazados: string[] = [];
  let disponibles = MAX_FOTOS - estado.existentes.length - nuevos.length;

  for (const file of seleccion) {
    const error = validarImagen(file);
    if (error) { rechazados.push(error); continue; }
    if (disponibles <= 0) {
      rechazados.push(`"${file.name}" no cabe: máximo ${MAX_FOTOS} fotos.`);
      continue;
    }
    nuevos.push(file);
    disponibles--;
  }

  return { estado: { existentes: [...estado.existentes], nuevos }, rechazados };
}

/**
 * Quita por el índice que ve el usuario en la grilla (existentes primero).
 * Informa qué archivo salió para que el componente revoque su object URL.
 */
export function quitarDeGaleria(
  estado: EstadoGaleria,
  index: number,
): { estado: EstadoGaleria; archivoQuitado: File | null } {
  if (index < estado.existentes.length) {
    return {
      estado: {
        existentes: estado.existentes.filter((_, i) => i !== index),
        nuevos: [...estado.nuevos],
      },
      archivoQuitado: null,
    };
  }
  const iNuevo = index - estado.existentes.length;
  return {
    estado: {
      existentes: [...estado.existentes],
      nuevos: estado.nuevos.filter((_, i) => i !== iNuevo),
    },
    archivoQuitado: estado.nuevos[iNuevo] ?? null,
  };
}
