import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    // Redirigir al login preservando la URL de retorno
    return router.parseUrl(`/login?returnUrl=${state.url}`);
  }

  // Verificar si la ruta requiere roles específicos
  const requiredRoles = route.data['roles'] as Array<string>;
  if (requiredRoles && requiredRoles.length > 0) {
    const user = authService.getUser();
    if (!user || !requiredRoles.includes(user.rol)) {
      // Usuario autenticado pero sin rol suficiente
      return router.parseUrl('/mi-cuenta');
    }
  }

  return true;
};
