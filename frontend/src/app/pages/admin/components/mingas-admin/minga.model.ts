export interface Minga {
  id: number;
  tipo: 'MINGA';
  titulo: string;
  descripcion: string;
  fecha: string;
  hora_inicio: string;
  lugar: string;
  estado: string;
  genera_multa_ausencia: boolean;
  valor_multa: number;
  asistentes: number;
  totalComuneros: number;
  lista_asistencia_firmada_url?: string;
}

export type EstadoAsistenciaMinga = 'PENDIENTE' | 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO';

export interface AsistenciaMinga {
  persona_id: number;
  nombre: string;
  cedula: string;
  estado: EstadoAsistenciaMinga;
  motivo_justificacion: string;
}
