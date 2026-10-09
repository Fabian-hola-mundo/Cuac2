// Lo que Bold se queda de cada venta web, para poder ver la ganancia real al
// poner el precio en vez de descubrirla al conciliar.
//
// El porcentaje es editable desde el propio formulario (se guarda en el
// navegador) porque las tarifas de la pasarela cambian y no dependen de
// nosotros. El valor por defecto es la tarifa de tarjetas del botón de pagos.

/** Tarifa base por defecto, en porcentaje sobre el precio. */
export const COMISION_BOLD_POR_DEFECTO = 2.99;

/** IVA colombiano, que se cobra sobre la comisión (no sobre el precio). */
export const IVA = 0.19;

export const CLAVE_COMISION = 'cuac.admin.comision-bold';

export interface DesgloseBold {
  /** Lo que se queda la pasarela, IVA incluido si aplica. */
  comision: number;
  /** Lo que entra a la cuenta. */
  ganancia: number;
}

/**
 * `precio` es lo que paga el cliente. La comisión sale de ahí, así que la
 * ganancia real es siempre menor al precio de lista.
 */
export function comisionBold(
  precio: number | null | undefined,
  porcentaje = COMISION_BOLD_POR_DEFECTO,
  conIva = true,
): DesgloseBold {
  if (!precio || precio <= 0 || !Number.isFinite(porcentaje) || porcentaje < 0) {
    return { comision: 0, ganancia: Math.max(0, precio ?? 0) };
  }
  const base     = precio * (porcentaje / 100);
  const comision = Math.round(conIva ? base * (1 + IVA) : base);
  return { comision, ganancia: precio - comision };
}

/** Porcentaje guardado por el usuario, o el de por defecto. */
export function leerComisionGuardada(): { porcentaje: number; conIva: boolean } {
  const porDefecto = { porcentaje: COMISION_BOLD_POR_DEFECTO, conIva: true };
  if (typeof localStorage === 'undefined') return porDefecto;
  try {
    const crudo = localStorage.getItem(CLAVE_COMISION);
    if (!crudo) return porDefecto;
    const v = JSON.parse(crudo);
    return {
      porcentaje: Number.isFinite(v?.porcentaje) && v.porcentaje >= 0 ? v.porcentaje : COMISION_BOLD_POR_DEFECTO,
      conIva: v?.conIva !== false,
    };
  } catch {
    return porDefecto;
  }
}

export function guardarComision(porcentaje: number, conIva: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CLAVE_COMISION, JSON.stringify({ porcentaje, conIva }));
  } catch {
    // Sin almacenamiento el cálculo sigue funcionando con el valor de la sesión.
  }
}
