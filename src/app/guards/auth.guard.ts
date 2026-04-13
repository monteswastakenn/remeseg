import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';

/**
 * authGuard — Guard que protege rutas verificando:
 *   1. Sesión activa (token válido).
 *   2. Permiso requerido si la ruta lo define en `data.permission`.
 *
 * Uso en app.routes.ts:
 *   { path: 'users', component: Users, canActivate: [authGuard], data: { permission: 'user:view' } }
 */
export const authGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const auth        = inject(AuthService);
  const permissions = inject(PermissionService);
  const router      = inject(Router);

  // ── 1. Esperar hidratación del usuario (máx 3s) ───────────────────────────
  // En recargas de página, hydrateUser() es async y puede no haber terminado
  // cuando el guard se ejecuta. Esperamos a que currentUser se llene.
  let retries = 0;
  while (!auth.currentUser() && retries < 20) {
    await new Promise(r => setTimeout(r, 150));
    retries++;
  }

  // ── 2. Verificar autenticación ────────────────────────────────────────────
  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  // ── 3. Verificar permiso de ruta (si se definió) ──────────────────────────
  const requiredPermission = route.data?.['permission'] as string | undefined;

  if (requiredPermission && !permissions.hasPermission(requiredPermission)) {
    console.warn(
      `[authGuard] Acceso denegado: se requiere "${requiredPermission}" — redirigiendo a /home/dashboard`
    );
    router.navigate(['/home/dashboard']);
    return false;
  }

  return true;
};