import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardResumen } from '../models/api-payloads';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getPersonas(page: number = 1, limit: number = 25, busqueda: string = '', estado: string = ''): Observable<any> {
    let url = `${this.baseUrl}/personas?page=${page}&limit=${limit}`;
    if (busqueda) url += `&busqueda=${encodeURIComponent(busqueda)}`;
    if (estado) url += `&estado=${encodeURIComponent(estado)}`;
    return this.http.get(url);
  }

  createPersona(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/personas`, data);
  }

  updatePersona(id: number, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/personas/${id}`, data);
  }

  /** Crea la cuenta de acceso de un comunero; la respuesta trae la contraseña temporal. */
  crearCuenta(personaId: number, rol: 'ADMIN' | 'USUARIO'): Observable<{ status: string; message: string; passwordTemporal: string }> {
    return this.http.post<{ status: string; message: string; passwordTemporal: string }>(`${this.baseUrl}/personas/${personaId}/cuenta`, { rol });
  }

  /** Genera una contraseña temporal nueva y obliga a cambiarla en el próximo ingreso. */
  restablecerPassword(personaId: number): Observable<{ status: string; message: string; passwordTemporal: string }> {
    return this.http.post<{ status: string; message: string; passwordTemporal: string }>(`${this.baseUrl}/personas/${personaId}/cuenta/restablecer-password`, {});
  }

  getPersona(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/personas/${id}`);
  }

  getLotes(sector_id?: number, busqueda?: string, persona_id?: number): Observable<any> {
    let url = `${this.baseUrl}/lotes?`;
    if (sector_id) url += `sector_id=${sector_id}&`;
    if (busqueda) url += `busqueda=${encodeURIComponent(busqueda)}&`;
    if (persona_id) url += `persona_id=${persona_id}&`;
    return this.http.get(url);
  }

  createLote(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/lotes`, data);
  }

  sugerirCodigoLote(sectorId: number): Observable<{ status: string; data: { codigo: string } }> {
    return this.http.get<{ status: string; data: { codigo: string } }>(
      `${this.baseUrl}/lotes/sugerir-codigo?sector_id=${sectorId}`
    );
  }

  vincularPersonaLote(loteId: number, data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/lotes/${loteId}/vincular-persona`, data);
  }

  getSectores(): Observable<any> {
    return this.http.get(`${this.baseUrl}/lotes/sectores`);
  }

  getTurnos(): Observable<any> {
    return this.http.get(`${this.baseUrl}/turnos`);
  }

  asignarTurno(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/turnos`, payload);
  }

  actualizarTurno(id: number, payload: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/turnos/${id}`, payload);
  }

  eliminarTurno(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/turnos/${id}`);
  }

  getEventos(tipo?: 'ASAMBLEA' | 'MINGA'): Observable<any> {
    const filtro = tipo ? `?tipo=${tipo}` : '';
    return this.http.get(`${this.baseUrl}/eventos${filtro}`);
  }

  createEvento(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/eventos`, payload);
  }

  getEventoById(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/eventos/${id}`);
  }

  registrarAsistencias(id: number, asistencias: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/eventos/${id}/asistencias`, { asistencias });
  }

  getAsistencias(eventoId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/eventos/${eventoId}/asistencias`);
  }

  cambiarEstadoAsamblea(id: number, estado: 'BORRADOR' | 'PROGRAMADO' | 'CONVOCADO' | 'CANCELADO'): Observable<any> {
    return this.http.post(`${this.baseUrl}/eventos/${id}/estado`, { estado });
  }

  finalizarAsamblea(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/eventos/${id}/finalizar`, {});
  }

  guardarPuntosAsamblea(id: number, puntos: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/eventos/${id}/puntos`, { puntos });
  }

  cambiarEstadoActaPunto(id: number, puntoId: number, payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/eventos/${id}/puntos/${puntoId}/estado`, payload);
  }

  cambiarEstadoMinga(id: number, estado: 'PROGRAMADO' | 'CONVOCADO' | 'CANCELADO'): Observable<any> {
    return this.http.post(`${this.baseUrl}/mingas/${id}/estado`, { estado });
  }

  finalizarMinga(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/mingas/${id}/finalizar`, {});
  }

  getAsistenciasMinga(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/mingas/${id}/asistencias`);
  }

  registrarAsistenciasMinga(id: number, asistencias: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/mingas/${id}/asistencias`, { asistencias });
  }

  getDashboardResumen(): Observable<{ status: string; data: DashboardResumen }> {
    return this.http.get<{ status: string; data: DashboardResumen }>(`${this.baseUrl}/dashboard/resumen`);
  }

  getBalance(): Observable<any> {
    return this.http.get(`${this.baseUrl}/financiero/balance`);
  }

  getObligaciones(personaId?: number, anio?: number | null): Observable<any> {
    let url = `${this.baseUrl}/financiero/obligaciones?`;
    const params: string[] = [];

    if (personaId) {
      params.push(`persona_id=${personaId}`);
    }
    if (anio) {
      params.push(`anio=${anio}`);
    }

    return this.http.get(url + params.join('&'));
  }

  registrarPago(payload: { persona_id: number; metodo: string; referencia?: string; observacion?: string; observaciones?: string; obligacionesIds: number[] }): Observable<any> {
    const body = {
      ...payload,
      observacion: payload.observacion || payload.observaciones || 'Pago procesado desde panel administrativo.'
    };
    return this.http.post(`${this.baseUrl}/financiero/pagos`, body);
  }

  getPagos(personaId?: number): Observable<any> {
    const url = personaId ? `${this.baseUrl}/financiero/pagos?persona_id=${personaId}` : `${this.baseUrl}/financiero/pagos`;
    return this.http.get(url);
  }

  anularPago(pagoId: number, motivo: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/financiero/pagos/${pagoId}/anular`, { motivo });
  }

  getEgresos(): Observable<any> {
    return this.http.get(`${this.baseUrl}/financiero/egresos`);
  }

  registrarEgreso(payload: { fecha?: string; concepto: string; descripcion?: string; numero_factura?: string; valor: number; proveedor_id?: number }): Observable<any> {
    return this.http.post(`${this.baseUrl}/financiero/egresos`, payload);
  }

  // --- SERVICIOS WHATSAPP WEB ---
  getWhatsAppStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/whatsapp/status`);
  }

  initWhatsApp(): Observable<any> {
    return this.http.post(`${this.baseUrl}/whatsapp/init`, {});
  }

  logoutWhatsApp(): Observable<any> {
    return this.http.post(`${this.baseUrl}/whatsapp/logout`, {});
  }

  notificarMingaWhatsApp(eventoId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/whatsapp/notificar-minga`, { eventoId });
  }

  getPeriodosObligaciones(): Observable<any> {
    return this.http.get(`${this.baseUrl}/financiero/periodosobligaciones`);
  }

  // Sustituye estos métodos dentro de AdminService.
// Conserva los imports HttpClient y Observable que ya utiliza tu servicio.
getObligacionesMultas(cedula: string, anio: number): Observable<any> {
  return this.http.get(`${this.baseUrl}/financiero/obligaciones/multas`, {
    params: { cedula, anio: String(anio) },
  });
}

getObligacionesMensualidades(cedula: string, anio: number): Observable<any> {
  return this.http.get(`${this.baseUrl}/financiero/obligaciones/mensualidades`, {
    params: { cedula, anio: String(anio) },
  });
}
}