import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AdminService } from '../../../../core/services/admin.service';
import { ConsultaService } from '../../../../core/services/consulta.service';
import { aFecha, aFechaIso } from '../../../../core/utils/fechas';
import { AsambleaItem, AsistentePadron, PuntoAsamblea } from './asamblea.model';

const LUGAR_POR_DEFECTO = 'Casa Comunal Junta La Jones';

/** Puntos con los que arranca el acta de una asamblea que aún no tiene ninguno guardado. */
const PUNTOS_INICIALES: PuntoAsamblea[] = [
  { orden: 1, punto_tratar: '1. Constatación del cuórum reglamentario', tratado: 'Se procede con el llamado a lista.', resolucion: 'Se declara formalmente instalada la asamblea.', titulo_acta: 'Acta de Cuórum e Instalación', estado_acta: 'APROBADA' },
  { orden: 2, punto_tratar: '2. Lectura y aprobación del acta anterior', tratado: 'Se da lectura al acta previa.', resolucion: 'Aprobada por unanimidad sin objeciones.', titulo_acta: 'Acta de Aprobación de Sesión Anterior', estado_acta: 'APROBADA' }
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
    return this.admin.getEventos('ASAMBLEA').pipe(map((res) => (res?.data ?? []).map((e) => this.aAsamblea(e))));
  }

  padron(asambleaId: number): Observable<AsistentePadron[]> {
    return this.admin.getAsistencias(asambleaId).pipe(
      map((res: any) =>
        (Array.isArray(res?.data) ? res.data : []).map((p: any) => ({
          persona_id: Number(p.persona_id),
          cedula: p.cedula,
          nombre: p.nombre,
          sector: p.sector,
          estado: p.estado || 'PENDIENTE',
          motivo_justificacion: p.motivo_justificacion || ''
        }))
      )
    );
  }

  /** Puntos del orden del día con su acta; si no hay ninguno, propone los puntos iniciales. */
  puntos(asambleaId: number): Observable<PuntoAsamblea[]> {
    return this.consulta.getEventoDetalle(asambleaId).pipe(
      map((res: any) => {
        const puntos: any[] = res?.puntos ?? [];
        if (!puntos.length) return PUNTOS_INICIALES.map((p) => ({ ...p }));
        return puntos.map((p) => ({
          id: p.id,
          evento_id: p.evento_id,
          orden: p.orden,
          punto_tratar: p.punto_tratar || '',
          tratado: p.tratado || '',
          resolucion: p.resolucion || '',
          titulo_acta: p.titulo_acta || p.punto_tratar || '',
          estado_acta: p.estado_acta || (p.resolucion ? 'APROBADA' : 'BORRADOR'),
          acta_firmada_url: p.acta_firmada_url || undefined,
          acta_firmada_nombre: p.acta_firmada_nombre || undefined,
          responsables: p.responsables || '',
          fecha_acta: p.fecha_acta || undefined
        }));
      })
    );
  }

  private aAsamblea(e: any): AsambleaItem {
    const subtipo = e.subtipo_asamblea || (e.titulo?.toUpperCase().includes('EXTRAORDINARIA') ? 'EXTRAORDINARIA' : 'ORDINARIA');
    return {
      id: e.id,
      tipo: 'ASAMBLEA',
      subtipo_asamblea: subtipo,
      titulo: e.titulo,
      descripcion: e.descripcion || '',
      fecha: e.fecha ? (typeof e.fecha === 'string' ? e.fecha.split('T')[0] : aFechaIso(aFecha(e.fecha) ?? new Date())) : '',
      hora_inicio: e.hora_inicio ? e.hora_inicio.substring(0, 5) : '18:00',
      hora_fin: e.hora_fin ? e.hora_fin.substring(0, 5) : '',
      lugar: e.lugar || LUGAR_POR_DEFECTO,
      estado: e.estado || 'BORRADOR',
      genera_multa_ausencia: e.genera_multa_ausencia !== false && e.genera_multa_ausencia !== 0,
      valor_multa: Number(e.valor_multa) || 0,
      asistentes: Number(e.asistentes) || 0,
      totalComuneros: Number(e.totalComuneros) || 0,
      convocatoria_firmada_url: e.convocatoria_firmada_url || undefined,
      convocatoria_firmada_nombre: e.convocatoria_firmada_nombre || undefined,
      acta_firmada_url: e.acta_firmada_url || undefined,
      acta_firmada_nombre: e.acta_firmada_nombre || undefined,
      lista_asistencia_url: e.lista_asistencia_url || undefined,
      lista_asistencia_firmada_url: e.lista_asistencia_firmada_url || undefined
    };
  }
}
