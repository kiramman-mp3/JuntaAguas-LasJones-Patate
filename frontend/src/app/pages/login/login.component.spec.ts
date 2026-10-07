import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { LoginComponent } from './login.component';
import { problemaConPassword } from '../../core/auth/password-policy';

const usuario = (debeCambiarPassword: boolean, rol: 'ADMIN' | 'USUARIO' = 'USUARIO') => ({
  cuentaId: 1, personaId: 1, cedula: '1803456789', nombres: 'Rosa', apellidos: 'Caiza', email: '', rol, rolNombre: '', debeCambiarPassword
});

function crear(auth: Record<string, any>) {
  const router = { navigate: vi.fn(), navigateByUrl: vi.fn() };
  const route = { snapshot: { queryParamMap: { get: () => null } } };
  const component = new LoginComponent(
    { isLoggedIn: () => false, debeCambiarPassword: () => false, getUser: () => null, ...auth } as any,
    router as any, route as any, { detectChanges: vi.fn() } as any
  );
  return { component, router };
}

describe('Login con contraseña temporal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('pide el cambio y usa la contraseña ingresada como actual', () => {
    const { component, router } = crear({ login: () => of({ status: 'OK', token: 't', user: usuario(true) }) });
    component.usuario = '1803456789';
    component.password = 'Temporal7x';
    component.iniciarSesion();
    expect(component.requiereCambioPassword).toBe(true);
    expect(component.passwordActual).toBe('Temporal7x');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('aplica la política del servidor antes de enviar', () => {
    const changePassword = vi.fn();
    const { component } = crear({ changePassword, getUser: () => usuario(true) });
    component.requiereCambioPassword = true;
    component.passwordActual = 'Temporal7x';
    component.nuevaPassword1 = component.nuevaPassword2 = 'abcdef';
    component.cambiarPassword();
    expect(component.errorMensaje).toContain('8 caracteres');
    component.nuevaPassword1 = component.nuevaPassword2 = 'x1803456789';
    component.cambiarPassword();
    expect(component.errorMensaje).toContain('cédula');
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('tras el cambio entra con el rol devuelto por el servidor', () => {
    const changePassword = vi.fn(() => of({ status: 'OK', token: 'nuevo', user: usuario(false, 'ADMIN') }));
    const { component, router } = crear({ changePassword, getUser: () => usuario(true) });
    component.requiereCambioPassword = true;
    component.passwordActual = 'Temporal7x';
    component.nuevaPassword1 = component.nuevaPassword2 = 'Riego2026';
    component.cambiarPassword();
    expect(changePassword).toHaveBeenCalledWith('Temporal7x', 'Riego2026');
    vi.runAllTimers();
    expect(router.navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('muestra el error del servidor si la contraseña temporal es incorrecta', () => {
    const changePassword = vi.fn(() => throwError(() => ({ error: { message: 'La contraseña actual ingresada es incorrecta.' } })));
    const { component } = crear({ changePassword, getUser: () => usuario(true) });
    component.passwordActual = 'Otra1234';
    component.nuevaPassword1 = component.nuevaPassword2 = 'Riego2026';
    component.cambiarPassword();
    expect(component.errorMensaje).toBe('La contraseña actual ingresada es incorrecta.');
  });

  it('distingue una falla de red de una contraseña incorrecta', () => {
    const { component } = crear({ login: () => throwError(() => ({ status: 0, error: null })) });
    component.usuario = '1803456789';
    component.password = 'Riego2026';
    component.iniciarSesion();
    expect(component.errorMensaje).toContain('No hay conexión con el servidor');
    expect(component.cargando).toBe(false);
  });

  it('pasa la opción "Recordar mi sesión" al servicio', () => {
    const login = vi.fn(() => of({ status: 'OK', token: 't', user: usuario(false) }));
    const { component } = crear({ login });
    component.usuario = '1803456789';
    component.password = 'Riego2026';
    component.recordarSesion = false;
    component.iniciarSesion();
    expect(login).toHaveBeenCalledWith('1803456789', 'Riego2026', false);
  });

  it('al volver al login con una sesión temporal muestra directamente el cambio', () => {
    const { component, router } = crear({ isLoggedIn: () => true, debeCambiarPassword: () => true, getUser: () => usuario(true) });
    component.ngOnInit();
    expect(component.requiereCambioPassword).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('cancelar cierra la sesión temporal', () => {
    const logout = vi.fn();
    const { component } = crear({ logout });
    component.requiereCambioPassword = true;
    component.cancelarCambioPassword();
    expect(logout).toHaveBeenCalled();
    expect(component.requiereCambioPassword).toBe(false);
  });
});

describe('Política de contraseñas', () => {
  it('coincide con la del backend', () => {
    expect(problemaConPassword('Riego2026')).toBeNull();
    expect(problemaConPassword('soloLetras')).toContain('letras y números');
    expect(problemaConPassword('12345678')).toContain('letras y números');
    expect(problemaConPassword('Riego2026', { actual: 'Riego2026' })).toContain('distinta');
  });
});
