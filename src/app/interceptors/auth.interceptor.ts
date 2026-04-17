import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { SupabaseService } from '../services/supabase.service';
import { environment } from '../../enviroments/enviroment';

/**
 * Auth Interceptor — API Gateway
 *
 * Intercepta ÚNICAMENTE las peticiones que van al API Gateway de Railway
 * (`environment.apiGatewayUrl`). Las peticiones a otros dominios las
 * deja pasar sin modificar.
 *
 * Para cada petición al gateway:
 *   1. Obtiene el access_token JWT de la sesión activa de Supabase.
 *   2. Inyecta el header `Authorization: Bearer <token>`.
 *   3. Captura errores 401 y 403 → redirige al login.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const sb     = inject(SupabaseService);
  const router = inject(Router);

  // ── Solo interceptamos peticiones al gateway ──────────────────────────────
  // Las llamadas de Supabase Auth SDK van a supabase.co y no deben tocarse.
  if (!req.url.startsWith(environment.apiGatewayUrl)) {
    return next(req);
  }

  // ── Obtener token y adjuntar a la petición ────────────────────────────────
  return from(sb.client.auth.getSession()).pipe(
    switchMap(({ data }) => {
      const token = data.session?.access_token;

      const authReq = token
        ? req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`,
              'Content-Type': req.headers.has('Content-Type')
                ? req.headers.get('Content-Type')!
                : 'application/json',
            },
          })
        : req;

      return next(authReq);
    }),

    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        console.warn('[AuthInterceptor] 401 Unauthorized — redirigiendo al login');
        router.navigate(['/login']);
      }
      if (error.status === 403) {
        console.warn('[AuthInterceptor] 403 Forbidden — acceso denegado');
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
