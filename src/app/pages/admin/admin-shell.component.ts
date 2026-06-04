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

  isCotizacionesRoute  = computed(() => this.routerUrl().includes('/admin/cotizaciones'));
  isPortafolioRoute    = computed(() => this.routerUrl().includes('/admin/portafolio'));
  isProductosRoute     = computed(() => this.routerUrl().includes('/admin/productos'));
  isEventosRoute       = computed(() => this.routerUrl().includes('/admin/eventos'));
  isAjustesRoute       = computed(() => this.routerUrl().includes('/admin/ajustes'));
  isPersonajesRoute    = computed(() => this.routerUrl().includes('/admin/personajes'));
  isMensajesRoute      = computed(() => this.routerUrl().includes('/admin/mensajes'));
  unreadMensajes       = signal(0);

  crumbs = computed(() => {
    const url = this.routerUrl();
    if (url.includes('/personajes/nuevo'))        return ['Universo', 'Personajes', 'Nuevo'];
    if (url.match(/\/personajes\/.+\/editar/))    return ['Universo', 'Personajes', 'Editar'];
    if (url.match(/\/personajes\/[^/]+$/))        return ['Universo', 'Personajes', 'Detalle'];
    if (url.includes('/personajes'))              return ['Universo', 'Personajes'];
    if (url.includes('/mensajes')) return ['Tienda', 'Mensajes'];
    if (url.includes('/ajustes/negocio'))       return ['Sistema', 'Ajustes', 'Negocio'];
    if (url.includes('/ajustes/impuestos'))     return ['Sistema', 'Ajustes', 'Impuestos'];
    if (url.includes('/ajustes/envios'))        return ['Sistema', 'Ajustes', 'Envíos y tarifas'];
    if (url.includes('/ajustes/correos'))       return ['Sistema', 'Ajustes', 'Plantillas de correo'];
    if (url.includes('/ajustes/equipo'))        return ['Sistema', 'Ajustes', 'Equipo y permisos'];
    if (url.includes('/ajustes/integraciones')) return ['Sistema', 'Ajustes', 'Integraciones'];
    if (url.includes('/ajustes/dominios'))      return ['Sistema', 'Ajustes', 'Dominios'];
    if (url.includes('/ajustes'))              return ['Sistema', 'Ajustes'];
    if (url.includes('/cotizaciones'))                 return ['Diseño', 'Cotizaciones'];
    if (url.includes('/portafolio/logros'))            return ['Estudio', 'Portafolio', 'Reconocimientos'];
    if (url.includes('/portafolio/perfiles'))          return ['Estudio', 'Portafolio', 'Perfiles'];
    if (url.includes('/portafolio/nuevo'))             return ['Estudio', 'Portafolio', 'Nuevo proyecto'];
    if (url.match(/\/portafolio\/.+\/editar/))         return ['Estudio', 'Portafolio', 'Editar proyecto'];
    if (url.includes('/portafolio'))                   return ['Estudio', 'Portafolio'];
    if (url.includes('/productos/ventas'))             return ['Tienda', 'Productos', 'Registro de ventas'];
    if (url.includes('/productos/nuevo'))              return ['Tienda', 'Productos', 'Nuevo producto'];
    if (url.match(/\/productos\/.+\/editar/))          return ['Tienda', 'Productos', 'Editar producto'];
    if (url.includes('/productos'))                    return ['Tienda', 'Productos'];
    if (url.match(/\/eventos\/.+/))                    return ['Evento', 'Eventos', 'Detalle'];
    if (url.includes('/eventos'))                      return ['Evento', 'Eventos'];

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
    productos: { label: 'Productos' },
    pedidos:   { label: 'Pedidos'   },
    clientes:  { label: 'Clientes'  },
    pagos:     { label: 'Pagos'     },
    contenido: { label: 'Contenido' },
    ajustes:   { label: 'Ajustes'   },
  };

  ngOnInit() {
    this.sb.db.auth.onAuthStateChange(() => {});
    this.loadUnreadMensajes();
  }

  private async loadUnreadMensajes() {
    const { count } = await this.sb.db
      .from('mensajes')
      .select('*', { count: 'exact', head: true })
      .eq('leido', false);
    this.unreadMensajes.set(count ?? 0);
  }

  goHome(id: ViewId) {
    if (id === 'productos') {
      this.router.navigate(['/admin/productos']);
      return;
    }
    if (id === 'contenido') {
      this.router.navigate(['/admin/personajes']);
      return;
    }
    if (id === 'ajustes') {
      this.router.navigate(['/admin/ajustes']);
      return;
    }
    this.state.view.set(id);
    if (this.isPortafolioRoute() || this.isCotizacionesRoute() || this.isProductosRoute() || this.isEventosRoute() || this.isAjustesRoute() || this.isPersonajesRoute()) {
      this.router.navigate(['/admin']);
    }
  }

  goCotizaciones() { this.router.navigate(['/admin/cotizaciones']); }
  goPortafolio() { this.router.navigate(['/admin/portafolio']); }
  goProductos() { this.router.navigate(['/admin/productos']); }
  goEventos()   { this.router.navigate(['/admin/eventos']); }
  goPersonajes() { this.router.navigate(['/admin/personajes']); }
  goMensajes()   { this.router.navigate(['/admin/mensajes']); }

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
