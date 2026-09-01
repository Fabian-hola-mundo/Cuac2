import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseKey
  );

  readonly session = signal<Session | null>(null);

  /** Si el usuario de la sesión actual está en admin_users. */
  readonly isAdmin = signal(false);

  // getSession() es asíncrono: al recargar la página el guard corre antes de que
  // la sesión se restaure desde storage. Sin esperar esto, un F5 en /admin/pedidos
  // se lee como "no hay sesión" y rebota al login.
  private readonly ready: Promise<void>;

  constructor() {
    this.ready = this.client.auth.getSession().then(async ({ data }) => {
      this.session.set(data.session);
      await this.refreshIsAdmin();
    });

    this.client.auth.onAuthStateChange((_, session) => {
      this.session.set(session);
      void this.refreshIsAdmin();
    });
  }

  /** Resuelve cuando la sesión inicial ya se restauró. */
  whenReady(): Promise<void> { return this.ready; }

  get db(): SupabaseClient { return this.client; }

  private async refreshIsAdmin(): Promise<void> {
    if (!this.session()) { this.isAdmin.set(false); return; }
    const { data, error } = await this.client.rpc('is_admin');
    this.isAdmin.set(!error && data === true);
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
}
