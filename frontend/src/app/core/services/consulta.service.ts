import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DeudaItem {
  id: number;
  concepto: string;
  anio: number;
  periodo: string;
  valor: number;
  estado: 'PENDIENTE' | 'PAGADA' | 'ANULADA';
  fechaEmision: string;
}

export interface ConsultaResultadoResponse {
  status: string;
  resultado: {
    cedula: string;
    nombres: string;
    sector: string;
    loteCodigo: string;
    totalPendiente: number;
    deudas: DeudaItem[];
  };
}

import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConsultaService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getAuthHeaders() {
    const token = this.authService.getToken();
    return {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
  }

  consultarPorCedula(cedula: string): Observable<ConsultaResultadoResponse> {
    return this.http.get<ConsultaResultadoResponse>(`${this.apiUrl}/personas/consulta/${cedula}`, this.getAuthHeaders());
  }

  getEventosPublicos(): Observable<any> {
    // El endpoint GET /eventos es público
    return this.http.get<any>(`${this.apiUrl}/eventos`);
  }

  getEventoDetalle(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/eventos/${id}`);
  }

  getSectores(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/lotes/sectores`);
  }

  subirDocumentoEvento(id: number, tipo: string, nombre_archivo: string, contenido_base64: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/eventos/${id}/documentos`, {
      tipo,
      nombre_archivo,
      contenido_base64,
      estado: 'FIRMADO'
    }, this.getAuthHeaders());
  }

  getDocumentosEvento(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/eventos/${id}/documentos`);
  }

  descargarListaAsistencia(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/eventos/${id}/pdf-asistencia`, {
      ...this.getAuthHeaders(), responseType: 'blob'
    });
  }

  urlDocumento(ruta: string): string {
    return ruta.startsWith('/uploads/') ? `${this.apiUrl.replace(/\/api\/?$/, '')}${ruta}` : ruta;
  }
}

