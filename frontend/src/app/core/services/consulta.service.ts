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
import { DocumentosService, DocumentoSubido, TipoDocumento } from './documentos.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConsultaService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService, private documentos: DocumentosService) {}

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
    // Solo eventos anunciados y sin datos personales.
    return this.http.get<any>(`${this.apiUrl}/eventos/publicos`);
  }

  getEventoDetalle(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/eventos/${id}`, this.getAuthHeaders());
  }

  getSectores(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/lotes/sectores`);
  }

  subirDocumentoEvento(id: number, tipo: TipoDocumento, archivo: File): Observable<DocumentoSubido> {
    return this.documentos.subir(id, tipo, archivo);
  }

  abrirDocumento(ruta: string | null | undefined): void {
    this.documentos.abrir(ruta);
  }

  getDocumentosEvento(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/eventos/${id}/documentos`, this.getAuthHeaders());
  }

  descargarListaAsistencia(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/eventos/${id}/pdf-asistencia`, {
      ...this.getAuthHeaders(), responseType: 'blob'
    });
  }
}

