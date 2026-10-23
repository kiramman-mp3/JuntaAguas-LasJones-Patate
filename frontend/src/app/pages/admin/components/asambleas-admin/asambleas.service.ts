import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AdminService } from '../../../../core/services/admin.service';
import { ConsultaService } from '../../../../core/services/consulta.service';
import { diaEnEcuador } from '../../../../core/utils/fechas';
import { EventoItem } from '../../../../core/models/api-payloads';
import { AsambleaItem, AsistentePadron, PuntoAsamblea } from './asamblea.model';

const LUGAR_POR_DEFECTO = 'Casa Comunal Junta La Jones';

/** Puntos con los que arranca el acta de una asamblea que aún no tiene ninguno guardado. */
const PUNTOS_INICIALES: PuntoAsamblea[] = [
  {
    orden: 1,
    punto_tratar: '1. Constatación del cuórum reglamentario',
    tratado: 'Se procede con el llamado a lista.',
    resolucion: 'Se declara formalmente instalada la asamblea.',
  },
  {
    orden: 2,
    punto_tratar: '2. Lectura y aprobación del acta anterior',
    tratado: 'Se da lectura al acta previa.',
    resolucion: 'Aprobada por unanimidad sin objeciones.',
  },
];

/**
 * Acceso a datos del dominio de asambleas: traduce las respuestas de la API
 * al modelo que usan las vistas (fechas, horas, subtipo y valores numéricos normalizados).
 */
@Injectable({ providedIn: 'root' })
export class AsambleasService {
  private admin = inject(AdminService);
  private consulta = inject(ConsultaService);

  listar(): Observable<AsambleaItem[]> {
    return this.admin
      .getEventos('ASAMBLEA')
      .pipe(map((res) => (res?.data ?? []).map((e) => this.aAsamblea(e))));
  }

  padron(asambleaId: number): Observable<AsistentePadron[]> {
    return this.admin.getAsistencias(asambleaId).pipe(
      map((res) =>
        (Array.isArray(res?.data) ? res.data : []).map((p): AsistentePadron => ({
          persona_id: Number(p.persona_id),
          cedula: p.cedula,
          nombre: p.nombre,
          estado: p.estado || 'PENDIENTE',
          motivo_justificacion: p.motivo_justificacion || '',
        })),
      ),
    );
  }

  /** Puntos del orden del día con su desarrollo en el acta general; si no hay ninguno, propone los puntos iniciales. */
  puntos(asambleaId: number): Observable<PuntoAsamblea[]> {
    return this.consulta.getEventoDetalle(asambleaId).pipe(
      map((res) => {
        const puntos = res?.puntos ?? [];
        if (!puntos.length) return PUNTOS_INICIALES.map((p) => ({ ...p }));
        return puntos.map((p) => ({
          id: p.id,
          evento_id: p.evento_id,
          orden: p.orden,
          punto_tratar: p.punto_tratar || '',
          tratado: p.tratado || '',
          resolucion: p.resolucion || '',
        }));
      }),
    );
  }

  private aAsamblea(e: EventoItem): AsambleaItem {
    const extraordinaria = e.subtipo_asamblea
      ? e.subtipo_asamblea === 'EXTRAORDINARIA'
      : e.titulo?.toUpperCase().includes('EXTRAORDINARIA');
    const subtipo: AsambleaItem['subtipo_asamblea'] = extraordinaria
      ? 'EXTRAORDINARIA'
      : 'ORDINARIA';
    return {
      id: e.id,
      tipo: 'ASAMBLEA',
      subtipo_asamblea: subtipo,
      titulo: e.titulo,
      descripcion: e.descripcion || '',
      fecha: e.fecha ? diaEnEcuador(e.fecha) : '',
      hora_inicio: e.hora_inicio ? e.hora_inicio.substring(0, 5) : '18:00',
      hora_fin: e.hora_fin ? e.hora_fin.substring(0, 5) : '',
      lugar: e.lugar || LUGAR_POR_DEFECTO,
      estado: e.estado || 'BORRADOR',
      genera_multa_ausencia: e.genera_multa_ausencia !== false && e.genera_multa_ausencia !== 0,
      valor_multa: Number(e.valor_multa) || 0,
      asistentes: Number(e.asistentes) || 0,
      totalUsuarios: Number(e.totalUsuarios) || 0,
      convocatoria_firmada_url: e.convocatoria_firmada_url || undefined,
      convocatoria_firmada_nombre: e.convocatoria_firmada_nombre || undefined,
      acta_firmada_url: e.acta_firmada_url || undefined,
      acta_firmada_nombre: e.acta_firmada_nombre || undefined,
      lista_asistencia_url: e.lista_asistencia_url || undefined,
      lista_asistencia_firmada_url: e.lista_asistencia_firmada_url || undefined,
    };
  }
}
