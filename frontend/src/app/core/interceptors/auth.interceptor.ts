import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { session } from '../auth/session';

/** Solo las peticiones al backend llevan el token; nunca se envía a terceros. */
const esDelBackend = (url: string) => url.startsWith(environment.apiUrl) || url.startsWith(`${environment.serverUrl}/`);

/**
 * Interceptor global de autenticación.
 *
 * - Agrega `Authorization: Bearer <token>` a toda petición al backend si hay sesión.
 * - Ante un 401 (sesión expirada o token inválido) limpia la sesión y redirige al
 *   login conservando la URL actual como returnUrl. Un 401 del propio login
 *   (credenciales incorrectas) se deja al formulario.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = session.token();

  const peticion = token && esDelBackend(req.url) && !req.headers.has('Authorization')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(peticion).pipe(
    catchError((error) => {
      if (error?.status === 401 && !req.url.endsWith('/auth/login')) {
        session.limpiar();
        const urlActual = router.url;
        if (!urlActual.startsWith('/login')) {
          router.navigate(['/login'], { queryParams: { returnUrl: urlActual } });
        }
      }
      return throwError(() => error);
    })
  );
};
