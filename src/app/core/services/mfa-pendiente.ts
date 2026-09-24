/** La parte de auth.mfa que necesitamos; así se puede probar con un doble. */
export interface MfaConsultable {
  getAuthenticatorAssuranceLevel(): Promise<{
    data: { currentLevel: string | null; nextLevel: string | null } | null;
  }>;
  listFactors(): Promise<{ data: { totp: Array<{ status: string }> } | null }>;
}

/**
 * ¿Hay sesión con un segundo factor verificado que todavía no se ha metido?
 *
 * Ojo con de dónde sale cada dato. currentLevel se decodifica del access token,
 * así que es fiable. nextLevel NO: sin pasarle un JWT, la librería lo calcula
 * leyendo session.user.factors de la sesión guardada en localStorage, y en la
 * sesión que crea el redirect de OAuth ahí no vienen los factores. Fiarse de
 * nextLevel dejaba esto en false justo al volver de Google, que es cuando hace
 * falta que sea true. Por eso el factor se pregunta con listFactors(), que va a
 * /user por HTTP — la misma fuente que usa el shell para pintar el paso del
 * código.
 */
export async function hayFactorPendiente(mfa: MfaConsultable): Promise<boolean> {
  const { data: aal } = await mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') return false;

  const { data: factors } = await mfa.listFactors();
  return (factors?.totp ?? []).some(f => f.status === 'verified');
}
