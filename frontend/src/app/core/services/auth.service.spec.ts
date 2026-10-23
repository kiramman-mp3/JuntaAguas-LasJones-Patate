import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { session } from '../auth/session';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    session.limpiar();
  });

  it('al cerrar sesión borra el token local y avisa al servidor con ese mismo token', () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    session.guardar('token-de-prueba', { rol: 'USUARIO' }, false);

    auth.logout();
    expect(auth.getToken()).toBeNull();
    const peticion = http.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer token-de-prueba');
    peticion.flush({ status: 'OK' });
    http.verify();
  });

  it('sin sesión no llama al servidor', () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    auth.logout();
    http.expectNone(`${environment.apiUrl}/auth/logout`);
    http.verify();
  });
});
