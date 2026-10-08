/**
 * Interfaces y contratos de datos optimizados para la API REST
 * Junta de Agua y Riego "La Jones" - Patate
 */

export interface ApiResponse<T = any> {
  status: 'OK' | 'ERROR';
  message?: string;
  data?: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface PersonaItem {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  direccion?: string;
  telefono?: string;
  celular?: string;
  email?: string;
  fecha_nacimiento?: string;
  estado: 'ACTIVO' | 'INACTIVO';
  lotes_count?: number;
}

export interface LoteItem {
  id: number;
  sector_id: number;
  codigo: string;
  superficie_m2: number;
  ancho_m?: number;
  largo_m?: number;
  latitud_aproximada?: number;
  longitud_aproximada?: number;
  radio_error_m?: number;
  referencia_ubicacion?: string;
  observacion?: string;
  activo: boolean;
  sector_nombre: string;
  tipo_relacion?: string;
  porcentaje?: number;
  propietario_id?: number;
  propietario_cedula?: string;
  propietario_nombre?: string;
  propietario?: string;
  propietarios?: string;
}

export interface TurnoItem {
  id: number;
  persona_id: number;
  lote_id: number;
  tipo: 'REGULAR' | 'ADICIONAL';
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  vigencia_desde?: string;
  vigencia_hasta?: string;
  estado: 'ACTIVO' | 'INACTIVO';
  observacion?: string;
  comunero_nombre?: string;
  cedula?: string;
  lote_codigo?: string;
  sector_nombre?: string;
}

export interface EventoItem {
  id: number;
  tipo: 'ASAMBLEA' | 'MINGA';
  titulo: string;
  descripcion?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin?: string;
  lugar?: string;
  estado: 'BORRADOR' | 'PROGRAMADO' | 'CONVOCADO' | 'REALIZADO' | 'CANCELADO';
  requiere_asistencia: boolean;
  genera_multa_ausencia: boolean;
  valor_multa?: number;
  asistentes?: number;
  totalComuneros?: number;
  creado_por_usuario?: string;
}

export interface ObligacionItem {
  id: number;
  persona_id: number;
  concepto_id: number;
  evento_id?: number;
  periodo_anio: number;
  periodo_mes?: number;
  fecha_emision: string;
  fecha_vencimiento?: string;
  valor: number;
  origen: 'MANUAL' | 'AUTOMATICA';
  estado: 'PENDIENTE' | 'PAGADA' | 'ANULADA';
  observacion?: string;
  concepto_codigo?: string;
  concepto_nombre?: string;
  comunero_nombre?: string;
  cedula?: string;
}

/** Respuesta de GET /dashboard/resumen. Las fechas llegan como AAAA-MM-DD. */
export interface DashboardResumen {
  fecha: string;
  comunidad: {
    comunerosActivos: number;
    lotes: number;
    sectores: number;
    turnosActivos: number;
    cuentasActivas: number;
    eventosAnio: number;
  };
  finanzas: {
    recaudadoMes: number;
    recaudadoAnio: number;
    egresosMes: number;
    egresosAnio: number;
    saldoCaja: number;
    carteraPendiente: number;
    carteraVencida: number;
    comunerosEnMora: number;
  };
  cobranza: { emitido: number; cobrado: number; porcentaje: number | null };
  asistencia: {
    promedio: number | null;
    ultimosEventos: { id: number; tipo: 'ASAMBLEA' | 'MINGA'; titulo: string; fecha: string; presentes: number; registrados: number }[];
  };
  proximosEventos: {
    id: number;
    tipo: 'ASAMBLEA' | 'MINGA';
    titulo: string;
    fecha: string;
    hora_inicio: string;
    lugar: string | null;
    estado: 'BORRADOR' | 'PROGRAMADO' | 'CONVOCADO';
  }[];
}

/* ------------------------------------------------------------------------------
 * Envolturas de respuesta y contratos usados por AdminService.
 * ---------------------------------------------------------------------------- */

export interface Paginacion {
  total: number;
  page: number;
  limit: number;
}

export interface RespuestaApi<T> {
  status: 'OK' | 'ERROR';
  message?: string;
  data: T;
}

export interface RespuestaPaginada<T> extends RespuestaApi<T[]> {
  pagination: Paginacion;
}

/** Respuesta de una operación que solo informa el resultado. */
export interface RespuestaMensaje {
  status: 'OK' | 'ERROR';
  message: string;
}

/** Fila de GET /personas: incluye el estado de la cuenta de acceso. */
export interface PersonaListado extends PersonaItem {
  created_at?: string;
  cuenta_estado: 'ACTIVA' | 'BLOQUEADA' | 'INACTIVA' | null;
  rol: 'ADMIN' | 'USUARIO' | null;
}

export interface SectorItem {
  id: number;
  nombre: string;
  descripcion?: string | null;
  lotesCount: number;
  superficieHa: number;
}

export type EstadoAsistencia = 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO' | 'PENDIENTE';

/** Persona del padrón de un evento con su asistencia registrada (o PENDIENTE). */
export interface AsistenciaPadron {
  persona_id: number;
  nombre: string;
  cedula: string;
  estado: EstadoAsistencia;
  motivo_justificacion: string;
  hora_registro: string | null;
}

export interface AsistenciaRegistro {
  persona_id: number;
  estado: EstadoAsistencia;
  motivo_justificacion?: string | null;
}

export interface PadronRespuesta extends RespuestaApi<AsistenciaPadron[]> {
  resumen: { total: number; presentes: number; ausentes: number; justificados: number; pendientes: number };
  estado: EventoItem['estado'];
}

export interface FinalizacionRespuesta extends RespuestaMensaje {
  estado: 'REALIZADO';
  multasGeneradas: number;
  yaFinalizada: boolean;
}

/** NO_DISPONIBLE: el servicio de WhatsApp no responde. NO_CONFIGURADO: falta su token en el backend. */
export type EstadoConexionWhatsApp = 'DESCONECTADO' | 'INICIANDO' | 'ESPERANDO_QR' | 'CONECTADO' | 'NO_DISPONIBLE' | 'NO_CONFIGURADO';

export interface GrupoWhatsApp {
  id: string;
  nombre: string;
  participantes?: number | null;
}

export interface EstadoWhatsApp {
  estado: EstadoConexionWhatsApp;
  conectado: boolean;
  mensaje: string;
  /** Imagen del código QR (data URL) mientras se espera vincular el teléfono. */
  qr: string | null;
  /** Grupo donde se publican las convocatorias, o null si aún no se eligió. */
  grupo: GrupoWhatsApp | null;
}

export interface ConvocatoriaWhatsApp {
  grupo: GrupoWhatsApp;
  estado: 'BORRADOR' | 'PROGRAMADO' | 'CONVOCADO';
  reenvio: boolean;
}
