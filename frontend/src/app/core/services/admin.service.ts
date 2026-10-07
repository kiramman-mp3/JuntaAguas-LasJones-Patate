import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AsistenciaRegistro, DashboardResumen, EstadoWhatsApp, EventoItem, FinalizacionRespuesta, LoteItem, PadronRespuesta,
  PersonaListado, RespuestaApi, RespuestaMensaje, RespuestaPaginada, SectorItem, TurnoItem
} from '../models/api-payloads';

type RespuestaCredencial = RespuestaMensaje & { passwordTemporal: string };
type EstadoEvento = 'BORRADOR' | 'PROGRAMADO' | 'CONVOCADO' | 'CANCELADO';

/**
 * Cliente de la API para el panel administrativo (comuneros, lotes, turnos, eventos y WhatsApp).
 * Las operaciones financieras están en FinanzasService.
 * Los formularios de los componentes aún no están tipados, por eso los cuerpos se reciben como `object`.
 */
@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** Listado paginado de comuneros. El servidor acepta como máximo 100 por página. */
  getPersonas(page = 1, limit = 25, busqueda = '', estado = ''): Observable<RespuestaPaginada<PersonaListado>> {
    let params = new HttpParams().set('page', page).set('limit', Math.min(limit, 100));
    if (busqueda) params = params.set('busqueda', busqueda);
    if (estado) params = params.set('estado', estado);
    return this.http.get<RespuestaPaginada<PersonaListado>>(`${this.baseUrl}/personas`, { params });
  }

  createPersona(data: object): Observable<RespuestaMensaje & { personaId: number; passwordTemporal?: string }> {
    return this.http.post<RespuestaMensaje & { personaId: number; passwordTemporal?: string }>(`${this.baseUrl}/personas`, data);
  }

  updatePersona(id: number, data: object): Observable<RespuestaMensaje> {
    return this.http.put<RespuestaMensaje>(`${this.baseUrl}/personas/${id}`, data);
  }

  /** Crea la cuenta de acceso de un comunero; la respuesta trae la contraseña temporal. */
  crearCuenta(personaId: number, rol: 'ADMIN' | 'USUARIO'): Observable<RespuestaCredencial> {
    return this.http.post<RespuestaCredencial>(`${this.baseUrl}/personas/${personaId}/cuenta`, { rol });
  }

  /** Genera una contraseña temporal nueva y obliga a cambiarla en el próximo ingreso. */
  restablecerPassword(personaId: number): Observable<RespuestaCredencial> {
    return this.http.post<RespuestaCredencial>(`${this.baseUrl}/personas/${personaId}/cuenta/restablecer-password`, {});
  }

  getLotes(sector_id?: number, busqueda?: string, persona_id?: number): Observable<RespuestaApi<LoteItem[]>> {
    let params = new HttpParams();
    if (sector_id) params = params.set('sector_id', sector_id);
    if (busqueda) params = params.set('busqueda', busqueda);
    if (persona_id) params = params.set('persona_id', persona_id);
    return this.http.get<RespuestaApi<LoteItem[]>>(`${this.baseUrl}/lotes`, { params });
  }

  createLote(data: object): Observable<RespuestaMensaje & { loteId: number }> {
    return this.http.post<RespuestaMensaje & { loteId: number }>(`${this.baseUrl}/lotes`, data);
  }

  sugerirCodigoLote(sectorId: number): Observable<RespuestaApi<{ codigo: string }>> {
    return this.http.get<RespuestaApi<{ codigo: string }>>(`${this.baseUrl}/lotes/sugerir-codigo`, { params: { sector_id: sectorId } });
  }

  vincularPersonaLote(loteId: number, data: object): Observable<RespuestaMensaje> {
    return this.http.post<RespuestaMensaje>(`${this.baseUrl}/lotes/${loteId}/vincular-persona`, data);
  }

  createSector(data: { nombre: string; descripcion?: string }): Observable<RespuestaMensaje & { sectorId: number }> {
    return this.http.post<RespuestaMensaje & { sectorId: number }>(`${this.baseUrl}/lotes/sectores`, data);
  }

  getSectores(): Observable<RespuestaApi<SectorItem[]>> {
    return this.http.get<RespuestaApi<SectorItem[]>>(`${this.baseUrl}/lotes/sectores`);
  }

  getTurnos(): Observable<RespuestaApi<TurnoItem[]>> {
    return this.http.get<RespuestaApi<TurnoItem[]>>(`${this.baseUrl}/turnos`);
  }

  asignarTurno(payload: object): Observable<RespuestaMensaje & { turnoId: number; obligacionId: number | null }> {
    return this.http.post<RespuestaMensaje & { turnoId: number; obligacionId: number | null }>(`${this.baseUrl}/turnos`, payload);
  }

  actualizarTurno(id: number, payload: object): Observable<RespuestaMensaje> {
    return this.http.put<RespuestaMensaje>(`${this.baseUrl}/turnos/${id}`, payload);
  }

  eliminarTurno(id: number): Observable<RespuestaMensaje> {
    return this.http.delete<RespuestaMensaje>(`${this.baseUrl}/turnos/${id}`);
  }

  getEventos(tipo?: 'ASAMBLEA' | 'MINGA'): Observable<RespuestaApi<EventoItem[]>> {
    const params = tipo ? new HttpParams().set('tipo', tipo) : undefined;
    return this.http.get<RespuestaApi<EventoItem[]>>(`${this.baseUrl}/eventos`, { params });
  }

  createEvento(payload: object): Observable<RespuestaMensaje & { eventoId: number }> {
    return this.http.post<RespuestaMensaje & { eventoId: number }>(`${this.baseUrl}/eventos`, payload);
  }

  registrarAsistencias(id: number, asistencias: AsistenciaRegistro[]): Observable<RespuestaMensaje & { registradas: number }> {
    return this.http.post<RespuestaMensaje & { registradas: number }>(`${this.baseUrl}/eventos/${id}/asistencias`, { asistencias });
  }

  getAsistencias(eventoId: number): Observable<PadronRespuesta> {
    return this.http.get<PadronRespuesta>(`${this.baseUrl}/eventos/${eventoId}/asistencias`);
  }

  cambiarEstadoAsamblea(id: number, estado: EstadoEvento): Observable<RespuestaMensaje & { estado: EstadoEvento }> {
    return this.http.post<RespuestaMensaje & { estado: EstadoEvento }>(`${this.baseUrl}/eventos/${id}/estado`, { estado });
  }

  finalizarAsamblea(id: number): Observable<FinalizacionRespuesta> {
    return this.http.post<FinalizacionRespuesta>(`${this.baseUrl}/eventos/${id}/finalizar`, {});
  }

  guardarPuntosAsamblea(id: number, puntos: object[]): Observable<RespuestaMensaje & { data: unknown[] }> {
    return this.http.post<RespuestaMensaje & { data: unknown[] }>(`${this.baseUrl}/eventos/${id}/puntos`, { puntos });
  }

  cambiarEstadoActaPunto(id: number, puntoId: number, payload: object): Observable<RespuestaMensaje & { data: unknown }> {
    return this.http.post<RespuestaMensaje & { data: unknown }>(`${this.baseUrl}/eventos/${id}/puntos/${puntoId}/estado`, payload);
  }

  cambiarEstadoMinga(id: number, estado: 'PROGRAMADO' | 'CONVOCADO' | 'CANCELADO'): Observable<RespuestaMensaje & { estado: string }> {
    return this.http.post<RespuestaMensaje & { estado: string }>(`${this.baseUrl}/mingas/${id}/estado`, { estado });
  }

  finalizarMinga(id: number): Observable<FinalizacionRespuesta> {
    return this.http.post<FinalizacionRespuesta>(`${this.baseUrl}/mingas/${id}/finalizar`, {});
  }

  getAsistenciasMinga(id: number): Observable<PadronRespuesta> {
    return this.http.get<PadronRespuesta>(`${this.baseUrl}/mingas/${id}/asistencias`);
  }

  registrarAsistenciasMinga(id: number, asistencias: AsistenciaRegistro[]): Observable<RespuestaMensaje & { registradas: number }> {
    return this.http.post<RespuestaMensaje & { registradas: number }>(`${this.baseUrl}/mingas/${id}/asistencias`, { asistencias });
  }

  getDashboardResumen(): Observable<RespuestaApi<DashboardResumen>> {
    return this.http.get<RespuestaApi<DashboardResumen>>(`${this.baseUrl}/dashboard/resumen`);
  }

  // --- WhatsApp Web ---
  getWhatsAppStatus(): Observable<RespuestaApi<EstadoWhatsApp>> {
    return this.http.get<RespuestaApi<EstadoWhatsApp>>(`${this.baseUrl}/whatsapp/status`);
  }

  initWhatsApp(): Observable<RespuestaApi<EstadoWhatsApp>> {
    return this.http.post<RespuestaApi<EstadoWhatsApp>>(`${this.baseUrl}/whatsapp/init`, {});
  }

  logoutWhatsApp(): Observable<RespuestaMensaje> {
    return this.http.post<RespuestaMensaje>(`${this.baseUrl}/whatsapp/logout`, {});
  }

  notificarMingaWhatsApp(eventoId: number): Observable<RespuestaMensaje & { enviados: number; fallidos: number; totalComuneros?: number }> {
    return this.http.post<RespuestaMensaje & { enviados: number; fallidos: number; totalComuneros?: number }>(`${this.baseUrl}/whatsapp/notificar-minga`, { eventoId });
  }
}
