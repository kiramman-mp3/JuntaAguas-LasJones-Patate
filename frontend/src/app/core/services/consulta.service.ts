import { Injectable, inject } from '@angular/core';
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

/** Evento anunciado en la página pública (GET /eventos/publicos): sin datos personales. */
export interface EventoPublico {
  id: number;
  tipo: 'ASAMBLEA' | 'MINGA';
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string | null;
  lugar: string | null;
  /** El servidor solo publica PROGRAMADO y CONVOCADO; la interfaz igual descarta otros estados. */
  estado: EventoItem['estado'];
  genera_multa_ausencia: boolean | number;
  valor_multa: number | null;
  convocatoria_firmada_url: string | null;
}

/** Punto del orden del día de una asamblea, con su acta. */
export interface PuntoAsamblea {
  id: number;
  evento_id: number;
  orden: number;
  punto_tratar: string;
  tratado: string | null;
  resolucion: string | null;
  titulo_acta: string | null;
  estado_acta: string | null;
  [campo: string]: unknown;
}

/** Respuesta de GET /eventos/:id. */
export interface EventoDetalleResponse {
  status: string;
  evento: EventoItem & Record<string, unknown>;
  puntos: PuntoAsamblea[];
  asistenciaStats: { estado: string; total: number }[];
}

import { DocumentosService, DocumentoSubido, TipoDocumento } from './documentos.service';
import { environment } from '../../../environments/environment';
import { EventoItem, RespuestaApi } from '../models/api-payloads';

@Injectable({
  providedIn: 'root'
})
export class ConsultaService {
  private apiUrl = environment.apiUrl;

  private readonly http = inject(HttpClient);
  private readonly documentos = inject(DocumentosService);

  constructor() {}

  consultarPorCedula(cedula: string): Observable<ConsultaResultadoResponse> {
    return this.http.get<ConsultaResultadoResponse>(`${this.apiUrl}/personas/consulta/${cedula}`);
  }

  getEventosPublicos(): Observable<RespuestaApi<EventoPublico[]>> {
    // Solo eventos anunciados y sin datos personales.
    return this.http.get<RespuestaApi<EventoPublico[]>>(`${this.apiUrl}/eventos/publicos`);
  }

  getEventoDetalle(id: number): Observable<EventoDetalleResponse> {
    return this.http.get<EventoDetalleResponse>(`${this.apiUrl}/eventos/${id}`);
  }

  subirDocumentoEvento(id: number, tipo: TipoDocumento, archivo: File): Observable<DocumentoSubido> {
    return this.documentos.subir(id, tipo, archivo);
  }

  abrirDocumento(ruta: string | null | undefined): void {
    this.documentos.abrir(ruta);
  }

  descargarListaAsistencia(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/eventos/${id}/pdf-asistencia`, { responseType: 'blob' });
  }
}

