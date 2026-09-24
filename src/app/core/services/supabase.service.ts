import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { hayFactorPendiente } from './mfa-pendiente';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseKey
  );

  readonly session = signal<Session | null>(null);

  /** Si el usuario de la sesión actual está en admin_users. */
  readonly isAdmin = signal(false);

  /**
   * Hay sesión, hay un factor TOTP verificado y todavía no se ha metido el
   * código: la sesión está en aal1 pero puede subir a aal2. is_admin() es
   * false en ese hueco, así que el guard necesita distinguirlo de "este
   * usuario no es admin" para dejar pintar la pantalla del segundo factor.
   */
  readonly mfaPendiente = signal(false);

  // getSession() es asíncrono: al recargar la página el guard corre antes de que
  // la sesión se restaure desde storage. Sin esperar esto, un F5 en /admin/pedidos
  // se lee como "no hay sesión" y rebota al login.
  private readonly ready: Promise<void>;

  constructor() {
    this.ready = this.client.auth.getSession().then(async ({ data }) => {
      this.session.set(data.session);
      await this.refreshEstadoAdmin();
    });

    this.client.auth.onAuthStateChange((_, session) => {
      this.session.set(session);
      void this.refreshEstadoAdmin();
    });
  }

  /** Resuelve cuando la sesión inicial ya se restauró. */
  whenReady(): Promise<void> { return this.ready; }

  get db(): SupabaseClient { return this.client; }

  /** Recalcula isAdmin y mfaPendiente. Los dos se leen desde el guard. */
  private async refreshEstadoAdmin(): Promise<void> {
    if (!this.session()) {
      this.isAdmin.set(false);
      this.mfaPendiente.set(false);
      return;
    }

    // Nada de aquí puede lanzar: esta promesa es la que espera el guard en
    // whenReady(), y si se rejecta /admin queda inaccesible para siempre en vez
    // de limitarse a pedir el login otra vez.
    try {
      const { data, error } = await this.client.rpc('is_admin');
      this.isAdmin.set(!error && data === true);
    } catch {
      this.isAdmin.set(false);
    }

    try {
      this.mfaPendiente.set(await hayFactorPendiente(this.client.auth.mfa));
    } catch {
      this.mfaPendiente.set(false);
    }
  }

  signInWithGoogle() {
    return this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    });
  }

  signInWithPassword(email: string, password: string) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  signOut() {
    return this.client.auth.signOut();
  }

  // ── Verificación en dos pasos (MFA / TOTP) ──────────────────────────────────

  /** Nivel de aseguramiento actual y el requerido (aal1 → aal2 si hay factor). */
  mfaAAL() {
    return this.client.auth.mfa.getAuthenticatorAssuranceLevel();
  }

  /** Factores MFA del usuario (incluye verificados y sin verificar). */
  mfaListFactors() {
    return this.client.auth.mfa.listFactors();
  }

  /**
   * Empieza el enrolamiento de un factor TOTP. Antes limpia cualquier factor
   * sin verificar que haya quedado de un intento anterior (Supabase rechaza
   * enrolar con un nombre repetido). Devuelve el QR, el secreto y el factorId.
   */
  async mfaEnrollTotp() {
    const { data: list } = await this.client.auth.mfa.listFactors();
    const pendientes = (list?.all ?? []).filter(f => f.factor_type === 'totp' && f.status !== 'verified');
    for (const f of pendientes) {
      await this.client.auth.mfa.unenroll({ factorId: f.id });
    }
    return this.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Autenticador' });
  }

  /** Verifica el código de 6 dígitos para confirmar el enrolamiento o el login. */
  async mfaVerify(factorId: string, code: string) {
    const challenge = await this.client.auth.mfa.challenge({ factorId });
    if (challenge.error) return { data: null, error: challenge.error };
    const res = await this.client.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    // Al verificar, la sesión sube a aal2: reevaluamos si es admin.
    if (!res.error) await this.refreshEstadoAdmin();
    return res;
  }

  /** Quita un factor MFA (para reconfigurar). */
  mfaUnenroll(factorId: string) {
    return this.client.auth.mfa.unenroll({ factorId });
  }
}
