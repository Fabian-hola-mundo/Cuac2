import { inject } from '@angular/core';
import { CanActivateChildFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Protege las rutas hijas de /admin.
 *
 * La ruta vacía se deja pasar SÓLO cuando no hay sesión: es el propio
 * AdminShellComponent quien pinta la pantalla de login, así que bloquearla
 * dejaría al usuario sin forma de entrar. En cuanto hay sesión, la raíz exige
 * is_admin() igual que las demás — antes cualquier usuario autenticado veía el
 * shell del admin y disparaba llamadas reales de backend.
 *
 * El chequeo real es is_admin(), no "hay sesión": estar autenticado ya no
 * alcanza para operar el admin desde la migración 013.
 */
export const adminGuard: CanActivateChildFn = async (route: ActivatedRouteSnapshot) => {
  const sb = inject(SupabaseService);
  const router = inject(Router);

  await sb.whenReady();

  const esRaiz = route.routeConfig?.path === '';

  // Sin sesión, la raíz muestra el login; con sesión, cae al chequeo de admin.
  if (esRaiz && !sb.session()) return true;

  if (sb.isAdmin()) return true;

  // Un usuario autenticado que no es admin no debe ver nada del panel. Se le
  // manda al inicio (redirigir a /admin haría un bucle en la ruta raíz).
  return router.createUrlTree([esRaiz ? '/' : '/admin']);
};
