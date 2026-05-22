import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal }       from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { SupabaseService }        from '../../core/services/supabase.service';
import { AdminStateService, ViewId } from '../../core/services/admin-state.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent implements OnInit {
  private router = inject(Router);
  readonly sb     = inject(SupabaseService);
  readonly state  = inject(AdminStateService);

  loginEmail    = 'designcuac@gmail.com';
  loginPass     = '';
  loginError    = signal<string | null>(null);
  loginLoading  = signal(false);

  toast         = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  private routerUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  isInventarioRoute = computed(() => this.routerUrl().includes('/admin/inventario'));

  crumbs = computed(() => {
    const url = this.routerUrl();
    if (url.includes('/inventario/ventas'))            return ['Evento', 'Inventario', 'Log de ventas'];
    if (url.includes('/inventario/nuevo'))             return ['Evento', 'Inventario', 'Nuevo producto'];
    if (url.match(/\/inventario\/.+\/editar/))         return ['Evento', 'Inventario', 'Editar producto'];
    if (url.includes('/inventario'))                   return ['Evento', 'Inventario'];

    const map: Record<ViewId, string[]> = {
      dashboard: ['Resumen'],
      productos: ['Catálogo', 'Productos'],
      pedidos:   ['Operación', 'Pedidos'],
      clientes:  ['Comunidad', 'Clientes'],
      pagos:     ['Caja', 'Pagos'],
      contenido: ['Universo', 'Personajes y contenido'],
      ajustes:   ['Sistema', 'Ajustes'],
    };
    return map[this.state.view()] ?? ['—'];
  });

  readonly NAV_TIENDA   = ['dashboard','productos','pedidos','clientes','pagos'] as ViewId[];
  readonly NAV_UNIVERSO = ['contenido','ajustes'] as ViewId[];
  readonly NAV_META: Record<string, { label: string; count?: number }> = {
    dashboard: { label: 'Dashboard' },
    productos: { label: 'Productos', count: 42 },
    pedidos:   { label: 'Pedidos',   count: 12 },
    clientes:  { label: 'Clientes'  },
    pagos:     { label: 'Pagos'     },
    contenido: { label: 'Contenido' },
    ajustes:   { label: 'Ajustes'   },
  };

  ngOnInit() {
    this.sb.db.auth.onAuthStateChange(() => {});
    // DEV BYPASS: auto-login para que RLS tenga sesión válida mientras el auth gate está desactivado
    this.sb.signInWithPassword('designcuac@gmail.com', 'Cuac123');
  }

  goHome(id: ViewId) {
    this.state.view.set(id);
    if (this.isInventarioRoute()) this.router.navigate(['/admin']);
  }

  goInventario() { this.router.navigate(['/admin/inventario']); }

  async loginGoogle() {
    this.loginLoading.set(true);
    this.loginError.set(null);
    const { error } = await this.sb.signInWithGoogle();
    this.loginLoading.set(false);
    if (error) {
      this.loginError.set('Google no está habilitado aún. Usa contraseña por ahora.');
    }
  }

  async loginPassword() {
    this.loginLoading.set(true);
    this.loginError.set(null);
    const { error } = await this.sb.signInWithPassword(this.loginEmail, this.loginPass);
    this.loginLoading.set(false);
    if (error) this.loginError.set('Credenciales incorrectas. Intenta de nuevo.');
  }

  async logout() { await this.sb.signOut(); }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }

  get userEmail(): string  { return this.sb.session()?.user?.email ?? ''; }
  get userInitial(): string { return (this.sb.session()?.user?.email?.[0] ?? 'C').toUpperCase(); }
}
