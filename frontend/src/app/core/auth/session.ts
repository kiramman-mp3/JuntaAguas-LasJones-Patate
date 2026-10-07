/**
 * Almacenamiento de la sesión (token y usuario).
 * Lo comparten AuthService y el interceptor, que no puede inyectar AuthService
 * sin crear una dependencia circular (AuthService -> HttpClient -> interceptor).
 */
export const ROLES = { ADMIN: 'ADMIN', USUARIO: 'USUARIO' } as const;
export type Rol = (typeof ROLES)[keyof typeof ROLES];

const TOKEN_KEY = 'junta_token';
const USER_KEY = 'junta_user';

/* El almacenamiento puede no existir (SSR, pruebas) o estar bloqueado por el navegador. */
function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* almacenamiento no disponible */
  }
}

function borrar(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    /* almacenamiento no disponible */
  }
}

export const session = {
  token: (): string | null => leer(TOKEN_KEY),
  usuario: <T = any>(): T | null => {
    const datos = leer(USER_KEY);
    if (!datos) return null;
    try {
      return JSON.parse(datos) as T;
    } catch {
      return null;
    }
  },
  guardar(token: string, usuario: unknown): void {
    escribir(TOKEN_KEY, token);
    escribir(USER_KEY, JSON.stringify(usuario));
  },
  guardarUsuario(usuario: unknown): void {
    escribir(USER_KEY, JSON.stringify(usuario));
  },
  limpiar(): void {
    borrar(TOKEN_KEY);
    borrar(USER_KEY);
  }
};
