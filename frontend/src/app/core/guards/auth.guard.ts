import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Roles que exige una ruta: los de su propio `data` y los de cada ruta padre. En `canActivateChild`
 * la ruta evaluada es la hija, cuyo `data` no hereda el del padre cuando ella tiene su propio componente.
 */
function rolesRequeridos(route: ActivatedRouteSnapshot): string[][] {
  const niveles: string[][] = [];
  for (let actual: ActivatedRouteSnapshot | null = route; actual; actual = actual.parent) {
    const roles = actual.data?.['roles'] as string[] | undefined;
    if (roles && roles.length > 0) niveles.push(roles);
  }
  return niveles;
}

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    // Redirigir al login preservando la URL de retorno y retornar false explícitamente
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Con una contraseña temporal el servidor solo acepta el cambio de contraseña.
  if (authService.debeCambiarPassword()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Verificar si la ruta, o alguna de sus rutas padre, requiere roles específicos
  const niveles = rolesRequeridos(route);
  if (niveles.length > 0) {
    const user = authService.getUser();
    if (!user || !niveles.every((roles) => roles.includes(user.rol))) {
      // Usuario autenticado pero sin rol suficiente, redirigir y retornar false
      router.navigate(['/mi-cuenta']);
      return false;
    }
  }

  return true;
};
