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

module.exports = { ZONA, hoy, horaActual, normalizarHora, esFechaValida, yaOcurrio };
