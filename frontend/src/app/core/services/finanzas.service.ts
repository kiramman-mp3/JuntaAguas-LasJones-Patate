import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BalanceRespuesta, ComuneroBusqueda, ConceptoCobro, Egreso, NuevaTarifa, NuevoEgreso, NuevoPago,
  ObligacionItem, Pago, PagoDetalle, PagoRegistrado, Respuesta, ResultadoFacturacion, ResumenFacturacion, Tarifa
} from '../models/finanzas';

/** Parámetros de consulta sin valores vacíos. */
function parametros(valores: Record<string, string | number | null | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(valores)) {
    if (valor !== null && valor !== undefined && valor !== '') params = params.set(clave, String(valor));
  }
  return params;
}

/** Cliente tipado del módulo financiero: cobros, pagos, egresos, tarifas y facturación. */
@Injectable({ providedIn: 'root' })
export class FinanzasService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/financiero`;

  /** Búsqueda de comuneros en el servidor (como máximo `limite` resultados). */
  buscarComuneros(termino: string, limite = 8): Observable<Respuesta<ComuneroBusqueda[]>> {
    return this.http.get<Respuesta<ComuneroBusqueda[]>>(`${environment.apiUrl}/personas`, {
      params: parametros({ busqueda: termino.trim(), page: 1, limit: limite })
    });
  }

  getBalance(desde?: string, hasta?: string): Observable<BalanceRespuesta> {
    return this.http.get<BalanceRespuesta>(`${this.url}/balance`, { params: parametros({ desde, hasta }) });
  }

  getObligaciones(filtros: { persona_id?: number; estado?: ObligacionItem['estado']; anio?: number }): Observable<Respuesta<ObligacionItem[]>> {
    return this.http.get<Respuesta<ObligacionItem[]>>(`${this.url}/obligaciones`, { params: parametros(filtros) });
  }

  registrarPago(pago: NuevoPago): Observable<PagoRegistrado> {
    return this.http.post<PagoRegistrado>(`${this.url}/pagos`, pago);
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

  getResumenFacturacion(anio: number): Observable<Respuesta<ResumenFacturacion>> {
    return this.http.get<Respuesta<ResumenFacturacion>>(`${this.url}/facturacion/mensual`, { params: parametros({ anio }) });
  }

  /** Emite las cuotas de agua del mes; con `simular` solo calcula cuántas se emitirían. */
  facturarMes(anio: number, mes: number, simular: boolean): Observable<Respuesta<ResultadoFacturacion>> {
    return this.http.post<Respuesta<ResultadoFacturacion>>(`${this.url}/facturacion/mensual`, { anio, mes, simular });
  }
}
