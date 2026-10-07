import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { session } from '../auth/session';
import { environment } from '../../../environments/environment';

/** Node 26 expone un localStorage global sin almacenamiento que oculta el de jsdom. */
function almacenamientoEnMemoria(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() { return datos.size; },
    clear: () => datos.clear(),
    getItem: (k) => datos.get(k) ?? null,
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (k) => { datos.delete(k); },
    setItem: (k, v) => { datos.set(k, String(v)); }
  };
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.stubGlobal('localStorage', almacenamientoEnMemoria());
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.unstubAllGlobals();
  });

  it('agrega el token a las peticiones del backend', () => {
    session.guardar('token-123', { rol: 'ADMIN' });
    http.get(`${environment.apiUrl}/personas`).subscribe();
    expect(backend.expectOne(`${environment.apiUrl}/personas`).request.headers.get('Authorization')).toBe('Bearer token-123');
  });

  it('no envía el token a servicios de terceros', () => {
    session.guardar('token-123', { rol: 'ADMIN' });
    http.get('https://tile.openstreetmap.org/1/1/1.png').subscribe();
    expect(backend.expectOne('https://tile.openstreetmap.org/1/1/1.png').request.headers.has('Authorization')).toBe(false);
  });

  it('sin sesión la petición sale sin cabecera', () => {
    http.get(`${environment.apiUrl}/eventos/publicos`).subscribe();
    expect(backend.expectOne(`${environment.apiUrl}/eventos/publicos`).request.headers.has('Authorization')).toBe(false);
  });

  it('ante un 401 limpia la sesión y lleva al login', () => {
    session.guardar('vencido', { rol: 'USUARIO' });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http.get(`${environment.apiUrl}/auth/me`).subscribe({ error: () => {} });
    backend.expectOne(`${environment.apiUrl}/auth/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.token()).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/login'], expect.anything());
  });

  it('un 401 del login no cierra la sesión ni redirige', () => {
    session.guardar('previo', { rol: 'USUARIO' });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate');
    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe({ error: () => {} });
    backend.expectOne(`${environment.apiUrl}/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.token()).toBe('previo');
    expect(navegar).not.toHaveBeenCalled();
  });
});
