/** Un turno que cruza la medianoche (fin menor al inicio) dura como máximo esto; lo mismo exige el backend. */
const MAX_MINUTOS_NOCTURNO = 12 * 60;

const aMinutos = (hora: string): number => {
  const [h, m] = hora.split(':');
  return Number(h) * 60 + Number(m);
};

/** Mensaje de error si el horario del turno no es válido; null si lo es. */
export function errorHorarioTurno(horaInicio: string, horaFin: string): string | null {
  const inicio = aMinutos(horaInicio);
  const fin = aMinutos(horaFin);
  if (inicio === fin) return 'La hora de fin no puede ser igual a la de inicio.';
  if (fin < inicio && fin + 1440 - inicio > MAX_MINUTOS_NOCTURNO)
    return 'Un turno que cruza la medianoche puede durar como máximo 12 horas. Revise las horas.';
  return null;
}
