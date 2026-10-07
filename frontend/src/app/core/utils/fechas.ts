/**
 * Fechas de la Junta (Ecuador continental, UTC-5).
 *
 * El backend envía dos clases de valores:
 * - Fechas de calendario 'AAAA-MM-DD' (fecha de un evento, de emisión, de vencimiento).
 *   `new Date('2026-10-05')` las interpreta como medianoche UTC, que en Ecuador es
 *   el día anterior a las 19:00: por eso se muestran sin convertir de zona.
 * - Instantes ISO con hora y zona ('2026-10-05T14:30:00.000Z'), como la fecha de un pago:
 *   se muestran en la hora de Ecuador.
 */
export const ZONA_JUNTA = 'America/Guayaquil';

const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export type FormatoFecha = 'corta' | 'larga' | 'mesAnio' | 'conHora';

const OPCIONES: Record<FormatoFecha, Intl.DateTimeFormatOptions> = {
  corta: { day: '2-digit', month: '2-digit', year: 'numeric' },
  larga: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  mesAnio: { month: 'long', year: 'numeric' },
  conHora: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }
};

/** Indica si el valor es una fecha de calendario sin hora ('AAAA-MM-DD'). */
export function esSoloFecha(valor: unknown): valor is string {
  return typeof valor === 'string' && SOLO_FECHA.test(valor);
}

/**
 * Convierte el valor en un Date. Una fecha 'AAAA-MM-DD' se toma como ese día en la
 * zona local del navegador (no en UTC), para que getDate() y compañía devuelvan ese día.
 */
export function aFecha(valor: string | Date | null | undefined): Date | null {
  if (valor == null || valor === '') return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  const m = SOLO_FECHA.exec(valor);
  const fecha = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Formatea una fecha de calendario o un instante para mostrarlo en la interfaz. */
export function formatearFecha(valor: string | Date | null | undefined, formato: FormatoFecha = 'corta'): string {
  if (valor == null || valor === '') return '';
  if (esSoloFecha(valor)) {
    const [anio, mes, dia] = valor.split('-').map(Number);
    // Se formatea en UTC el mismo día de calendario, sin desplazamiento de zona. No tiene hora que mostrar.
    const opciones = formato === 'conHora' ? OPCIONES.corta : OPCIONES[formato];
    return new Intl.DateTimeFormat('es-EC', { ...opciones, timeZone: 'UTC' }).format(new Date(Date.UTC(anio, mes - 1, dia)));
  }
  const fecha = aFecha(valor);
  if (!fecha) return typeof valor === 'string' ? valor : '';
  return new Intl.DateTimeFormat('es-EC', { ...OPCIONES[formato], timeZone: ZONA_JUNTA }).format(fecha);
}

/** Fecha de hoy en Ecuador como 'AAAA-MM-DD' (para inputs type="date" y comparaciones). */
export function hoyEnEcuador(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_JUNTA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** Suma días a una fecha 'AAAA-MM-DD' sin pasar por la zona horaria. */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Convierte un Date en 'AAAA-MM-DD' según su día local (sin pasar por UTC como toISOString). */
export function aFechaIso(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}
