import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AdminService } from '../../../../core/services/admin.service';
import { Turno, nombreDia } from './turno.model';

/** Turnos de riego desde la API, normalizados para la tabla y el calendario semanal. */
@Injectable({ providedIn: 'root' })
export class TurnosService {
  private admin = inject(AdminService);

  listar(): Observable<Turno[]> {
    return this.admin.getTurnos().pipe(
      map((res: any) =>
        (res?.data ?? []).map((t: any) => ({
          ...t,
          dia_semana: Number(t.dia_semana),
          dia: nombreDia(t.dia_semana),
          usuario: t.comunero_nombre || `${t.nombres || ''} ${t.apellidos || ''}`.trim(),
          lote: t.lote_codigo || 'N/A',
          sector: t.sector_nombre || 'N/A',
          horaInicio: String(t.hora_inicio || '').substring(0, 5),
          horaFin: String(t.hora_fin || '').substring(0, 5),
          tipo: t.tipo || 'REGULAR'
        }))
      )
    );
  }
}
