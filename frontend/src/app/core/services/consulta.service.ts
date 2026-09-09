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

@Injectable({
  providedIn: 'root'
})
export class ConsultaService {
  private apiUrl = 'http://localhost:3000/api/v1/personas';

  constructor(private http: HttpClient) {}

  consultarPorCedula(cedula: string): Observable<ConsultaResultadoResponse> {
    return this.http.get<ConsultaResultadoResponse>(`${this.apiUrl}/consulta/${cedula}`);
  }
}
