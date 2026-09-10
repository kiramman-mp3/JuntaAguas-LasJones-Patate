import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getPersonas(page: number = 1, limit: number = 25, busqueda: string = '', estado: string = ''): Observable<any> {
    let url = `${this.baseUrl}/personas?page=${page}&limit=${limit}`;
    if (busqueda) url += `&busqueda=${encodeURIComponent(busqueda)}`;
    if (estado) url += `&estado=${encodeURIComponent(estado)}`;
    return this.http.get(url, { headers: this.getAuthHeaders() });
  }

  createPersona(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/personas`, data, { headers: this.getAuthHeaders() });
  }

  updatePersona(id: number, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/personas/${id}`, data, { headers: this.getAuthHeaders() });
  }

  getPersona(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/personas/${id}`, { headers: this.getAuthHeaders() });
  }

  getLotes(sector_id?: number, busqueda?: string, persona_id?: number): Observable<any> {
    let url = `${this.baseUrl}/lotes?`;
    if (sector_id) url += `sector_id=${sector_id}&`;
    if (busqueda) url += `busqueda=${encodeURIComponent(busqueda)}&`;
    if (persona_id) url += `persona_id=${persona_id}&`;
    return this.http.get(url, { headers: this.getAuthHeaders() });
  }

  createLote(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/lotes`, data, { headers: this.getAuthHeaders() });
  }

  vincularPersonaLote(loteId: number, data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/lotes/${loteId}/vincular-persona`, data, { headers: this.getAuthHeaders() });
  }

  getSectores(): Observable<any> {
    return this.http.get(`${this.baseUrl}/lotes/sectores`, { headers: this.getAuthHeaders() });
  }

  getTurnos(): Observable<any> {
    return this.http.get(`${this.baseUrl}/turnos`, { headers: this.getAuthHeaders() });
  }

  asignarTurno(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/turnos`, payload, { headers: this.getAuthHeaders() });
  }

  getEventos(): Observable<any> {
    return this.http.get(`${this.baseUrl}/eventos`, { headers: this.getAuthHeaders() });
  }

  createEvento(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/eventos`, payload, { headers: this.getAuthHeaders() });
  }

  getEventoById(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/eventos/${id}`, { headers: this.getAuthHeaders() });
  }

  registrarAsistencias(id: number, asistencias: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/eventos/${id}/asistencias`, { asistencias }, { headers: this.getAuthHeaders() });
  }

  getAsistencias(eventoId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/eventos/${eventoId}/asistencias`, { headers: this.getAuthHeaders() });
  }

  getBalance(): Observable<any> {
    return this.http.get(`${this.baseUrl}/financiero/balance`, { headers: this.getAuthHeaders() });
  }

  getObligaciones(personaId?: number): Observable<any> {
    const url = personaId ? `${this.baseUrl}/financiero/obligaciones?persona_id=${personaId}` : `${this.baseUrl}/financiero/obligaciones`;
    return this.http.get(url, { headers: this.getAuthHeaders() });
  }

  registrarPago(payload: { persona_id: number; metodo: string; referencia?: string; observaciones?: string; obligacionesIds: number[] }): Observable<any> {
    return this.http.post(`${this.baseUrl}/financiero/pagos`, payload, { headers: this.getAuthHeaders() });
  }
}
