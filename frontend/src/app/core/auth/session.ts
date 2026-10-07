/**
 * Almacenamiento de la sesión (token y usuario).
 * Lo comparten AuthService y el interceptor, que no puede inyectar AuthService
 * sin crear una dependencia circular (AuthService -> HttpClient -> interceptor).
 */
export const ROLES = { ADMIN: 'ADMIN', USUARIO: 'USUARIO' } as const;
export type Rol = (typeof ROLES)[keyof typeof ROLES];

const TOKEN_KEY = 'junta_token';
const USER_KEY = 'junta_user';

type Almacen = 'local' | 'sesion';

/* El almacenamiento puede no existir (SSR, pruebas) o estar bloqueado por el navegador. */
function almacen(tipo: Almacen): Storage | null {
  try {
    return tipo === 'local' ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

function leer(tipo: Almacen, clave: string): string | null {
  try {
    return almacen(tipo)?.getItem(clave) ?? null;
  } catch {
    return null;
  }
}

function escribir(tipo: Almacen, clave: string, valor: string): void {
  try {
    almacen(tipo)?.setItem(clave, valor);
  } catch {
    /* almacenamiento no disponible */
  }
}

function borrar(tipo: Almacen, clave: string): void {
  try {
    almacen(tipo)?.removeItem(clave);
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Dónde está la sesión actual: la de pestaña tiene prioridad sobre la recordada. */
function almacenActual(): Almacen | null {
  if (leer('sesion', TOKEN_KEY)) return 'sesion';
  if (leer('local', TOKEN_KEY)) return 'local';
  return null;
}

/** Fecha de expiración (en ms) del JWT, o null si no se puede leer. No valida la firma: eso lo hace el servidor. */
export function expiracionToken(token: string): number | null {
  try {
    const carga = token.split('.')[1];
    if (!carga) return null;
    const json = JSON.parse(atob(carga.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Sesión del usuario. Con "Recordar mi sesión" el token se guarda en localStorage y
 * sobrevive al cierre del navegador; sin esa opción va a sessionStorage y se pierde al cerrarlo.
 * Un token vencido se descarta al leerlo, para no mostrar pantallas que el servidor rechazará.
 */
export const session = {
  token(): string | null {
    const tipo = almacenActual();
    if (!tipo) return null;
    const token = leer(tipo, TOKEN_KEY);
    const expira = token ? expiracionToken(token) : null;
    if (token && expira !== null && expira <= Date.now()) {
      session.limpiar();
      return null;
    }
    return token;
  },
  usuario: <T = any>(): T | null => {
    const tipo = almacenActual();
    const datos = tipo ? leer(tipo, USER_KEY) : null;
    if (!datos) return null;
    try {
      return JSON.parse(datos) as T;
    } catch {
      return null;
    }
  },
  /** Indica si la sesión actual se guardó para recordarse. */
  recordada: (): boolean => almacenActual() === 'local',
  /**
   * Guarda el token y el usuario. Si no se indica `recordar`, conserva el almacén de la
   * sesión actual (por ejemplo, al renovar el token tras cambiar la contraseña).
   */
  guardar(token: string, usuario: unknown, recordar?: boolean): void {
    const destino: Almacen = recordar === undefined ? (almacenActual() ?? 'local') : recordar ? 'local' : 'sesion';
    session.limpiar();
    escribir(destino, TOKEN_KEY, token);
    escribir(destino, USER_KEY, JSON.stringify(usuario));
  },
  guardarUsuario(usuario: unknown): void {
    escribir(almacenActual() ?? 'local', USER_KEY, JSON.stringify(usuario));
  },
  limpiar(): void {
    for (const tipo of ['local', 'sesion'] as const) {
      borrar(tipo, TOKEN_KEY);
      borrar(tipo, USER_KEY);
    }
  }
};
