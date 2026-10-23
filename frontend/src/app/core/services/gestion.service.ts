import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaApi } from '../models/api-payloads';

/** Registro de GET /auditoria: quién hizo qué, sobre qué y cuándo (fecha en UTC). */
export interface RegistroAuditoria {
  id: number;
  cuenta_id: number | null;
  accion: string;
  entidad: string;
  entidad_id: number | null;
  fecha: string;
  ip: string | null;
  detalle: Record<string, unknown> | string | null;
  cuenta_usuario: string | null;
  persona_nombre: string | null;
}

export interface FiltrosAuditoria {
  entidad?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
}

export type EstadoFisico = 'NUEVO' | 'BUENO' | 'REGULAR' | 'MALO' | 'DADO_DE_BAJA';

export interface BienInventario {
  id: number;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  valor_unitario: number;
  fecha_adquisicion: string | null;
  estado_fisico: EstadoFisico | null;
  ubicacion: string | null;
}

export interface NuevoBien {
  codigo?: string;
  nombre: string;
  descripcion?: string;
  cantidad: number;
  valor_unitario: number;
  fecha_adquisicion?: string;
  estado_fisico: EstadoFisico;
  ubicacion?: string;
}

export type EstadoActividad = 'PENDIENTE' | 'EN_PROCESO' | 'CUMPLIDA' | 'NO_CUMPLIDA' | 'CANCELADA';

export interface ActividadPlan {
  id: number;
  plan_id: number;
  nombre: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoActividad;
  fecha_cumplimiento: string | null;
}

export interface PlanAnual {
  id: number;
  anio: number;
  descripcion: string | null;
  estado: 'BORRADOR' | 'ACTIVO' | 'CERRADO';
  actividades: ActividadPlan[];
}

export interface NuevaActividad {
  nombre: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin: string;
}

/** Parámetros de consulta sin valores vacíos. */
function parametros(valores: object): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(valores)) {
    if (valor !== null && valor !== undefined && valor !== '') params = params.set(clave, String(valor));
  }
  return params;
}

/** Gestión interna de la directiva: auditoría, inventario de bienes y plan anual de actividades. */
@Injectable({ providedIn: 'root' })
export class GestionService {
  private http = inject(HttpClient);
  private url = environment.apiUrl;

  getAuditoria(filtros: FiltrosAuditoria = {}): Observable<RespuestaApi<RegistroAuditoria[]>> {
    return this.http.get<RespuestaApi<RegistroAuditoria[]>>(`${this.url}/auditoria`, { params: parametros(filtros) });
  }

  getInventario(): Observable<RespuestaApi<BienInventario[]>> {
    return this.http.get<RespuestaApi<BienInventario[]>>(`${this.url}/inventario`);
  }

  registrarBien(bien: NuevoBien): Observable<RespuestaApi<unknown> & { bienId: number }> {
    return this.http.post<RespuestaApi<unknown> & { bienId: number }>(`${this.url}/inventario`, bien);
  }

  getPlanes(): Observable<RespuestaApi<PlanAnual[]>> {
    return this.http.get<RespuestaApi<PlanAnual[]>>(`${this.url}/planes`);
  }

  crearPlan(anio: number, descripcion?: string): Observable<RespuestaApi<unknown> & { planId: number }> {
    return this.http.post<RespuestaApi<unknown> & { planId: number }>(`${this.url}/planes`, { anio, descripcion });
  }

  agregarActividad(planId: number, actividad: NuevaActividad): Observable<RespuestaApi<unknown> & { actividadId: number }> {
    return this.http.post<RespuestaApi<unknown> & { actividadId: number }>(`${this.url}/planes/${planId}/actividades`, actividad);
  }
}
