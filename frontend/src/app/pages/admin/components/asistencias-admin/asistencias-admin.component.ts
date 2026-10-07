import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../core/services/admin.service';
import { ViewChild } from '@angular/core';
import { ActasService } from '../../../../core/services/actas.service';
import { ConsultaService } from '../../../../core/services/consulta.service';
import * as L from 'leaflet';
import { cargarJsPdf } from '../../../../core/utils/jspdf';
import { MingasAdminComponent } from '../mingas-admin/mingas-admin.component';
import { AsambleasAdminComponent } from '../asambleas-admin/asambleas-admin.component';
import { ModalA11yDirective } from '../../../../core/directives/modal-a11y.directive';
import { NotificationService } from '../../../../core/services/notification.service';
import { DialogService } from '../../../../core/services/dialog.service';


// Para solucionar problema de iconos de Leaflet en Angular
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
const iconDefault = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

interface UsuarioAdmin {
  id: number;
  cedula: string;
  nombres: string;
  sector: string;
  loteCodigo: string;
  loteId: number | null;
  superficie: number;
  latitud: number;
  longitud: number;
  radioError: number;
  estado: 'ACTIVO' | 'INACTIVO';
}

interface EventoAdmin {
  id: number;
  tipo: 'ASAMBLEA' | 'MINGA';
  subtipo_asamblea?: string;
  titulo: string;
  fecha: string;
  hora_inicio?: string;
  lugar?: string;
  estado?: string;
  asistentes: number;
  totalComuneros: number;
  multaAbsencia: number;
  convocatoria_firmada_url?: string;
  convocatoria_firmada_nombre?: string;
  acta_firmada_url?: string;
  acta_firmada_nombre?: string;
  lista_asistencia_url?: string;
  lista_asistencia_firmada_url?: string;
}
import { aFecha, aFechaIso, esSoloFecha, hoyEnEcuador } from '../../../../core/utils/fechas';

@Component({
  selector: 'app-asistencias-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, MingasAdminComponent, AsambleasAdminComponent, ModalA11yDirective],
  templateUrl: './asistencias-admin.component.html',
  styleUrls: ['../../admin.component.scss']
})
export class AsistenciasAdminComponent implements OnInit {
  usuariosTotalRegistros: string | number = '150+';
  totalLotes: string | number = '180+';
  tabActiva: 'DASHBOARD' | 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS' | 'ACTAS' = 'DASHBOARD';
  subTabEventos: 'ASAMBLEA' | 'MINGA' = 'ASAMBLEA';
  subTabFinanzas: 'INGRESOS' | 'HISTORIAL' | 'EGRESOS' = 'INGRESOS';
  modalMapaVisible: boolean = false;
  loteSeleccionadoMapa: UsuarioAdmin | null = null;

  // Asistencia
  modalAsistenciaVisible: boolean = false;
  eventoSeleccionado: EventoAdmin | null = null;
  usuariosAsistencia: any[] = [];
  filtroAsistencia: string = '';

  // KPIs Financieros
  kpis = {
    recaudadoMes: 0,
    pendientesCobro: 0,
    egresosMes: 0,
    balanceAlDia: 0
  };
  resumenMensual: any[] = [];

  // Mocks de Eventos / Asistencias inicializados en vacío
  eventos: EventoAdmin[] = [];
  eventosBusqueda: string = '';
  // Mismo criterio que el filtro de fechas de Mingas (mingas-admin)
  eventosPeriodo: 'TODAS' | 'PROXIMAS' | 'ANTERIORES' = 'TODAS';
  eventosEstadoFiltro: string = '';
  modalEventoVisible: boolean = false;
  formEvento = {
    tipo: 'ASAMBLEA',
    subtipo_asamblea: 'ORDINARIA' as 'ORDINARIA' | 'EXTRAORDINARIA',
    titulo: '',
    descripcion: '',
    fecha: '',
    hora_inicio: '18:00',
    lugar: 'Casa Comunal Junta La Jones',
    puntos_orden_dia: [] as string[],
    genera_multa_ausencia: true,
    valor_multa: 10.00
  };


  constructor(
    private adminService: AdminService,
    private consultaService: ConsultaService,
    private actasService: ActasService,
    private cdr: ChangeDetectorRef,
    private notify: NotificationService,
    private dialog: DialogService
  ) { }

  cargarDashboard() { }

  ngOnInit() {
    this.cargarDatosBackend();
    this.cargarEventos();
  }


  cargarEventos() {
    this.adminService.getEventos().subscribe({
      next: (res: any) => {
        if (res && res.data) {
          this.eventos = res.data.map((e: any) => ({
            id: e.id,
            tipo: e.tipo,
            titulo: e.titulo,
            subtipo_asamblea: e.subtipo_asamblea || 'ORDINARIA',
            fecha: e.fecha ? (typeof e.fecha === 'string' ? e.fecha.split('T')[0] : aFechaIso(aFecha(e.fecha) ?? new Date())) : '',
            hora_inicio: e.hora_inicio,
            lugar: e.lugar,
            estado: e.estado,
            asistentes: Number(e.asistentes) || 0,
            totalComuneros: Number(e.totalComuneros) || 0,
            multaAbsencia: Number(e.valor_multa) || 0,
            convocatoria_firmada_url: e.convocatoria_firmada_url,
            convocatoria_firmada_nombre: e.convocatoria_firmada_nombre,
            acta_firmada_url: e.acta_firmada_url,
            acta_firmada_nombre: e.acta_firmada_nombre,
            lista_asistencia_url: e.lista_asistencia_url,
            lista_asistencia_firmada_url: e.lista_asistencia_firmada_url
          }));
          this.aplicarFiltroEventos();
          this.cdr.detectChanges();
        }
      },
      error: () => { }
    });
  }

  cargarDatosBackend() {
    // Cargar balance financiero en tiempo real desde la API
    this.adminService.getBalance().subscribe({
      next: (res: any) => {
        if (res && res.balance) {
          this.kpis.recaudadoMes = Number(res.balance.totalIngresos) || this.kpis.recaudadoMes;
          this.kpis.egresosMes = Number(res.balance.totalEgresos) || this.kpis.egresosMes;
          this.kpis.pendientesCobro = Number(res.balance.totalPendientes) || this.kpis.pendientesCobro;
          this.kpis.balanceAlDia = Number(res.balance.balanceAlDia) || this.kpis.balanceAlDia;
        }
        if (res && res.resumenMensual) {
          this.resumenMensual = res.resumenMensual;
        }
        this.cdr.detectChanges();
      },
      error: () => { }
    });

    // Cargar otros datos (eventos, turnos, etc.) que no están paginados



  }





  cambiarTab(tab: 'DASHBOARD' | 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS' | 'ACTAS') {
    this.tabActiva = tab;
    if (tab === 'DASHBOARD' || tab === 'FINANZAS') {
    }
  }

  // ============== EVENTOS ==============

  cambiarSubTabEventos(subTab: 'ASAMBLEA' | 'MINGA') {
    this.subTabEventos = subTab;
  }

  cambiarSubTabFinanzas(subTab: 'INGRESOS' | 'HISTORIAL' | 'EGRESOS') {
    this.subTabFinanzas = subTab;
    if (subTab === 'HISTORIAL') {
    }
  }

  get eventosFiltrados() {
    let filtrados = this.eventos.filter(e => e.tipo === this.subTabEventos);

    // Los eventos pasados se conservan para consultar el historial (I11, F02)
    if (this.eventosPeriodo !== 'TODAS') {
      const verAnteriores = this.eventosPeriodo === 'ANTERIORES';
      filtrados = filtrados.filter(e => this.esEventoPasado(e.fecha) === verAnteriores);
    }

    if (this.eventosBusqueda.trim()) {
      const termino = this.eventosBusqueda.toLowerCase();
      filtrados = filtrados.filter(e => e.titulo.toLowerCase().includes(termino));
    }

    return filtrados;
  }

  aplicarFiltroEventos() {
    // La reactividad angular actualiza eventosFiltrados automáticamente,
    // pero podemos forzar deteccián de cambios si es necesario.
    this.cdr.detectChanges();
  }

  /** Las fechas de cargarEventos llegan como AAAA-MM-DD: se comparan con el día de hoy en Ecuador. */
  esEventoPasado(fechaStr: string): boolean {
    const fecha = String(fechaStr ?? '').slice(0, 10);
    return esSoloFecha(fecha) && fecha < hoyEnEcuador();
  }

  verLoteEnMapa(u: UsuarioAdmin) {
    this.loteSeleccionadoMapa = u;
    this.modalMapaVisible = true;
  }

  cerrarModalMapa() {
    this.modalMapaVisible = false;
    this.loteSeleccionadoMapa = null;
  }

  abrirGoogleMaps(lat: number, lng: number) {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  }

  // Lágica Asistencia
  abrirModalAsistencia(evento: EventoAdmin) {
    this.eventoSeleccionado = evento;
    // Cargar TODOS los comuneros (limit alto) para la asistencia, no solo la página actual
    this.adminService.getPersonas(1, 9999, '', 'ACTIVO').subscribe({
      next: (res: any) => {
        if (res && res.data) {
          this.usuariosAsistencia = res.data.map((u: any) => ({
            id: u.id,
            nombres: `${u.apellidos} ${u.nombres}`,
            cedula: u.cedula,
            presente: false
          }));

          // Cargar asistencias previas guardadas en BD
          this.adminService.getAsistencias(evento.id).subscribe({
            next: (asistRes: any) => {
              if (asistRes && asistRes.data && asistRes.data.length > 0) {
                const presentes = new Set(
                  asistRes.data
                    .filter((a: any) => a.estado === 'PRESENTE')
                    .map((a: any) => a.persona_id)
                );
                this.usuariosAsistencia.forEach(u => {
                  if (presentes.has(u.id)) {
                    u.presente = true;
                  }
                });
              }
              this.modalAsistenciaVisible = true;
              this.cdr.detectChanges();
            },
            error: () => {
              // Si falla obtener asistencias previas, igual abrir el modal limpio
              this.modalAsistenciaVisible = true;
              this.cdr.detectChanges();
            }
          });
        }
      },
      error: () => this.notify.error('Error al cargar comuneros para asistencia.')
    });
  }

  // Lágica de Crear Evento
  abrirModalNuevoEvento() {
    this.formEvento = {
      tipo: this.subTabEventos, // Se adapta al tab actual (ASAMBLEA o MINGA)
      subtipo_asamblea: 'ORDINARIA',
      titulo: this.subTabEventos === 'ASAMBLEA' ? 'ASAMBLEA GENERAL DE USUARIOS' : 'MINGA COMUNITARIA',
      descripcion: '',
      fecha: hoyEnEcuador(),
      hora_inicio: '18:00',
      lugar: 'Casa Comunal Junta La Jones',
      puntos_orden_dia: [
        'Constatacián del cuárum',
        'Lectura del acta anterior',
        'Informe del Presidente y Tesorero',
        'Varios'
      ],
      genera_multa_ausencia: true,
      valor_multa: 10.00
    };
    this.modalEventoVisible = true;
  }

  cerrarModalEvento() {
    this.modalEventoVisible = false;
  }

  agregarPuntoOrdenDia() {
    if (!this.formEvento.puntos_orden_dia) {
      this.formEvento.puntos_orden_dia = [];
    }
    const len = this.formEvento.puntos_orden_dia.length;
    if (len > 0 && this.formEvento.puntos_orden_dia[len - 1].toLowerCase() === 'varios') {
      this.formEvento.puntos_orden_dia.splice(len - 1, 0, '');
    } else {
      this.formEvento.puntos_orden_dia.push('');
    }
  }

  eliminarPuntoOrdenDia(index: number) {
    if (this.formEvento.puntos_orden_dia && this.formEvento.puntos_orden_dia.length > 2) {
      this.formEvento.puntos_orden_dia.splice(index, 1);
    }
  }

  trackByIndex(index: number, item: any): any {
    return index;
  }

  // --- WHATSAPP WEB MANAGEMENT ---
  modalWhatsAppVisible: boolean = false;
  whatsAppStatus: { status: string; statusMessage: string; isReady: boolean; qrCodeDataUrl: string } | null = null;
  cargandoWhatsApp: boolean = false;
  whatsAppPollInterval: any = null;

  abrirModalWhatsApp() {
    this.modalWhatsAppVisible = true;
    this.consultarEstadoWhatsApp();
    this.iniciarPollingWhatsApp();
  }

  cerrarModalWhatsApp() {
    this.modalWhatsAppVisible = false;
    this.detenerPollingWhatsApp();
  }

  iniciarPollingWhatsApp() {
    this.detenerPollingWhatsApp();
    this.consultarEstadoWhatsApp(true);
    this.whatsAppPollInterval = setInterval(() => {
      if (this.modalWhatsAppVisible) {
        this.consultarEstadoWhatsApp(true);
      } else {
        this.detenerPollingWhatsApp();
      }
    }, 1500);
  }


  detenerPollingWhatsApp() {
    if (this.whatsAppPollInterval) {
      clearInterval(this.whatsAppPollInterval);
      this.whatsAppPollInterval = null;
    }
  }

  consultarEstadoWhatsApp(silencioso: boolean = false) {
    if (!silencioso && !this.whatsAppStatus) {
      this.cargandoWhatsApp = true;
    }
    this.adminService.getWhatsAppStatus().subscribe({
      next: (res: any) => {
        this.whatsAppStatus = res.data;
        this.cargandoWhatsApp = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoWhatsApp = false;
      }
    });
  }

  reiniciarWhatsApp() {
    this.cargandoWhatsApp = true;
    this.adminService.initWhatsApp().subscribe({
      next: (res: any) => {
        this.whatsAppStatus = res.data;
        this.cargandoWhatsApp = false;
        this.consultarEstadoWhatsApp();
      },
      error: () => {
        this.cargandoWhatsApp = false;
      }
    });
  }

  async cerrarSesionWhatsApp() {
    const confirmado = await this.dialog.confirmar({
      tipo: 'DANGER',
      titulo: 'Cerrar sesión de WhatsApp',
      mensaje: '¿Está seguro de cerrar la sesión de WhatsApp?',
      textoConfirmar: 'Cerrar sesión'
    });
    if (!confirmado) return;
    this.cargandoWhatsApp = true;
    this.adminService.logoutWhatsApp().subscribe({
      next: () => {
        this.consultarEstadoWhatsApp();
      },
      error: () => {
        this.cargandoWhatsApp = false;
      }
    });
  }


  guardarEvento() {
    const esMinga = this.formEvento.tipo === 'MINGA';

    if (!esMinga && Array.isArray(this.formEvento.puntos_orden_dia)) {
      this.formEvento.descripcion = this.formEvento.puntos_orden_dia
        .filter((p: string) => p && p.trim())
        .map((p: string, idx: number) => `${idx + 1}. ${p.trim()}`)
        .join('\n');
    }

    this.adminService.createEvento(this.formEvento).subscribe({
      next: (res: any) => {
        const eventoId = res.eventoId;
        this.cerrarModalEvento();


        if (esMinga) {
          // NO se genera PDF para Mingas. Se envía mensaje por whatsapp-web.js
          this.notify.info('Minga creada exitosamente. Enviando convocatoria por WhatsApp Web a los comuneros...');
          this.adminService.notificarMingaWhatsApp(eventoId).subscribe({
            next: (whRes: any) => {
              this.notify.success(whRes.message || 'Convocatoria a Minga enviada por WhatsApp exitosamente.');
            },
            error: (whErr: any) => {
              this.notify.warning(whErr.error?.message || 'Minga registrada. Nota: Vincule la sesión de WhatsApp Web mediante el botón "WhatsApp Web" en el panel para envíos automáticos.');
            }
          });
        } else {
          // Para Asamblea se sigue generando el PDF oficial de convocatoria
          this.notify.info('Asamblea creada exitosamente. Descargando Convocatoria Oficial en PDF...');
          this.generarConvocatoriaPdf(this.formEvento).catch(() =>
            this.notify.error('La asamblea se creó, pero no se pudo generar el PDF de la convocatoria.'));
        }
      },
      error: (err: any) => {
        this.notify.error(err.error?.message || 'Error al crear el evento');
      }
    });
  }

  async generarConvocatoriaPdf(evento: any) {
    const { jsPDF, autoTable } = await cargarJsPdf();
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Encabezado Oficial Centrado
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('JUNTA DE RIEGO LA JONES - PATATE', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(13);
    doc.text('CONVOCATORIA A ASAMBLEA GENERAL', pageWidth / 2, 28, { align: 'center' });

    const subtipo = (evento.subtipo_asamblea || 'ORDINARIA').toUpperCase();
    doc.setFontSize(11);
    doc.text(subtipo === 'ORDINARIA' ? 'ORDINARIA' : 'EXTRAORDINARIA', pageWidth / 2, 35, { align: 'center' });

    // Puntos del Orden del Día
    const puntos = Array.isArray(evento.puntos_orden_dia) && evento.puntos_orden_dia.length > 0
      ? evento.puntos_orden_dia.filter((p: string) => p && p.trim())
      : ['Constatacián del cuárum', 'Lectura del acta anterior', 'Varios'];

    // Construir tabla exacta al formato oficial
    const tableBody: any[] = [
      [
        { content: 'Estimados usuarios, reciban un cordial saludo.', colSpan: 2, styles: { fontStyle: 'normal', cellPadding: 3 } }
      ],
      [
        { content: 'Convocatoria', styles: { fontStyle: 'normal' } },
        { content: 'Por orden del señor Presidente de la Junta, se convoca a Asamblea General de usuarios con el siguiente detalle:' }
      ],
      [
        { content: 'Lugar', styles: { fontStyle: 'normal' } },
        { content: evento.lugar || 'Casa Comunal Junta La Jones' }
      ],
      [
        { content: 'Fecha', styles: { fontStyle: 'normal' } },
        { content: evento.fecha }
      ],
      [
        { content: 'Hora', styles: { fontStyle: 'normal' } },
        { content: evento.hora_inicio }
      ],
      [
        { content: 'ORDEN DEL DÍA', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [217, 238, 216], textColor: [0, 0, 0] } }
      ]
    ];

    puntos.forEach((p: string, idx: number) => {
      tableBody.push([
        { content: `${idx + 1}.`, styles: { fontStyle: 'normal', halign: 'left' } },
        { content: p.trim() }
      ]);
    });

    autoTable(doc, {
      startY: 42,
      head: [['DETALLE', 'INFORMACIÓN']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [217, 238, 216],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 125 }
      },
      styles: {
        fontSize: 10,
        textColor: [0, 0, 0],
        lineColor: [50, 50, 50],
        lineWidth: 0.2
      },
      margin: { left: 20, right: 20 }
    });

    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 25 : 200;

    // Firma al pie
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Atentamente,', pageWidth / 2, finalY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.text('SECRETARIO/A', pageWidth / 2, finalY + 25, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.text('Junta de Riego La Jones - Patate', pageWidth / 2, finalY + 32, { align: 'center' });

    doc.save(`Convocatoria_Asamblea_${subtipo}_${evento.fecha}.pdf`);
  }


  cerrarModalAsistencia() {
    this.modalAsistenciaVisible = false;
    this.eventoSeleccionado = null;
  }

  marcarTodosAsistencia(presente: boolean) {
    this.usuariosAsistencia.forEach(u => u.presente = presente);
  }

  get usuariosAsistenciaFiltrados() {
    if (!this.filtroAsistencia) return this.usuariosAsistencia;
    const term = this.filtroAsistencia.toLowerCase();
    return this.usuariosAsistencia.filter(u => u.nombres.toLowerCase().includes(term) || u.cedula.includes(term));
  }

  guardarAsistencia() {
    if (!this.eventoSeleccionado) return;

    const payload = this.usuariosAsistencia.map(u => ({
      persona_id: u.id,
      estado: u.presente ? 'PRESENTE' : 'AUSENTE',
      motivo_justificacion: null
    }));

    this.adminService.registrarAsistencias(this.eventoSeleccionado.id, payload).subscribe({
      next: () => {
        const presentes = payload.filter(p => p.estado === 'PRESENTE').length;
        this.notify.success(`Asistencia guardada exitosamente. Presentes: ${presentes} de ${payload.length}`);
        this.cerrarModalAsistencia();
        // Actualizar conteo en la lista
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.notify.error('Hubo un error al guardar las asistencias.');
        console.error(err);
      }
    });
  }

}
