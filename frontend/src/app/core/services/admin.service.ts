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

  getPersonas(): Observable<any> {
    return this.http.get(`${this.baseUrl}/personas`, { headers: this.getAuthHeaders() });
  }

  getLotes(): Observable<any> {
    return this.http.get(`${this.baseUrl}/lotes`, { headers: this.getAuthHeaders() });
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

  getEventoById(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/eventos/${id}`, { headers: this.getAuthHeaders() });
  }

  registrarAsistencias(id: number, asistencias: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/eventos/${id}/asistencias`, { asistencias }, { headers: this.getAuthHeaders() });
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
