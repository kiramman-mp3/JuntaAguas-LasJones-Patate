import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

function evaluar(auth: Partial<AuthService>, roles?: string[]) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const resultado = TestBed.runInInjectionContext(() =>
    authGuard({ data: roles ? { roles } : {} } as any, { url: '/admin' } as any)
  );
  return { resultado, navegar };
}

describe('authGuard', () => {
  it('una sesión con contraseña temporal vuelve al login para cambiarla', () => {
    const { resultado, navegar } = evaluar({ isLoggedIn: () => true, debeCambiarPassword: () => true, getUser: () => null });
    expect(resultado).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/admin' } });
  });

  it('un comunero no entra al panel de administración', () => {
    const { resultado, navegar } = evaluar(
      { isLoggedIn: () => true, debeCambiarPassword: () => false, getUser: () => ({ rol: 'USUARIO' }) as any }, ['ADMIN']
    );
    expect(resultado).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/mi-cuenta']);
  });

  it('un administrador con sesión completa entra', () => {
    const { resultado } = evaluar(
      { isLoggedIn: () => true, debeCambiarPassword: () => false, getUser: () => ({ rol: 'ADMIN' }) as any }, ['ADMIN']
    );
    expect(resultado).toBe(true);
  });
});
