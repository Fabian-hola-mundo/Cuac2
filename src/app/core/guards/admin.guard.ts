import { inject } from '@angular/core';
import { CanActivateChildFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Protege las rutas hijas de /admin.
 *
 * La ruta vacía se deja pasar a propósito: el propio AdminShellComponent es
 * quien pinta la pantalla de login cuando no hay sesión, así que bloquearla
 * dejaría al usuario sin ninguna forma de entrar (y crearía un bucle de
 * redirección hacia /admin).
 *
 * El chequeo real es is_admin(), no "hay sesión": estar autenticado ya no
 * alcanza para operar el admin desde la migración 013.
 */
export const adminGuard: CanActivateChildFn = async (route: ActivatedRouteSnapshot) => {
  const sb = inject(SupabaseService);
  const router = inject(Router);

  if (route.routeConfig?.path === '') return true;

  await sb.whenReady();
  return sb.isAdmin() ? true : router.createUrlTree(['/admin']);
};
