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
  { valor: 7, label: 'Domingo', corto: 'Dom' },
];

/** Turno de riego listo para mostrarse (nombres de usuario, lote, sector y día resueltos). */
export interface Turno {
  id: number;
  persona_id: number;
  lote_id: number;
  sector_id?: number;
  dia_semana: number;
  dia: string;
  usuario: string;
  cedula?: string;
  lote: string;
  sector: string;
  superficie_m2?: number;
  horaInicio: string;
  horaFin: string;
  observacion?: string;
}

/** Cantidad de colores con los que se distinguen los sectores (clases `sector-0` … `sector-4` en _turnos.scss). */
export const COLORES_SECTOR = 5;

/**
 * Color de un sector según su nombre: el mismo sector se ve igual en el calendario y en los filtros,
 * sin guardar nada en la base. Con los tres sectores actuales ninguno repite color.
 */
export function indiceSector(nombre: string): number {
  let hash = 0;
  for (const letra of nombre) hash = (hash * 31 + letra.charCodeAt(0)) >>> 0;
  return hash % COLORES_SECTOR;
}

/** Día de la semana (1 = lunes … 7 = domingo) de una fecha 'AAAA-MM-DD', sin pasar por la zona horaria. */
export function diaSemanaDe(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const js = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return js === 0 ? 7 : js;
}

export interface FiltrosTurno {
  busqueda: string;
  dia: string;
  sector?: string;
}

export function nombreDia(valor: number): string {
  return DIAS_SEMANA.find((d) => d.valor === Number(valor))?.label ?? String(valor);
}

export function filtrarTurnos(turnos: Turno[], f: FiltrosTurno): Turno[] {
  const q = f.busqueda.trim().toLowerCase();
  return turnos.filter(
    (t) =>
      (!q ||
        t.usuario.toLowerCase().includes(q) ||
        t.lote.toLowerCase().includes(q) ||
        t.sector.toLowerCase().includes(q)) &&
      (!f.dia || t.dia === f.dia) &&
      (!f.sector || t.sector === f.sector),
  );
}
