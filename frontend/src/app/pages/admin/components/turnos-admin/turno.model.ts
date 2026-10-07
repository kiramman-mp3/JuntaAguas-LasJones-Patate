export type TipoTurno = 'REGULAR' | 'ADICIONAL';

export interface DiaSemana {
  valor: number;
  label: string;
  corto: string;
}

export const DIAS_SEMANA: DiaSemana[] = [
  { valor: 1, label: 'Lunes', corto: 'Lun' },
  { valor: 2, label: 'Martes', corto: 'Mar' },
  { valor: 3, label: 'Miércoles', corto: 'Mié' },
  { valor: 4, label: 'Jueves', corto: 'Jue' },
  { valor: 5, label: 'Viernes', corto: 'Vie' },
  { valor: 6, label: 'Sábado', corto: 'Sáb' },
  { valor: 7, label: 'Domingo', corto: 'Dom' }
];

/** Turno de riego listo para mostrarse (nombres de comunero, lote, sector y día resueltos). */
export interface Turno {
  id: number;
  persona_id: number;
  lote_id: number;
  dia_semana: number;
  dia: string;
  usuario: string;
  lote: string;
  sector: string;
  horaInicio: string;
  horaFin: string;
  tipo: TipoTurno;
  observacion?: string;
}

export interface FiltrosTurno {
  busqueda: string;
  dia: string;
  tipo: string;
}

export function nombreDia(valor: number): string {
  return DIAS_SEMANA.find((d) => d.valor === Number(valor))?.label ?? String(valor);
}

export function filtrarTurnos(turnos: Turno[], f: FiltrosTurno): Turno[] {
  const q = f.busqueda.trim().toLowerCase();
  return turnos.filter(
    (t) =>
      (!q || t.usuario.toLowerCase().includes(q) || t.lote.toLowerCase().includes(q) || t.sector.toLowerCase().includes(q)) &&
      (!f.dia || t.dia === f.dia) &&
      (!f.tipo || t.tipo === f.tipo)
  );
}
