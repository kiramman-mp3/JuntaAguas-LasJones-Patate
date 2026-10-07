/**
 * Política de contraseñas, la misma que aplica el backend (backend/src/shared/passwords.js).
 * Validarla aquí evita un viaje al servidor y muestra el motivo antes de enviar.
 */
export const REQUISITOS_PASSWORD = 'Mínimo 8 caracteres, con letras y números, sin incluir su cédula.';

/** Devuelve el motivo por el que la contraseña no es válida, o null si cumple la política. */
export function problemaConPassword(clave: string, { cedula, actual }: { cedula?: string; actual?: string } = {}): string | null {
  if (typeof clave !== 'string' || clave.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (clave.length > 72) return 'La contraseña no puede superar 72 caracteres.';
  if (!/[A-Za-z]/.test(clave) || !/\d/.test(clave)) return 'La contraseña debe combinar letras y números.';
  if (cedula && clave.includes(cedula)) return 'La contraseña no puede contener su número de cédula.';
  if (actual && clave === actual) return 'La nueva contraseña debe ser distinta de la actual.';
  return null;
}
