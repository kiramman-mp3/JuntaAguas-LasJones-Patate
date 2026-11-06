import { hoyEnEcuador } from './fechas';

/** Iniciales para un monograma: primer nombre y primer apellido ("Luis Alberto Paredes Moreta" → "LP"). */
export function iniciales(nombre: string | null | undefined): string {
  const palabras = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '';
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  const apellido = palabras.length >= 4 ? palabras[2] : palabras[1];
  return (palabras[0][0] + apellido[0]).toUpperCase();
}

/**
 * Valida el dígito verificador (módulo 10) de una cédula ecuatoriana de persona natural.
 * Es la misma regla que aplica el servidor, para avisar al escribir sin esperar la respuesta.
 */
export function esCedulaValida(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const provincia = Number(cedula.slice(0, 2));
  if ((provincia < 1 || provincia > 24) && provincia !== 30) return false;
  if (Number(cedula[2]) >= 6) return false;
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let valor = Number(cedula[i]) * (i % 2 === 0 ? 2 : 1);
    if (valor >= 10) valor -= 9;
    suma += valor;
  }
  const verificador = suma % 10 === 0 ? 0 : 10 - (suma % 10);
  return verificador === Number(cedula[9]);
}

/** Mensaje de error de una cédula a medio escribir o completa; '' si todavía no hay nada que reprochar. */
export function errorCedula(cedula: string): string {
  const texto = cedula.trim();
  if (!texto) return '';
  if (!/^\d+$/.test(texto)) return 'La cédula solo lleva números.';
  if (texto.length > 10) return 'La cédula tiene 10 dígitos.';
  if (texto.length === 10 && !esCedulaValida(texto)) {
    return 'La cédula no es una cédula ecuatoriana válida. Revise los dígitos.';
  }
  return '';
}

export const EDAD_MINIMA = 18;

/** Fecha de nacimiento más reciente permitida hoy (AAAA-MM-DD): la de hace 18 años, como exige el servidor. */
export function fechaMaximaNacimiento(ahora: Date = new Date()): string {
  const [anio, mes, dia] = hoyEnEcuador(ahora).split('-');
  return `${Number(anio) - EDAD_MINIMA}-${mes}-${dia}`;
}

/** Mensaje de error de una fecha de nacimiento; '' si está vacía (es opcional) o es válida. */
export function errorNacimiento(fecha: string, ahora: Date = new Date()): string {
  if (!fecha) return '';
  if (fecha < '1900-01-01') return 'La fecha de nacimiento no es válida.';
  if (fecha > fechaMaximaNacimiento(ahora))
    return `La persona debe tener al menos ${EDAD_MINIMA} años.`;
  return '';
}
