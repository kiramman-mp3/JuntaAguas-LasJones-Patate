import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BalanceRespuesta, UsuarioBusqueda, ConceptoCobro, Egreso, HistorialAnual, NuevaTarifa, NuevoEgreso, NuevoPago,
  ObligacionItem, Pago, PagoDetalle, PagoRegistrado, Respuesta, ResultadoObligacionesAnuales, ResumenAnualAgua, Tarifa, ObligacionAnualAgua
} from '../models/finanzas';

/** Parámetros de consulta sin valores vacíos. */
function parametros(valores: Record<string, string | number | null | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(valores)) {
    if (valor !== null && valor !== undefined && valor !== '') params = params.set(clave, String(valor));
  }
  return params;
}

/** Cliente tipado del módulo financiero: cobros, pagos, egresos, tarifas y pago anual de agua. */
@Injectable({ providedIn: 'root' })
export class FinanzasService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/financiero`;

  /** Búsqueda de usuarios en el servidor (como máximo `limite` resultados). */
  buscarUsuarios(termino: string, limite = 8): Observable<Respuesta<UsuarioBusqueda[]>> {
    return this.http.get<Respuesta<UsuarioBusqueda[]>>(`${environment.apiUrl}/personas`, {
      params: parametros({ busqueda: termino.trim(), page: 1, limit: limite })
    });
  }

  getBalance(desde?: string, hasta?: string): Observable<BalanceRespuesta> {
    return this.http.get<BalanceRespuesta>(`${this.url}/balance`, { params: parametros({ desde, hasta }) });
  }

  /** Ingresos, egresos y balance por año y mes, calculados en el backend. */
  getHistorialAnual(): Observable<Respuesta<HistorialAnual>> {
    return this.http.get<Respuesta<HistorialAnual>>(`${this.url}/historial`);
  }

  getObligaciones(filtros: { persona_id?: number; estado?: ObligacionItem['estado']; anio?: number }): Observable<Respuesta<ObligacionItem[]>> {
    return this.http.get<Respuesta<ObligacionItem[]>>(`${this.url}/obligaciones`, { params: parametros(filtros) });
  }

  registrarPago(pago: NuevoPago): Observable<PagoRegistrado> {
    return this.http.post<PagoRegistrado>(`${this.url}/pagos`, pago);
  }

  subirComprobante(id: number, archivo: File): Observable<Respuesta<unknown>> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return this.http.post<Respuesta<unknown>>(`${this.url}/pagos/${id}/comprobante`, datos);
  }

  descargarComprobante(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/pagos/${id}/comprobante`, { responseType: 'blob' });
  }

  getPagos(filtros: { desde?: string; hasta?: string; estado?: Pago['estado'] } = {}): Observable<Respuesta<Pago[]>> {
    return this.http.get<Respuesta<Pago[]>>(`${this.url}/pagos`, { params: parametros(filtros) });
  }

  getPago(id: number): Observable<Respuesta<PagoDetalle>> {
    return this.http.get<Respuesta<PagoDetalle>>(`${this.url}/pagos/${id}`);
  }

  anularPago(id: number, motivo: string): Observable<Respuesta<unknown>> {
    return this.http.post<Respuesta<unknown>>(`${this.url}/pagos/${id}/anular`, { motivo });
  }

  getEgresos(filtros: { desde?: string; hasta?: string } = {}): Observable<Respuesta<Egreso[]>> {
    return this.http.get<Respuesta<Egreso[]>>(`${this.url}/egresos`, { params: parametros(filtros) });
  }

  registrarEgreso(egreso: NuevoEgreso): Observable<Respuesta<unknown> & { egresoId: number }> {
    return this.http.post<Respuesta<unknown> & { egresoId: number }>(`${this.url}/egresos`, egreso);
  }

  getConceptos(): Observable<Respuesta<ConceptoCobro[]>> {
    return this.http.get<Respuesta<ConceptoCobro[]>>(`${this.url}/conceptos`);
  }

  getTarifas(): Observable<Respuesta<Tarifa[]>> {
    return this.http.get<Respuesta<Tarifa[]>>(`${this.url}/tarifas`);
  }

  registrarTarifa(tarifa: NuevaTarifa): Observable<Respuesta<unknown> & { tarifaId: number }> {
    return this.http.post<Respuesta<unknown> & { tarifaId: number }>(`${this.url}/tarifas`, tarifa);
  }

  /** Obligaciones anuales de agua emitidas, cobradas y pendientes de un año. */
  getResumenAnualAgua(anio: number): Observable<Respuesta<ResumenAnualAgua>> {
    return this.http.get<Respuesta<ResumenAnualAgua>>(`${this.url}/agua-anual/resumen`, { params: parametros({ anio }) });
  }

  /** Obligaciones anuales de agua pendientes de un usuario, de la más antigua a la más reciente. */
  getObligacionesAnualesAgua(personaId: number): Observable<Respuesta<ObligacionAnualAgua[]>> {
    return this.http.get<Respuesta<ObligacionAnualAgua[]>>(`${this.url}/agua-anual/obligaciones/${personaId}`);
  }

  /** Registra el pago de obligaciones anuales de agua (solo transferencia o depósito). */
  registrarPagoAnualAgua(payload: NuevoPago): Observable<PagoRegistrado> {
    return this.http.post<PagoRegistrado>(`${this.url}/agua-anual/pagos`, payload);
  }

  /**
   * Emite la obligación anual de agua del año para los usuarios activos con lote; repetirlo no duplica.
   * Con `simular` solo calcula cuántas se emitirían. Sin `valor_total` usa la tarifa AGUA_ANUAL del 1 de enero.
   */
  generarObligacionesAnualesAgua(payload: { anio: number; valor_total?: number | null; simular?: boolean }): Observable<Respuesta<ResultadoObligacionesAnuales>> {
    return this.http.post<Respuesta<ResultadoObligacionesAnuales>>(`${this.url}/agua-anual/obligaciones`, payload);
  }
}
