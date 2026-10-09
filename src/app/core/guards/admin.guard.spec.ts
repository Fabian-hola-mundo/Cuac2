// Al entrar con Google el navegador vuelve a /admin con una sesión recién
// creada en aal1. Con un factor TOTP verificado, is_admin() todavía es false
// (exige aal2), así que el guard rebotaba al inicio y la pantalla del segundo
// factor no llegaba a pintarse nunca: no había forma de terminar de entrar.
// Con contraseña no se notaba porque ahí no hay navegación, sólo cambia la
// sesión y el shell pinta el paso del código sin que el guard vuelva a correr.
import { TestBed } from '@angular/core/testing';
import { runInInjectionContext, Injector, signal } from '@angular/core';
import { provideRouter, Router, ActivatedRouteSnapshot, UrlTree } from '@angular/router';
import { adminGuard } from './admin.guard';
import { SupabaseService } from '../services/supabase.service';

class SupabaseStub {
  session = signal<object | null>(null);
  isAdmin = signal(false);
  mfaPendiente = signal(false);
  whenReady() { return Promise.resolve(); }
}

/** Corre el guard sobre una ruta hija concreta ('' es la raíz del admin). */
async function correrGuard(sb: SupabaseStub, path: string) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: SupabaseService, useValue: sb }],
  });
  const injector = TestBed.inject(Injector);
  const route = { routeConfig: { path } } as ActivatedRouteSnapshot;
  return runInInjectionContext(injector, () => adminGuard(route, null as never));
}

/** El guard devuelve true (pasa) o un UrlTree (rebota) a otra ruta. */
function destinoDelRebote(res: unknown): string | null {
  return res instanceof UrlTree ? TestBed.inject(Router).serializeUrl(res) : null;
}

describe('adminGuard', () => {
  it('deja pintar el segundo factor cuando la sesión aún está en aal1', async () => {
    const sb = new SupabaseStub();
    sb.session.set({});          // volvimos de Google con sesión
    sb.isAdmin.set(false);       // is_admin() exige aal2, todavía no lo somos
    sb.mfaPendiente.set(true);   // hay un factor verificado por confirmar

    const res = await correrGuard(sb, '');

    expect(destinoDelRebote(res)).toBe(null);
    expect(res).toBe(true);
  });

  it('rebota al inicio a un autenticado que no es admin', async () => {
    const sb = new SupabaseStub();
    sb.session.set({});

    const res = await correrGuard(sb, '');

    expect(destinoDelRebote(res)).toBe('/');
  });

  it('no deja entrar a una ruta interna con el segundo factor pendiente', async () => {
    const sb = new SupabaseStub();
    sb.session.set({});
    sb.mfaPendiente.set(true);

    const res = await correrGuard(sb, 'pedidos');

    expect(destinoDelRebote(res)).toBe('/admin');
  });

  it('deja pasar al admin ya verificado', async () => {
    const sb = new SupabaseStub();
    sb.session.set({});
    sb.isAdmin.set(true);

    expect(await correrGuard(sb, 'pedidos')).toBe(true);
  });
});
