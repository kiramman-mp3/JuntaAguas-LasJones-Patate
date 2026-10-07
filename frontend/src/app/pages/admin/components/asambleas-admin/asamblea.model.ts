export type EstadoAsamblea = 'BORRADOR' | 'PROGRAMADO' | 'CONVOCADO' | 'REALIZADO' | 'CANCELADO';
export type EstadoActa = 'BORRADOR' | 'APROBADA' | 'FIRMADA';
export type EstadoAsistencia = 'PENDIENTE' | 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO';

export interface PuntoAsamblea {
  id?: number;
  evento_id?: number;
  orden: number;
  punto_tratar: string;
  tratado?: string;
  resolucion?: string;
  titulo_acta?: string;
  estado_acta?: EstadoActa;
  acta_firmada_url?: string;
  acta_firmada_nombre?: string;
  responsables?: string;
  fecha_acta?: string;
}

export interface AsambleaItem {
  id: number;
  tipo: 'ASAMBLEA';
  subtipo_asamblea: 'ORDINARIA' | 'EXTRAORDINARIA';
  titulo: string;
  descripcion?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin?: string;
  lugar?: string;
  estado: EstadoAsamblea;
  genera_multa_ausencia: boolean;
  valor_multa: number;
  asistentes: number;
  totalComuneros: number;
  convocatoria_firmada_url?: string;
  convocatoria_firmada_nombre?: string;
  acta_firmada_url?: string;
  acta_firmada_nombre?: string;
  lista_asistencia_url?: string;
  lista_asistencia_firmada_url?: string;
  puntos?: PuntoAsamblea[];
}

export interface AsistentePadron {
  persona_id: number;
  cedula: string;
  nombre: string;
  sector?: string;
  estado: EstadoAsistencia;
  motivo_justificacion: string;
}

export interface ResumenAsistencia {
  total: number;
  presentes: number;
  ausentes: number;
  justificados: number;
  pendientes: number;
}

/** Documento firmado que se muestra en el visor de validación. */
export interface DocumentoFirmado {
  titulo: string;
  url: string;
  nombre: string;
}

const ESTADOS: Record<EstadoAsamblea, { texto: string; icono: string; tono: string }> = {
  BORRADOR: { texto: 'Borrador', icono: 'ri-draft-line', tono: 'neutral' },
  PROGRAMADO: { texto: 'Programada', icono: 'ri-calendar-line', tono: 'info' },
  CONVOCADO: { texto: 'Convocada', icono: 'ri-megaphone-line', tono: 'warning' },
  REALIZADO: { texto: 'Realizada', icono: 'ri-checkbox-circle-line', tono: 'success' },
  CANCELADO: { texto: 'Cancelada', icono: 'ri-close-circle-line', tono: 'danger' }
};

export function estadoTexto(estado: string): string {
  return ESTADOS[estado as EstadoAsamblea]?.texto ?? estado;
}

export function estadoIcono(estado: string): string {
  return ESTADOS[estado as EstadoAsamblea]?.icono ?? 'ri-information-line';
}

/** Clase de la insignia de estado (badge--success, badge--warning…). */
export function estadoBadge(estado: string): string {
  return `badge--${ESTADOS[estado as EstadoAsamblea]?.tono ?? 'info'}`;
}

export function resumirAsistencia(personas: { estado: EstadoAsistencia }[]): ResumenAsistencia {
  const r: ResumenAsistencia = { total: personas.length, presentes: 0, ausentes: 0, justificados: 0, pendientes: 0 };
  for (const p of personas) {
    if (p.estado === 'PRESENTE') r.presentes++;
    else if (p.estado === 'AUSENTE') r.ausentes++;
    else if (p.estado === 'JUSTIFICADO') r.justificados++;
    else r.pendientes++;
  }
  return r;
}
