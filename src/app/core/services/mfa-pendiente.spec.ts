// getAuthenticatorAssuranceLevel() sin JWT no va a la red: saca nextLevel de
// session.user.factors, o sea de lo que haya quedado guardado en localStorage.
// En la sesión recién creada por OAuth ahí no vienen los factores, así que
// nextLevel se queda en 'aal1' aunque el usuario sí tenga su TOTP verificado.
// Fiarse de nextLevel dejaba mfaPendiente en false y el guard seguía rebotando
// al inicio. El nivel actual sí sale del token (fiable); la existencia del
// factor hay que preguntarla a listFactors(), que va a /user por HTTP.
import { hayFactorPendiente, MfaConsultable } from './mfa-pendiente';

/** Imita a auth.mfa: aal se calcula en local, listFactors va a la red. */
function mfaFalso(opts: {
  currentLevel: string | null;
  nextLevel: string | null;
  factoresEnServidor: Array<{ status: string }>;
}): MfaConsultable & { llamadasAListFactors: number } {
  const fake = {
    llamadasAListFactors: 0,
    async getAuthenticatorAssuranceLevel() {
      return {
        data: { currentLevel: opts.currentLevel, nextLevel: opts.nextLevel },
        error: null,
      };
    },
    async listFactors() {
      fake.llamadasAListFactors++;
      return { data: { totp: opts.factoresEnServidor }, error: null };
    },
  };
  return fake as MfaConsultable & { llamadasAListFactors: number };
}

describe('hayFactorPendiente', () => {
  it('detecta el factor aunque nextLevel venga como aal1 (sesión de OAuth)', async () => {
    // El caso real: volvemos de Google, el token dice aal1 y la sesión
    // guardada no trae factors, pero en el servidor sí hay un TOTP verificado.
    const mfa = mfaFalso({
      currentLevel: 'aal1',
      nextLevel: 'aal1',
      factoresEnServidor: [{ status: 'verified' }],
    });

    expect(await hayFactorPendiente(mfa)).toBe(true);
  });

  it('no hay nada pendiente si la sesión ya está en aal2', async () => {
    const mfa = mfaFalso({
      currentLevel: 'aal2',
      nextLevel: 'aal2',
      factoresEnServidor: [{ status: 'verified' }],
    });

    expect(await hayFactorPendiente(mfa)).toBe(false);
    // Ya estando en aal2 no hace falta gastar una llamada a /user.
    expect(mfa.llamadasAListFactors).toBe(0);
  });

  it('no hay nada pendiente si aún no se ha enrolado ningún factor', async () => {
    const mfa = mfaFalso({
      currentLevel: 'aal1',
      nextLevel: 'aal1',
      factoresEnServidor: [],
    });

    expect(await hayFactorPendiente(mfa)).toBe(false);
  });

  it('un factor a medio enrolar no cuenta como pendiente de verificar', async () => {
    const mfa = mfaFalso({
      currentLevel: 'aal1',
      nextLevel: 'aal1',
      factoresEnServidor: [{ status: 'unverified' }],
    });

    expect(await hayFactorPendiente(mfa)).toBe(false);
  });
});
