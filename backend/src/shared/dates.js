// La Junta opera en Ecuador continental (UTC-5, sin horario de verano).
const ZONA = 'America/Guayaquil';

const formatoFecha = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatoHora = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** Fecha local de la Junta en formato YYYY-MM-DD. */
function hoy(ahora = new Date()) {
  return formatoFecha.format(ahora);
}

/** Hora local de la Junta en formato HH:MM:SS. */
function horaActual(ahora = new Date()) {
  return formatoHora.format(ahora);
}

/** Normaliza 'H:MM', 'HH:MM' o 'HH:MM:SS' a 'HH:MM:SS'. Devuelve null si no es una hora válida. */
function normalizarHora(valor) {
  if (typeof valor !== 'string') return null;
  const m = valor.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [h, min, s] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  if (h > 23 || min > 59 || s > 59) return null;
  return [h, min, s].map((n) => String(n).padStart(2, '0')).join(':');
}

// Un día de calendario no tiene hora: se formatea en UTC para que ninguna zona horaria lo mueva al día anterior.
const formatoFechaLarga = new Intl.DateTimeFormat('es-EC', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** 'YYYY-MM-DD' en texto largo: '2026-10-10' → 'sábado, 10 de octubre de 2026'. */
function fechaLarga(fecha) {
  const [a, m, d] = String(fecha).split('-').map(Number);
  return formatoFechaLarga.format(new Date(Date.UTC(a, m - 1, d)));
}

/** Valida una fecha YYYY-MM-DD real (rechaza 2026-02-30). */
function esFechaValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

/** Indica si la fecha y hora local dadas ya llegaron en la zona de la Junta. */
function yaOcurrio(fecha, hora = '00:00:00', ahora = new Date()) {
  const actual = `${hoy(ahora)} ${horaActual(ahora)}`;
  return `${fecha} ${normalizarHora(hora) ?? '00:00:00'}` <= actual;
}

/** Desfase fijo de Ecuador continental respecto de UTC (no tiene horario de verano). */
const DESFASE_HORAS = 5;
/** Para MySQL: CONVERT_TZ(columna_utc, '+00:00', ZONA_MYSQL) da la hora local de la Junta. */
const ZONA_MYSQL = '-05:00';

/**
 * Instante (UTC) en que empieza el día 'YYYY-MM-DD' en Ecuador. Las columnas DATETIME
 * como pagos.fecha_pago se guardan en UTC, así que un filtro por día local debe usar este instante:
 * el 7 de octubre en Ecuador va de 2026-10-07T05:00Z a 2026-10-08T05:00Z.
 */
function inicioDelDiaUtc(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, DESFASE_HORAS));
}

/** Instante (UTC) en que termina el día local, exclusivo: el inicio del día siguiente. */
function finDelDiaUtc(fecha) {
  const inicio = inicioDelDiaUtc(fecha);
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
}

module.exports = { ZONA, ZONA_MYSQL, hoy, horaActual, normalizarHora, esFechaValida, fechaLarga, yaOcurrio, inicioDelDiaUtc, finDelDiaUtc };
