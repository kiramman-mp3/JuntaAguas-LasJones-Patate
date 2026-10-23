import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AdminService } from '../../../../core/services/admin.service';
import { TurnoItem } from '../../../../core/models/api-payloads';
import { Turno, nombreDia } from './turno.model';

/** Turnos de riego desde la API, normalizados para la tabla y el calendario semanal. */
@Injectable({ providedIn: 'root' })
export class TurnosService {
  private admin = inject(AdminService);

  listar(sector_id?: number): Observable<Turno[]> {
    return this.admin.getTurnos(undefined, sector_id).pipe(
      map((res) =>
        (res?.data ?? []).map((t: TurnoItem): Turno => ({
          ...t,
          sector_id: t.sector_id,
          dia_semana: Number(t.dia_semana),
          dia: nombreDia(t.dia_semana),
          usuario: t.usuario_nombre || `${t.nombres || ''} ${t.apellidos || ''}`.trim(),
          cedula: t.cedula,
          lote: t.lote_codigo || 'N/A',
          sector: t.sector_nombre || 'N/A',
          superficie_m2: t.superficie_m2 ?? undefined,
          horaInicio: String(t.hora_inicio || '').substring(0, 5),
          horaFin: String(t.hora_fin || '').substring(0, 5),
        })),
      ),
    );
  }
}
