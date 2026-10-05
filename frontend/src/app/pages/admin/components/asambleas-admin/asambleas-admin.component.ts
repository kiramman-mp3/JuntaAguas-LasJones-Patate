import { Component, EventEmitter, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../core/services/admin.service';
import { ConsultaService } from '../../../../core/services/consulta.service';
import { ActasService } from '../../../../core/services/actas.service';
import { environment } from '../../../../../environments/environment';

export interface PuntoAsamblea {
  id?: number;
  evento_id?: number;
  orden: number;
  punto_tratar: string;
  tratado?: string;
  resolucion?: string;
  titulo_acta?: string;
  estado_acta?: 'BORRADOR' | 'APROBADA' | 'FIRMADA';
  acta_firmada_url?: string;
  acta_firmada_nombre?: string;
  responsables?: string;
  fecha_acta?: string;
}

export interface AsambleaItem {
  id: number;
  tipo: 'ASAMBLEA';
  subtipo_asamblea: 'ORDINARIA' | 'EXTRAORDINARIA';
  titulo: string;
  descripcion?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin?: string;
  lugar?: string;
  estado: 'BORRADOR' | 'PROGRAMADO' | 'CONVOCADO' | 'REALIZADO' | 'CANCELADO';
  genera_multa_ausencia: boolean;
  valor_multa: number;
  asistentes: number;
  totalComuneros: number;
  convocatoria_firmada_url?: string;
  convocatoria_firmada_nombre?: string;
  acta_firmada_url?: string;
  acta_firmada_nombre?: string;
  lista_asistencia_url?: string;
  lista_asistencia_firmada_url?: string;
  puntos?: PuntoAsamblea[];
}

@Component({
  selector: 'app-asambleas-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asambleas-admin.component.html',
  styleUrls: ['./asambleas-admin.component.scss']
})
export class AsambleasAdminComponent implements OnInit {
  @Output() conectarWhatsApp = new EventEmitter<void>();

  asambleas: AsambleaItem[] = [];
  busqueda: string = '';
  subtipoFiltro: 'TODAS' | 'ORDINARIA' | 'EXTRAORDINARIA' = 'TODAS';
  periodo: 'TODAS' | 'PROXIMAS' | 'ANTERIORES' = 'TODAS';

  cargando: boolean = false;
  mensaje: string = '';
  error: string = '';

  enviandoId: number | null = null;
  actualizandoId: number | null = null;
  descargandoId: number | null = null;
  subiendoId: number | null = null;

  // Modales
  modalNueva: boolean = false;
  modalAsistencia: boolean = false;
  modalActas: boolean = false;
  modalValidacionDoc: boolean = false;

  asambleaSeleccionada: AsambleaItem | null = null;

  // Formulario Nueva Asamblea
  formulario = {
    subtipo_asamblea: 'ORDINARIA' as 'ORDINARIA' | 'EXTRAORDINARIA',
    titulo: '',
    descripcion: '',
    fecha: '',
    hora_inicio: '18:00',
    hora_fin: '21:00',
    lugar: 'Casa Comunal Junta La Jones',
    genera_multa_ausencia: true,
    valor_multa: 10.00,
    puntos_orden_dia: [
      '1. Constatación del cuórum reglamentario',
      '2. Lectura y aprobación del acta de la asamblea anterior',
      '3. Informe de presidencia y tesorería',
      '4. Asuntos varios y resoluciones'
    ] as string[]
  };

  // Asistencia Masiva
  personasAsistencia: any[] = [];
  filtroAsistencia: string = '';
  estadoFiltroAsistencia: 'TODOS' | 'PENDIENTE' | 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO' = 'TODOS';
  resumenAsistencia = { total: 0, presentes: 0, ausentes: 0, justificados: 0, pendientes: 0 };
  guardandoAsistencia: boolean = false;

  // Múltiples Actas (F07)
  puntosAsamblea: PuntoAsamblea[] = [];
  cargandoPuntos: boolean = false;
  guardandoPuntos: boolean = false;
  puntoActaSeleccionado: PuntoAsamblea | null = null;
  mostrarNuevoTema: boolean = false;
  nuevoTema = {
    punto_tratar: '',
    tratado: '',
    resolucion: '',
    responsables: ''
  };

  // Visor y Validación de Documentos Firmados
  docParaValidar: {
    tipo: 'CONVOCATORIA' | 'ASISTENCIA' | 'ACTA';
    titulo: string;
    url: string;
    nombre: string;
    validado: boolean;
  } | null = null;

  // Diálogo y Alertas Amigables (Reemplazo moderno de alert y confirm)
  dialogo = {
    visible: false,
    tipo: 'INFO' as 'INFO' | 'WARNING' | 'DANGER' | 'CONFIRM',
    titulo: '',
    mensaje: '',
    textoConfirmar: 'Entendido',
    textoCancelar: 'Cancelar',
    esConfirmacion: false,
    onConfirmar: () => {}
  };

  mostrarMensaje(titulo: string, mensaje: string, tipo: 'INFO' | 'WARNING' | 'DANGER' = 'INFO'): void {
    this.dialogo = {
      visible: true,
      tipo,
      titulo,
      mensaje,
      textoConfirmar: 'Entendido',
      textoCancelar: '',
      esConfirmacion: false,
      onConfirmar: () => {
        this.dialogo.visible = false;
        this.cdr.detectChanges();
      }
    };
    this.cdr.detectChanges();
  }

  mostrarConfirmacion(
    titulo: string,
    mensaje: string,
    accion: () => void,
    textoConfirmar = 'Confirmar',
    tipo: 'CONFIRM' | 'DANGER' = 'CONFIRM'
  ): void {
    this.dialogo = {
      visible: true,
      tipo,
      titulo,
      mensaje,
      textoConfirmar,
      textoCancelar: 'Cancelar',
      esConfirmacion: true,
      onConfirmar: () => {
        this.dialogo.visible = false;
        this.cdr.detectChanges();
        accion();
      }
    };
    this.cdr.detectChanges();
  }

  cerrarDialogo(): void {
    this.dialogo.visible = false;
    this.cdr.detectChanges();
  }

  constructor(
    private adminService: AdminService,
    private consultaService: ConsultaService,
    private actasService: ActasService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.adminService.getEventos('ASAMBLEA').subscribe({
      next: (res: any) => {
        this.cargando = false;
        const lista = res && res.data ? res.data : [];
        this.asambleas = lista.map((e: any) => {
          const subtipo: 'ORDINARIA' | 'EXTRAORDINARIA' =
            (e.subtipo_asamblea || (e.titulo && e.titulo.toUpperCase().includes('EXTRAORDINARIA') ? 'EXTRAORDINARIA' : 'ORDINARIA'));
          return {
            id: e.id,
            tipo: 'ASAMBLEA',
            subtipo_asamblea: subtipo,
            titulo: e.titulo,
            descripcion: e.descripcion || '',
            fecha: e.fecha ? (typeof e.fecha === 'string' ? e.fecha.split('T')[0] : new Date(e.fecha).toISOString().split('T')[0]) : '',
            hora_inicio: e.hora_inicio ? e.hora_inicio.substring(0, 5) : '18:00',
            hora_fin: e.hora_fin ? e.hora_fin.substring(0, 5) : '',
            lugar: e.lugar || 'Casa Comunal Junta La Jones',
            estado: e.estado || 'BORRADOR',
            genera_multa_ausencia: e.genera_multa_ausencia !== false && e.genera_multa_ausencia !== 0,
            valor_multa: Number(e.valor_multa) || 0,
            asistentes: Number(e.asistentes) || 0,
            totalComuneros: Number(e.totalComuneros) || 0,
            convocatoria_firmada_url: e.convocatoria_firmada_url || null,
            convocatoria_firmada_nombre: e.convocatoria_firmada_nombre || null,
            acta_firmada_url: e.acta_firmada_url || null,
            acta_firmada_nombre: e.acta_firmada_nombre || null,
            lista_asistencia_url: e.lista_asistencia_url || null,
            lista_asistencia_firmada_url: e.lista_asistencia_firmada_url || null
          };
        });
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.error = 'No se pudo cargar la lista de asambleas. Intente nuevamente.';
        this.cdr.detectChanges();
      }
    });
  }

  get asambleasFiltradas(): AsambleaItem[] {
    const hoy = new Date().toISOString().split('T')[0];
    return this.asambleas.filter(a => {
      // Filtro Subtipo
      if (this.subtipoFiltro !== 'TODAS' && a.subtipo_asamblea !== this.subtipoFiltro) {
        return false;
      }
      // Filtro Fecha
      if (this.periodo === 'PROXIMAS' && a.fecha < hoy) return false;
      if (this.periodo === 'ANTERIORES' && a.fecha >= hoy) return false;
      // Filtro Búsqueda
      if (this.busqueda.trim()) {
        const q = this.busqueda.toLowerCase().trim();
        const coincide =
          a.titulo.toLowerCase().includes(q) ||
          (a.lugar && a.lugar.toLowerCase().includes(q)) ||
          (a.descripcion && a.descripcion.toLowerCase().includes(q));
        if (!coincide) return false;
      }
      return true;
    });
  }

  estadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'BORRADOR': return 'badge--neutral';
      case 'PROGRAMADO': return 'badge--info';
      case 'CONVOCADO': return 'badge--warning';
      case 'REALIZADO': return 'badge--success';
      case 'CANCELADO': return 'badge--danger';
      default: return 'badge--info';
    }
  }

  estadoIcon(estado: string): string {
    switch (estado) {
      case 'BORRADOR': return 'ri-draft-line';
      case 'PROGRAMADO': return 'ri-calendar-line';
      case 'CONVOCADO': return 'ri-megaphone-line';
      case 'REALIZADO': return 'ri-checkbox-circle-line';
      case 'CANCELADO': return 'ri-close-circle-line';
      default: return 'ri-information-line';
    }
  }

  estadoTexto(estado: string): string {
    switch (estado) {
      case 'BORRADOR': return 'Borrador';
      case 'PROGRAMADO': return 'Programada';
      case 'CONVOCADO': return 'Convocada';
      case 'REALIZADO': return 'Realizada';
      case 'CANCELADO': return 'Cancelada';
      default: return estado;
    }
  }

  // ============== NUEVA ASAMBLEA ==============

  get fechaMinima(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  abrirNueva(): void {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const proximaSemana = `${year}-${month}-${day}`;

    this.formulario = {
      subtipo_asamblea: 'ORDINARIA',
      titulo: 'ASAMBLEA GENERAL ORDINARIA DE USUARIOS',
      descripcion: 'Tratamiento del informe de gestión, estado de cuentas y resoluciones de riego.',
      fecha: proximaSemana,
      hora_inicio: '18:00',
      hora_fin: '21:00',
      lugar: 'Casa Comunal Junta La Jones',
      genera_multa_ausencia: true,
      valor_multa: 10.00,
      puntos_orden_dia: [
        '1. Constatación del cuórum reglamentario',
        '2. Lectura y aprobación del acta de la asamblea anterior',
        '3. Informe de presidencia y balance financiero',
        '4. Asuntos varios y resoluciones'
      ]
    };
    this.modalNueva = true;
    this.cdr.detectChanges();
  }

  cerrarModalNueva(): void {
    this.modalNueva = false;
  }

  agregarPuntoOrdenDia(): void {
    const num = this.formulario.puntos_orden_dia.length + 1;
    this.formulario.puntos_orden_dia.push(`${num}. Nuevo punto del orden del día`);
    this.cdr.detectChanges();
    setTimeout(() => {
      const container = document.querySelector('.puntos-inputs-list');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  }

  eliminarPuntoOrdenDia(idx: number): void {
    if (this.formulario.puntos_orden_dia.length > 1) {
      this.formulario.puntos_orden_dia.splice(idx, 1);
      this.cdr.detectChanges();
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  guardarNueva(): void {
    if (!this.formulario.titulo.trim() || !this.formulario.fecha || !this.formulario.hora_inicio) {
      this.mostrarMensaje('Campos Incompletos', 'Por favor complete los campos obligatorios: Título o Asunto, Fecha de la sesión y Hora de inicio.', 'WARNING');
      return;
    }

    if (this.formulario.fecha < this.fechaMinima) {
      this.mostrarMensaje('Fecha No Válida', `La fecha de la asamblea (${this.formulario.fecha}) no puede ser anterior a la fecha actual (${this.fechaMinima}).`, 'WARNING');
      return;
    }

    const payload = {
      tipo: 'ASAMBLEA',
      subtipo_asamblea: this.formulario.subtipo_asamblea,
      titulo: this.formulario.titulo.trim(),
      descripcion: this.formulario.descripcion.trim(),
      fecha: this.formulario.fecha,
      hora_inicio: this.formulario.hora_inicio,
      hora_fin: this.formulario.hora_fin || null,
      lugar: this.formulario.lugar.trim(),
      genera_multa_ausencia: this.formulario.genera_multa_ausencia,
      valor_multa: this.formulario.genera_multa_ausencia ? Number(this.formulario.valor_multa) : 0,
      puntos_orden_dia: this.formulario.puntos_orden_dia.filter(p => p.trim().length > 0)
    };

    this.actualizandoId = -1;
    this.adminService.createEvento(payload).subscribe({
      next: () => {
        this.actualizandoId = null;
        this.modalNueva = false;
        this.mensaje = 'Asamblea creada exitosamente con sus puntos de orden del día.';
        this.cargar();
        setTimeout(() => this.mensaje = '', 4000);
      },
      error: (err: any) => {
        this.actualizandoId = null;
        this.mostrarMensaje('Error al Guardar', err?.error?.message || 'Error al registrar la asamblea.', 'DANGER');
      }
    });
  }

  // ============== GESTIÓN DE ESTADOS (C10) ==============

  cambiarEstado(asamblea: AsambleaItem, nuevoEstado: 'PROGRAMADO' | 'CONVOCADO' | 'CANCELADO'): void {
    if (nuevoEstado === 'CANCELADO') {
      this.mostrarConfirmacion(
        '¿Cancelar Asamblea?',
        `¿Está seguro de cancelar la asamblea "${asamblea.titulo}"?\n\nEsta asamblea quedará archivada como cancelada y no generará sanciones económicas a los comuneros.`,
        () => this.ejecutarCambioEstado(asamblea, nuevoEstado),
        'Sí, Cancelar Asamblea',
        'DANGER'
      );
      return;
    }
    this.ejecutarCambioEstado(asamblea, nuevoEstado);
  }

  private ejecutarCambioEstado(asamblea: AsambleaItem, nuevoEstado: 'PROGRAMADO' | 'CONVOCADO' | 'CANCELADO'): void {
    this.actualizandoId = asamblea.id;
    this.adminService.cambiarEstadoAsamblea(asamblea.id, nuevoEstado).subscribe({
      next: () => {
        this.actualizandoId = null;
        asamblea.estado = nuevoEstado;
        this.mensaje = `Estado actualizado a: ${this.estadoTexto(nuevoEstado)}.`;
        this.cdr.detectChanges();
        setTimeout(() => this.mensaje = '', 3500);
      },
      error: (err: any) => {
        this.actualizandoId = null;
        this.mostrarMensaje('Error de Estado', err?.error?.message || 'Error al actualizar el estado de la asamblea.', 'DANGER');
      }
    });
  }

  finalizarAsamblea(asamblea: AsambleaItem): void {
    if (asamblea.estado !== 'CONVOCADO') {
      this.mostrarMensaje('Acción No Permitida', 'Solo se puede finalizar una asamblea que haya sido CONVOCADA previamente.', 'WARNING');
      return;
    }

    if (asamblea.fecha > this.fechaMinima) {
      this.mostrarMensaje(
        'Fecha de Sesión No Alcanzada',
        `No se puede finalizar la asamblea "${asamblea.titulo}" porque su fecha programada (${asamblea.fecha}) aún no ha llegado.\n\nUna asamblea solo puede darse por realizada una vez que ha llegado la fecha de la sesión.\n\nSi la asamblea no se va a llevar a cabo o fue suspendida, use la opción "Cancelar".`,
        'WARNING'
      );
      return;
    }

    if (!asamblea.asistentes || asamblea.asistentes === 0) {
      this.mostrarMensaje(
        'Asistencia Requerida',
        `No se puede finalizar la asamblea sin haber registrado la asistencia de los comuneros (constan 0 asistentes).\n\nPor favor, haga clic en "Tomar Asistencia Digital" y guarde el pase de lista antes de finalizar la sesión.\n\nSi la asamblea no se realizó por falta de cuórum, use la opción "Cancelar".`,
        'WARNING'
      );
      return;
    }

    this.mostrarConfirmacion(
      'Confirmar Finalización de Asamblea',
      `¿Desea dar por REALIZADA la asamblea "${asamblea.titulo}"?\n\n• Se cerrará la asistencia definitiva con ${asamblea.asistentes} comuneros presentes.\n` +
      (asamblea.genera_multa_ausencia ? `• Se emitirán automáticamente las multas de $${asamblea.valor_multa.toFixed(2)} a los comuneros ausentes sin justificación.\n` : '') +
      `\nEsta acción registrará la asamblea como concluida de manera irreversible. ¿Desea proceder?`,
      () => this.ejecutarFinalizarAsamblea(asamblea),
      'Dar por Realizada',
      'CONFIRM'
    );
  }

  private ejecutarFinalizarAsamblea(asamblea: AsambleaItem): void {
    this.actualizandoId = asamblea.id;
    this.adminService.finalizarAsamblea(asamblea.id).subscribe({
      next: (res: any) => {
        this.actualizandoId = null;
        asamblea.estado = 'REALIZADO';
        const multas = res?.multasGeneradas || 0;
        this.mensaje = `Asamblea finalizada con éxito. Se generaron ${multas} multas automáticas.`;
        this.cdr.detectChanges();
        setTimeout(() => this.mensaje = '', 5000);
      },
      error: (err: any) => {
        this.actualizandoId = null;
        this.mostrarMensaje('Error al Finalizar', err?.error?.message || 'Error al finalizar la asamblea.', 'DANGER');
      }
    });
  }

  enviarConvocatoriaWhatsApp(asamblea: AsambleaItem): void {
    const fechaFmt = asamblea.fecha;
    const subtipo = asamblea.subtipo_asamblea || 'ORDINARIA';
    const msg = encodeURIComponent(
      `📢 *CONVOCATORIA OFICIAL - JUNTA DE RIEGO LA JONES*\n\n` +
      `Se convoca a todos los comuneros a la *ASAMBLEA GENERAL ${subtipo}*:\n` +
      `🗓 *Fecha:* ${fechaFmt}\n` +
      `🕐 *Hora:* ${asamblea.hora_inicio} hs\n` +
      `📍 *Lugar:* ${asamblea.lugar || 'Casa Comunal Junta La Jones'}\n` +
      (asamblea.genera_multa_ausencia ? `⚠️ *Multa por inasistencia:* $${asamblea.valor_multa.toFixed(2)}\n\n` : '\n') +
      `Agradecemos su puntual y comprometida asistencia.`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  // ============== FLUJOS DE DOCUMENTOS: CONVOCATORIA & ASISTENCIA ==============

  descargarConvocatoriaPdf(asamblea: AsambleaItem): void {
    this.actasService.generarConvocatoriaPDF(asamblea);
  }

  subirDocumentoFirmado(asamblea: AsambleaItem, tipo: 'CONVOCATORIA' | 'OTRO', input: HTMLInputElement): void {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    this.subiendoId = asamblea.id;

    reader.onload = () => {
      const base64 = reader.result as string;
      this.adminService.subirDocumentoFirmado(asamblea.id, tipo, file.name, base64).subscribe({
        next: (res: any) => {
          this.subiendoId = null;
          input.value = '';
          const serverUrl = res.url ? (res.url.startsWith('http') ? res.url : `${environment.serverUrl}${res.url}`) : null;
          if (tipo === 'CONVOCATORIA') {
            asamblea.convocatoria_firmada_url = serverUrl || res.url;
            asamblea.convocatoria_firmada_nombre = file.name;
          } else {
            asamblea.lista_asistencia_firmada_url = serverUrl || res.url;
          }
          this.mensaje = 'Documento firmado subido y registrado exitosamente.';
          this.cdr.detectChanges();
          setTimeout(() => this.mensaje = '', 4000);
        },
        error: (err: any) => {
          this.subiendoId = null;
          this.mostrarMensaje('Error de Carga', err?.error?.message || 'Error al subir el documento firmado.', 'DANGER');
        }
      });
    };
    reader.readAsDataURL(file);
  }

  descargarPadronAsistencia(asamblea: AsambleaItem): void {
    const url = `${environment.apiUrl}/eventos/${asamblea.id}/pdf-asistencia`;
    window.open(url, '_blank');
  }

  verDocumento(url?: string): void {
    if (!url) return;
    const full = url.startsWith('http') ? url : `${environment.serverUrl}${url}`;
    window.open(full, '_blank');
  }

  abrirValidacionDoc(tipo: 'CONVOCATORIA' | 'ASISTENCIA' | 'ACTA', asamblea: AsambleaItem): void {
    let url = '';
    let nombre = '';
    if (tipo === 'CONVOCATORIA') {
      url = asamblea.convocatoria_firmada_url || '';
      nombre = asamblea.convocatoria_firmada_nombre || 'Convocatoria_Firmada.pdf';
    } else if (tipo === 'ASISTENCIA') {
      url = asamblea.lista_asistencia_firmada_url || '';
      nombre = 'Lista_Asistencia_Firmada.pdf';
    } else {
      url = asamblea.acta_firmada_url || '';
      nombre = asamblea.acta_firmada_nombre || 'Acta_Firmada.pdf';
    }

    this.asambleaSeleccionada = asamblea;
    this.docParaValidar = {
      tipo,
      titulo: tipo === 'CONVOCATORIA' ? 'Convocatoria Oficial Firmada' : (tipo === 'ASISTENCIA' ? 'Lista de Asistencia Firmada' : 'Acta Resolutiva Firmada'),
      url: url.startsWith('http') ? url : `${environment.serverUrl}${url}`,
      nombre,
      validado: true
    };
    this.modalValidacionDoc = true;
  }

  cerrarValidacionDoc(): void {
    this.modalValidacionDoc = false;
    this.docParaValidar = null;
  }

  // ============== ASISTENCIA DIGITAL MASIVA ==============

  abrirAsistencia(asamblea: AsambleaItem): void {
    this.asambleaSeleccionada = asamblea;
    this.guardandoAsistencia = false;
    this.filtroAsistencia = '';
    this.estadoFiltroAsistencia = 'TODOS';
    this.personasAsistencia = [];

    // Cargar comuneros y cruzar con asistencias guardadas
    this.consultaService.getEventoDetalle(asamblea.id).subscribe({
      next: (resDetalle: any) => {
        const asistenciasPrevias = new Map<number, any>();
        if (resDetalle && resDetalle.evento && resDetalle.evento.asistencias) {
          resDetalle.evento.asistencias.forEach((a: any) => asistenciasPrevias.set(Number(a.persona_id), a));
        }

        this.adminService.getPersonas(1, 1000).subscribe({
          next: (resPersonas: any) => {
            const lista = (resPersonas && resPersonas.data) ? resPersonas.data : [];
            this.personasAsistencia = lista.map((p: any) => {
              const previa = asistenciasPrevias.get(Number(p.id));
              return {
                persona_id: p.id,
                cedula: p.cedula,
                nombre: `${p.apellidos || ''} ${p.nombres || ''}`.trim(),
                sector: p.sector || 'Patate',
                estado: previa ? previa.estado : 'PENDIENTE',
                motivo_justificacion: previa ? (previa.motivo_justificacion || '') : ''
              };
            });
            this.calcularResumenAsistencia();
            this.modalAsistencia = true;
            this.cdr.detectChanges();
          },
          error: () => {
            this.mostrarMensaje('Error de Consulta', 'Error al cargar la nómina de comuneros.', 'DANGER');
          }
        });
      },
      error: () => {
        this.mostrarMensaje('Error de Consulta', 'Error al consultar el detalle de la asamblea.', 'DANGER');
      }
    });
  }

  cerrarModalAsistencia(): void {
    this.modalAsistencia = false;
    this.asambleaSeleccionada = null;
  }

  calcularResumenAsistencia(): void {
    const res = { total: this.personasAsistencia.length, presentes: 0, ausentes: 0, justificados: 0, pendientes: 0 };
    for (const p of this.personasAsistencia) {
      if (p.estado === 'PRESENTE') res.presentes++;
      else if (p.estado === 'AUSENTE') res.ausentes++;
      else if (p.estado === 'JUSTIFICADO') res.justificados++;
      else res.pendientes++;
    }
    this.resumenAsistencia = res;
    if (this.asambleaSeleccionada) {
      this.asambleaSeleccionada.asistentes = res.presentes;
      this.asambleaSeleccionada.totalComuneros = res.total;
    }
  }

  marcarTodos(estado: 'PRESENTE' | 'AUSENTE'): void {
    for (const p of this.personasAsistencia) {
      p.estado = estado;
      p.motivo_justificacion = '';
    }
    this.calcularResumenAsistencia();
  }

  setEstadoPersona(p: any, estado: 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO'): void {
    p.estado = estado;
    if (estado !== 'JUSTIFICADO') {
      p.motivo_justificacion = '';
    }
    this.calcularResumenAsistencia();
  }

  get personasAsistenciaFiltradas(): any[] {
    return this.personasAsistencia.filter(p => {
      if (this.estadoFiltroAsistencia !== 'TODOS' && p.estado !== this.estadoFiltroAsistencia) {
        return false;
      }
      if (this.filtroAsistencia.trim()) {
        const q = this.filtroAsistencia.toLowerCase().trim();
        return p.nombre.toLowerCase().includes(q) || p.cedula.includes(q) || (p.sector && p.sector.toLowerCase().includes(q));
      }
      return true;
    });
  }

  guardarAsistencia(): void {
    if (!this.asambleaSeleccionada) return;

    // Validar que los justificados tengan motivo
    const sinMotivo = this.personasAsistencia.filter(p => p.estado === 'JUSTIFICADO' && !p.motivo_justificacion.trim());
    if (sinMotivo.length > 0) {
      this.mostrarMensaje(
        'Justificación Requerida',
        `Hay ${sinMotivo.length} comunero(s) marcados como JUSTIFICADOS sin motivo escrito. Ingrese el justificativo correspondiente antes de guardar.`,
        'WARNING'
      );
      return;
    }

    this.guardandoAsistencia = true;
    const payload = this.personasAsistencia.map(p => ({
      persona_id: p.persona_id,
      estado: p.estado,
      motivo_justificacion: p.estado === 'JUSTIFICADO' ? p.motivo_justificacion.trim() : null
    }));

    this.adminService.registrarAsistencias(this.asambleaSeleccionada.id, payload).subscribe({
      next: () => {
        this.guardandoAsistencia = false;
        this.modalAsistencia = false;
        this.mensaje = 'Asistencias registradas y sincronizadas exitosamente.';
        this.cargar();
        setTimeout(() => this.mensaje = '', 4000);
      },
      error: (err: any) => {
        this.guardandoAsistencia = false;
        this.mostrarMensaje('Error de Guardado', err?.error?.message || 'Error al guardar asistencias.', 'DANGER');
      }
    });
  }

  // ============== MÚLTIPLES ACTAS POR ASAMBLEA (F07) ==============

  abrirModalActas(asamblea: AsambleaItem): void {
    this.asambleaSeleccionada = asamblea;
    this.cargandoPuntos = true;
    this.mostrarNuevoTema = false;
    this.puntoActaSeleccionado = null;
    this.puntosAsamblea = [];

    this.consultaService.getEventoDetalle(asamblea.id).subscribe({
      next: (res: any) => {
        this.cargandoPuntos = false;
        const pts = res && res.puntos ? res.puntos : [];
        if (pts.length === 0) {
          // Si no tiene puntos guardados, inicializar con estructura estándar
          this.puntosAsamblea = [
            { orden: 1, punto_tratar: '1. Constatación del cuórum reglamentario', tratado: 'Se procede con el llamado a lista.', resolucion: 'Se declara formalmente instalada la asamblea.', titulo_acta: 'Acta de Cuórum e Instalación', estado_acta: 'APROBADA' },
            { orden: 2, punto_tratar: '2. Lectura y aprobación del acta anterior', tratado: 'Se da lectura al acta previa.', resolucion: 'Aprobada por unanimidad sin objeciones.', titulo_acta: 'Acta de Aprobación de Sesión Anterior', estado_acta: 'APROBADA' }
          ];
        } else {
          this.puntosAsamblea = pts.map((p: any) => ({
            id: p.id,
            evento_id: p.evento_id,
            orden: p.orden,
            punto_tratar: p.punto_tratar || '',
            tratado: p.tratado || '',
            resolucion: p.resolucion || '',
            titulo_acta: p.titulo_acta || p.punto_tratar || '',
            estado_acta: p.estado_acta || (p.resolucion ? 'APROBADA' : 'BORRADOR'),
            acta_firmada_url: p.acta_firmada_url ? (p.acta_firmada_url.startsWith('http') ? p.acta_firmada_url : `${environment.serverUrl}${p.acta_firmada_url}`) : undefined,
            acta_firmada_nombre: p.acta_firmada_nombre || undefined,
            responsables: p.responsables || '',
            fecha_acta: p.fecha_acta || undefined
          }));
        }
        this.modalActas = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoPuntos = false;
        this.mostrarMensaje('Error de Consulta', 'Error al cargar puntos y actas de la asamblea.', 'DANGER');
      }
    });
  }

  cerrarModalActas(): void {
    this.modalActas = false;
    this.asambleaSeleccionada = null;
    this.puntosAsamblea = [];
    this.puntoActaSeleccionado = null;
  }

  agregarTemaNuevo(): void {
    if (!this.nuevoTema.punto_tratar.trim()) {
      this.mostrarMensaje('Campo Requerido', 'Ingrese el asunto o título del nuevo tema a tratar.', 'WARNING');
      return;
    }
    const nuevoOrden = this.puntosAsamblea.length + 1;
    this.puntosAsamblea.push({
      orden: nuevoOrden,
      punto_tratar: `${nuevoOrden}. ${this.nuevoTema.punto_tratar.trim()}`,
      titulo_acta: `Acta del Punto ${nuevoOrden}: ${this.nuevoTema.punto_tratar.trim()}`,
      tratado: this.nuevoTema.tratado.trim(),
      resolucion: this.nuevoTema.resolucion.trim(),
      responsables: this.nuevoTema.responsables.trim(),
      estado_acta: this.nuevoTema.resolucion.trim() ? 'APROBADA' : 'BORRADOR'
    });
    this.nuevoTema = { punto_tratar: '', tratado: '', resolucion: '', responsables: '' };
    this.mostrarNuevoTema = false;
  }

  guardarTodosLosPuntos(): void {
    if (!this.asambleaSeleccionada) return;
    this.guardandoPuntos = true;

    this.adminService.guardarPuntosAsamblea(this.asambleaSeleccionada.id, this.puntosAsamblea).subscribe({
      next: (res: any) => {
        this.guardandoPuntos = false;
        this.mensaje = 'Todas las actas y puntos de la asamblea se guardaron correctamente.';
        if (res && res.data) {
          this.puntosAsamblea = res.data.map((p: any) => ({
            ...p,
            acta_firmada_url: p.acta_firmada_url ? (p.acta_firmada_url.startsWith('http') ? p.acta_firmada_url : `${environment.serverUrl}${p.acta_firmada_url}`) : undefined
          }));
        }
        this.cdr.detectChanges();
        setTimeout(() => this.mensaje = '', 4000);
      },
      error: (err: any) => {
        this.guardandoPuntos = false;
        this.mostrarMensaje('Error de Guardado', err?.error?.message || 'Error al guardar puntos de asamblea.', 'DANGER');
      }
    });
  }

  descargarActaPorPunto(punto: PuntoAsamblea): void {
    if (!this.asambleaSeleccionada) return;
    this.actasService.generarActaPuntoPDF(this.asambleaSeleccionada, punto);
  }

  descargarActaGeneral(): void {
    if (!this.asambleaSeleccionada) return;
    this.actasService.generarActaPDF(this.asambleaSeleccionada, this.puntosAsamblea);
  }

  subirActaPuntoFirmada(punto: PuntoAsamblea, input: HTMLInputElement): void {
    if (!input.files || input.files.length === 0 || !this.asambleaSeleccionada) return;
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result as string;
      this.adminService.subirDocumentoFirmado(this.asambleaSeleccionada!.id, 'ACTA', file.name, base64, punto.id).subscribe({
        next: (res: any) => {
          input.value = '';
          const serverUrl = res.url ? (res.url.startsWith('http') ? res.url : `${environment.serverUrl}${res.url}`) : null;
          punto.acta_firmada_url = serverUrl || res.url;
          punto.acta_firmada_nombre = file.name;
          punto.estado_acta = 'FIRMADA';
          this.mensaje = `Acta firmada del Punto ${punto.orden} subida y validada.`;
          this.cdr.detectChanges();
          setTimeout(() => this.mensaje = '', 4000);
        },
        error: (err: any) => {
          this.mostrarMensaje('Error al Subir Acta', err?.error?.message || 'Error al subir el acta firmada.', 'DANGER');
        }
      });
    };
    reader.readAsDataURL(file);
  }

  cambiarEstadoActaPunto(punto: PuntoAsamblea, nuevoEstado: 'BORRADOR' | 'APROBADA' | 'FIRMADA'): void {
    punto.estado_acta = nuevoEstado;
    if (punto.id && this.asambleaSeleccionada) {
      this.adminService.cambiarEstadoActaPunto(this.asambleaSeleccionada.id, punto.id, {
        estado_acta: nuevoEstado
      }).subscribe({
        next: () => {
          this.cdr.detectChanges();
        },
        error: () => {}
      });
    }
  }
}
