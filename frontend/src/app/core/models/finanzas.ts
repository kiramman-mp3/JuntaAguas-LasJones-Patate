/**
 * Contratos de la API financiera (/api/financiero/*).
 * Los montos llegan como número; las fechas de calendario como 'AAAA-MM-DD'
 * y los instantes (fecha de pago) como ISO con zona.
 */
import { ObligacionItem } from './api-payloads';

export type { ObligacionItem };

export interface Respuesta<T> {
  status: 'OK' | 'ERROR';
  message?: string;
  data: T;
}

export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEPOSITO' | 'OTRO';
/** Formas de pago que acepta la caja: siempre con referencia bancaria. */
export type MetodoPagoNuevo = 'TRANSFERENCIA' | 'DEPOSITO';
export type EstadoPago = 'VIGENTE' | 'ANULADO';

export interface Pago {
  comprobante_url?: string | null;
  id: number;
  persona_id: number;
  fecha_pago: string;
  valor_total: number;
  metodo: MetodoPago;
  referencia: string | null;
  estado: EstadoPago;
  observacion: string | null;
  motivo_anulacion: string | null;
  fecha_anulacion: string | null;
  usuario_nombre: string;
  cedula: string;
  registrado_por_usuario: string | null;
  obligaciones_pagadas: number;
}

export interface PagoDetalleLinea {
  obligacion_id: number;
  valor_pagado: number;
  periodo_anio: number | null;
  periodo_mes: number | null;
  observacion: string | null;
  concepto_codigo: string;
  concepto_nombre: string;
}

export interface PagoDetalle extends Pago {
  detalles: PagoDetalleLinea[];
}

/** Pago anual de agua tal como lo lista GET /financiero/agua-anual/pagos. */
export interface PagoAnual {
  id: number;
  persona_id: number;
  fecha_pago: string;
  valor_total: number;
  metodo: MetodoPago;
  referencia: string | null;
  estado: EstadoPago;
  observacion: string | null;
  motivo_anulacion: string | null;
  fecha_anulacion: string | null;
  usuario_nombre: string;
  cedula: string;
  registrado_por_usuario: string | null;
  /** Años cubiertos, separados por coma ('2025, 2026'). */
  anios: string | null;
}

export interface PagoAnualDetalle extends PagoAnual {
  detalles: { obligacion_id: number; valor_pagado: number; periodo_anio: number }[];
}

/** GENERAL: pago de multas y otros cobros. AGUA: pago anual de agua. Cada uno tiene su numeración. */
export type TipoRecibo = 'GENERAL' | 'AGUA';

/** Fila común para listar juntos los dos tipos de pago (historial y portal del usuario). */
export interface Recibo {
  tipo: TipoRecibo;
  id: number;
  numero: string;
  fecha_pago: string;
  usuario_nombre: string;
  cedula: string;
  /** Qué cubre el pago: cantidad de obligaciones o años del agua. */
  detalle: string;
  metodo: MetodoPago;
  referencia: string | null;
  valor_total: number;
  estado: EstadoPago;
  motivo_anulacion: string | null;
  comprobante_url: string | null;
  registrado_por_usuario: string | null;
}

export function reciboDePago(p: Pago): Recibo {
  return {
    tipo: 'GENERAL', id: p.id, numero: numeroRecibo(p.id), fecha_pago: p.fecha_pago,
    usuario_nombre: p.usuario_nombre, cedula: p.cedula,
    detalle: `${p.obligaciones_pagadas} ${p.obligaciones_pagadas === 1 ? 'obligación' : 'obligaciones'}`,
    metodo: p.metodo, referencia: p.referencia, valor_total: Number(p.valor_total), estado: p.estado,
    motivo_anulacion: p.motivo_anulacion, comprobante_url: p.comprobante_url ?? null, registrado_por_usuario: p.registrado_por_usuario
  };
}

export function reciboDePagoAnual(p: PagoAnual): Recibo {
  return {
    tipo: 'AGUA', id: p.id, numero: numeroReciboAgua(p.id), fecha_pago: p.fecha_pago,
    usuario_nombre: p.usuario_nombre, cedula: p.cedula,
    detalle: p.anios ? `Agua ${p.anios}` : 'Pago anual de agua',
    metodo: p.metodo, referencia: p.referencia, valor_total: Number(p.valor_total), estado: p.estado,
    motivo_anulacion: p.motivo_anulacion, comprobante_url: null, registrado_por_usuario: p.registrado_por_usuario
  };
}

/** Del pago más reciente al más antiguo. */
export function ordenarRecibos(recibos: Recibo[]): Recibo[] {
  return [...recibos].sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago) || b.id - a.id);
}

export interface NuevoPago {
  persona_id: number;
  obligacionesIds: number[];
  metodo: MetodoPagoNuevo;
  referencia?: string;
  observacion?: string;
}

export interface PagoRegistrado {
  status: 'OK';
  message: string;
  pagoId: number;
  valorTotal: number;
}

export interface Egreso {
  id: number;
  fecha: string;
  concepto: string;
  descripcion: string | null;
  numero_factura: string | null;
  valor: number;
  proveedor_nombre: string | null;
  proveedor_ruc: string | null;
  registrado_por_usuario: string | null;
}

export interface NuevoEgreso {
  fecha: string;
  concepto: string;
  proveedor?: string;
  ruc_proveedor?: string;
  descripcion?: string;
  numero_factura?: string;
  valor: number;
}

export interface Balance {
  totalIngresos: number;
  totalEgresos: number;
  totalPendientes: number;
  totalVencido: number;
  usuariosConDeuda: number;
  balanceAlDia: number;
  desde: string | null;
  hasta: string | null;
  fechaReporte: string;
}

export interface BalanceRespuesta {
  status: 'OK';
  balance: Balance;
  resumenMensual: { mes: string; ingresos: number; egresos: number }[];
  carteraPorConcepto: { codigo: string; nombre: string; obligaciones: number; total: number }[];
}

/** Totales calculados por el backend (en centavos) para un nodo del historial. */
export interface TotalesHistorial {
  ingresos: number;
  egresos: number;
  balance: number;
}

export interface MesHistorial extends TotalesHistorial {
  /** 'AAAA-MM' (mes de Ecuador). */
  mes: string;
  pagos: number;
  egresosRegistrados: number;
}

export interface AnioHistorial extends TotalesHistorial {
  anio: number;
  meses: MesHistorial[];
}

export interface HistorialAnual {
  anios: AnioHistorial[];
  total: TotalesHistorial;
}

export interface ConceptoCobro {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tarifa_actual: number | null;
}

export interface Tarifa {
  id: number;
  concepto_id: number;
  concepto_codigo: string;
  concepto_nombre: string;
  valor: number;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  observacion: string | null;
  activo: boolean | number;
}

export interface NuevaTarifa {
  concepto_id: number;
  valor: number;
  vigencia_desde: string;
  observacion?: string;
}

/** Persona tal como la devuelve GET /personas (búsqueda de usuarios para cobrar). */
export interface UsuarioBusqueda {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  estado: 'ACTIVO' | 'INACTIVO';
  celular?: string | null;
}

/** Obligación del pago anual de agua de un usuario (una por año). */
export interface ObligacionAnualAgua {
  id: number;
  persona_id: number;
  periodo_anio: number;
  valor_total: number;
  estado: 'PENDIENTE' | 'PAGADA' | 'ANULADA';
}

/** Resultado de emitir (o simular) el pago anual de agua de un año. */
export interface ResultadoObligacionesAnuales {
  anio: number;
  valor: number;
  usuarios: number;
  generadas: number;
  existentes: number;
  total: number;
}

/** Obligaciones anuales emitidas, cobradas y pendientes de un año. */
export interface ResumenAnualAgua {
  anio: number;
  emitidas: number;
  pagadas: number;
  pendientes: number;
  total: number;
  recaudado: number;
}

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
] as const;

/** Etiqueta legible del período de una obligación ('Marzo 2026', '2026' o '—'). */
export function etiquetaPeriodo(anio: number | null | undefined, mes: number | null | undefined): string {
  if (!anio) return '—';
  return mes && mes >= 1 && mes <= 12 ? `${MESES[mes - 1]} ${anio}` : String(anio);
}

export function numeroRecibo(id: number): string {
  return `REC-${String(id).padStart(6, '0')}`;
}
export function numeroReciboAgua(id: number): string {
  return `REC-AGUA-${String(id).padStart(6, '0')}`;
}

export function numeroEgreso(id: number): string {
  return `EGR-${String(id).padStart(6, '0')}`;
}
