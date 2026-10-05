import { Component, computed, signal, inject, effect, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { Router, RouterOutlet, RouterLink, NavigationEnd } from '@angular/router';
import { toSignal }       from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { SupabaseService }        from '../../core/services/supabase.service';
import { AdminStateService, ViewId } from '../../core/services/admin-state.service';
import { MensajesUnreadService } from './mensajes/mensajes-unread.service';
import { ResenasNuevasService }  from './resenas/resenas-nuevas.service';
import { AdminSearchComponent }  from './search/admin-search.component';
import { NotificationsService }            from './notifications/notifications.service';
import { NotificationsDropdownComponent }  from './notifications/notifications-dropdown.component';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, AdminSearchComponent, NotificationsDropdownComponent],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  readonly sb     = inject(SupabaseService);
  readonly state  = inject(AdminStateService);

  loginEmail    = 'designcuac@gmail.com';
  loginPass     = '';
  loginError    = signal<string | null>(null);
  loginLoading  = signal(false);
  showPass      = signal(false);

  // ── Verificación en dos pasos (MFA) ────────────────────────────────────────
  // 'checking' mientras se evalúa; 'enroll' si aún no hay factor; 'verify' si
  // hay factor y falta el código; 'ok' cuando la sesión ya está a aal2.
  mfaMode      = signal<'checking' | 'enroll' | 'verify' | 'ok'>('checking');
  mfaLoading   = signal(false);
  mfaError     = signal<string | null>(null);
  mfaCode      = '';
  qrSrc        = signal<string | null>(null);
  mfaSecret    = signal<string | null>(null);
  private enrollFactorId = signal<string | null>(null);
  private verifyFactorId = signal<string | null>(null);
  private enrolando = false;

  constructor() {
    // Cada vez que cambia la sesión (login, refresh de token al subir a aal2,
    // logout) reevaluamos el estado del segundo factor.
    effect(() => {
      const s = this.sb.session();
      if (!s) { this.mfaMode.set('checking'); this.resetMfa(); return; }
      void this.evaluateMfa();
    });
  }

  searchOpen    = signal(false);
  navOpen       = signal(false);

  notifOpen     = signal(false);
  readonly notifSvc = inject(NotificationsService);

  toast         = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (this.sb.session()) this.searchOpen.update(v => !v);
    }
    if (e.key === 'Escape') {
      this.notifOpen.set(false);
      this.searchOpen.set(false);
      this.navOpen.set(false);
    }
  }

  // El overlay de notificaciones solo cubre la topbar (su backdrop-filter atrapa
  // el `fixed`); la campana y el panel detienen la propagación.
  @HostListener('document:click')
  onDocumentClick() { if (this.notifOpen()) this.notifOpen.set(false); }

  toggleNav() { this.navOpen.update(v => !v); }
  closeNav()  { this.navOpen.set(false); }

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
  isRuletaRoute        = computed(() => this.routerUrl().includes('/admin/ruleta'));
  isMensajesRoute      = computed(() => this.routerUrl().includes('/admin/mensajes'));
  isResenasRoute       = computed(() => this.routerUrl().includes('/admin/resenas'));
  readonly unreadSvc   = inject(MensajesUnreadService);
  readonly resenasNuevas = inject(ResenasNuevasService);

  // Single source of truth for the highlighted sidebar item — avoids the
  // previous per-link chains of "!isXRoute()" exclusions getting out of
  // sync whenever a new admin route was added.
  activeNavId = computed<string>(() => {
    if (this.isMensajesRoute())   return 'mensajes';
    if (this.isResenasRoute())    return 'resenas';
    if (this.isRuletaRoute())     return 'ruleta';
    if (this.isPersonajesRoute()) return 'contenido';
    if (this.isAjustesRoute())    return 'ajustes';
    if (this.isProductosRoute())  return 'productos';
    if (this.isPortafolioRoute()) return 'portafolio';
    if (this.isEventosRoute())    return 'eventos';
    if (this.isCotizacionesRoute()) return 'cotizaciones';
    return this.state.view();
  });

  crumbs = computed(() => {
    const url = this.routerUrl();
    if (url.includes('/personajes/nuevo'))        return ['Universo', 'Personajes', 'Nuevo'];
    if (url.match(/\/personajes\/.+\/editar/))    return ['Universo', 'Personajes', 'Editar'];
    if (url.match(/\/personajes\/[^/]+$/))        return ['Universo', 'Personajes', 'Detalle'];
    if (url.includes('/personajes'))              return ['Universo', 'Personajes'];
    if (url.includes('/mensajes')) return ['Tienda', 'Mensajes'];
    if (url.includes('/resenas'))  return ['Estudio', 'Reseñas'];
    if (url.includes('/ruleta'))   return ['Universo', 'Ruleta'];
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

  adminBreadcrumbs = computed<{label: string; route: string}[]>(() => {
    const url = this.routerUrl();
    if (url.includes('/personajes/nuevo'))       return [{ label: 'Personajes', route: '/admin/personajes' }];
    if (url.match(/\/personajes\/.+\/editar/))    return [{ label: 'Personajes', route: '/admin/personajes' }];
    if (url.match(/\/personajes\/[^/]+$/))        return [{ label: 'Personajes', route: '/admin/personajes' }];
    if (url.includes('/ajustes/'))                return [{ label: 'Ajustes',    route: '/admin/ajustes'    }];
    if (url.includes('/portafolio/logros'))       return [{ label: 'Portafolio', route: '/admin/portafolio' }];
    if (url.includes('/portafolio/perfiles'))     return [{ label: 'Portafolio', route: '/admin/portafolio' }];
    if (url.includes('/portafolio/nuevo'))        return [{ label: 'Portafolio', route: '/admin/portafolio' }];
    if (url.match(/\/portafolio\/.+\/editar/))    return [{ label: 'Portafolio', route: '/admin/portafolio' }];
    if (url.includes('/productos/ventas'))        return [{ label: 'Productos',  route: '/admin/productos'  }];
    if (url.includes('/productos/nuevo'))         return [{ label: 'Productos',  route: '/admin/productos'  }];
    if (url.match(/\/productos\/.+\/editar/))     return [{ label: 'Productos',  route: '/admin/productos'  }];
    if (url.match(/\/eventos\/.+/))               return [{ label: 'Eventos',    route: '/admin/eventos'    }];
    return [];
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
    this.unreadSvc.load();
    this.notifSvc.load();
    this.notifSvc.subscribe();
  }

  ngOnDestroy(): void {
    this.notifSvc.cleanup();
  }

  goHome(id: ViewId) {
    this.closeNav();
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
    if (this.isPortafolioRoute() || this.isCotizacionesRoute() || this.isProductosRoute() || this.isEventosRoute() || this.isAjustesRoute() || this.isPersonajesRoute() || this.isRuletaRoute() || this.isResenasRoute()) {
      this.router.navigate(['/admin']);
    }
  }

  goCotizaciones() { this.closeNav(); this.router.navigate(['/admin/cotizaciones']); }
  goPortafolio() { this.closeNav(); this.router.navigate(['/admin/portafolio']); }
  goProductos() { this.closeNav(); this.router.navigate(['/admin/productos']); }
  goEventos()   { this.closeNav(); this.router.navigate(['/admin/eventos']); }
  goPersonajes() { this.closeNav(); this.router.navigate(['/admin/personajes']); }
  goRuleta()     { this.closeNav(); this.router.navigate(['/admin/ruleta']); }
  goMensajes()   { this.closeNav(); this.router.navigate(['/admin/mensajes']); }
  goResenas()    { this.closeNav(); this.router.navigate(['/admin/resenas']); }

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

  setShowPass(v: boolean) {
    this.showPass.set(v);
  }

  async logout() { this.resetMfa(); await this.sb.signOut(); }

  // ── MFA ─────────────────────────────────────────────────────────────────────
  private resetMfa() {
    this.qrSrc.set(null);
    this.mfaSecret.set(null);
    this.enrollFactorId.set(null);
    this.verifyFactorId.set(null);
    this.mfaCode = '';
    this.mfaError.set(null);
    this.enrolando = false;
  }

  /** Decide qué pantalla de 2FA mostrar (o dejar pasar al shell). */
  private async evaluateMfa() {
    try {
      const { data: aal } = await this.sb.mfaAAL();
      if (aal?.currentLevel === 'aal2') { this.mfaMode.set('ok'); return; }

      const { data: factors } = await this.sb.mfaListFactors();
      const verificado = (factors?.totp ?? []).find(f => f.status === 'verified');

      if (verificado) {
        this.verifyFactorId.set(verificado.id);
        this.mfaMode.set('verify');
      } else {
        this.mfaMode.set('enroll');
        if (!this.qrSrc() && !this.enrolando) await this.startEnroll();
      }
    } catch {
      // El enforcement real vive en is_admin() (RLS); si la evaluación del
      // cliente falla, no bloqueamos el shell, pero sin aal2 la base no
      // devolverá datos igualmente.
      this.mfaMode.set('ok');
    }
  }

  /** Genera un factor TOTP nuevo y su QR. */
  private async startEnroll() {
    this.enrolando = true;
    this.mfaLoading.set(true);
    this.mfaError.set(null);
    const { data, error } = await this.sb.mfaEnrollTotp();
    this.mfaLoading.set(false);
    if (error || !data) {
      this.enrolando = false;
      this.mfaError.set('No se pudo iniciar la configuración. Recarga e intenta de nuevo.');
      return;
    }
    this.enrollFactorId.set(data.id);
    this.mfaSecret.set(data.totp.secret);
    const qr = data.totp.qr_code;
    this.qrSrc.set(
      qr.trim().startsWith('<svg')
        ? 'data:image/svg+xml;utf8,' + encodeURIComponent(qr)
        : qr,
    );
    this.enrolando = false;
  }

  /** Verifica el código, tanto al enrolar como al iniciar sesión. */
  async confirmMfa() {
    const factorId = this.mfaMode() === 'enroll' ? this.enrollFactorId() : this.verifyFactorId();
    if (!factorId) return;
    const code = this.mfaCode.replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) { this.mfaError.set('Ingresa el código de 6 dígitos.'); return; }

    this.mfaLoading.set(true);
    this.mfaError.set(null);
    const { error } = await this.sb.mfaVerify(factorId, code);
    this.mfaLoading.set(false);

    if (error) {
      this.mfaError.set('Código incorrecto o vencido. Prueba con el siguiente que genere tu app.');
      this.mfaCode = '';
      return;
    }
    this.mfaCode = '';
    this.qrSrc.set(null);
    this.mfaSecret.set(null);
    await this.evaluateMfa();
    if (this.mfaMode() === 'ok') this.flash('Verificación en dos pasos activada.');
  }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }

  get userEmail(): string  { return this.sb.session()?.user?.email ?? ''; }
}
