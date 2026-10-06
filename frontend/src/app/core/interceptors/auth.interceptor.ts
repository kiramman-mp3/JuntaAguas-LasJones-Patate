import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

const TOKEN_KEY = 'junta_token';
const USER_KEY = 'junta_user';

/**
 * Interceptor global de autenticación.
 *
 * Se evita inyectar AuthService aquí para no crear dependencias circulares
 * (AuthService -> HttpClient -> interceptor). En su lugar se manipula el
 * almacenamiento directamente.
 *
 * - Ante un 401 (sesión expirada / token inválido) limpia la sesión y
 *   redirige al login preservando la URL actual como returnUrl.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error) => {
      if (error?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);

        const urlActual = router.url;
        if (!urlActual.startsWith('/login')) {
          router.navigate(['/login'], { queryParams: { returnUrl: urlActual } });
        }
      }
      return throwError(() => error);
    })
  );
};
