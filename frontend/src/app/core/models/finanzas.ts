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
export type EstadoPago = 'VIGENTE' | 'ANULADO';

export interface Pago {
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
  comunero_nombre: string;
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

export interface NuevoPago {
  persona_id: number;
  obligacionesIds: number[];
  metodo: MetodoPago;
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
  comunerosConDeuda: number;
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

export interface ResultadoFacturacion {
  anio: number;
  mes: number;
  valor: number;
  comuneros: number;
  generadas: number;
  existentes: number;
  total: number;
}

export interface FacturacionMes {
  mes: number;
  emitidas: number;
  pagadas: number;
  pendientes: number;
  total: number;
  recaudado: number;
}

export interface ResumenFacturacion {
  anio: number;
  meses: FacturacionMes[];
}

/** Persona tal como la devuelve GET /personas (búsqueda de comuneros para cobrar). */
export interface ComuneroBusqueda {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  estado: 'ACTIVO' | 'INACTIVO';
  celular?: string | null;
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

export function numeroEgreso(id: number): string {
  return `EGR-${String(id).padStart(6, '0')}`;
}
