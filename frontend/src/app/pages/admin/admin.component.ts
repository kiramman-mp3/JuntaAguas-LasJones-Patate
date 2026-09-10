import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';

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
  titulo: string;
  fecha: string;
  asistentes: number;
  totalComuneros: number;
  multaAbsencia: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  tabActiva: 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS' | 'ACTAS' = 'USUARIOS';
  subTabEventos: 'ASAMBLEA' | 'MINGA' = 'ASAMBLEA';
  subTabFinanzas: 'INGRESOS' | 'EGRESOS' = 'INGRESOS';
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

  // Mocks de Usuarios por defecto inicializados en vacío
  usuarios: UsuarioAdmin[] = [];

  // Mocks de Eventos / Asistencias inicializados en vacío
  eventos: EventoAdmin[] = [];

  // Turnos de agua
  turnos: any[] = [];
  modalTurnoVisible: boolean = false;
  nuevoTurno = {
    persona_id: null as number | null,
    dia_semana: 1,
    hora_inicio: '08:00',
    hora_fin: '10:00',
    tipo: 'REGULAR',
    observacion: ''
  };

  constructor(private adminService: AdminService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.cargarDatosBackend();
  }

  cargarDatosBackend() {
    // Cargar balance financiero en tiempo real desde la API
    this.adminService.getBalance().subscribe({
      next: (res) => {
        if (res && res.balance) {
          this.kpis.recaudadoMes = Number(res.balance.totalIngresos) || this.kpis.recaudadoMes;
          this.kpis.egresosMes = Number(res.balance.totalEgresos) || this.kpis.egresosMes;
          this.kpis.pendientesCobro = Number(res.balance.totalPendientes) || this.kpis.pendientesCobro;
          this.kpis.balanceAlDia = Number(res.balance.balanceAlDia) || this.kpis.balanceAlDia;
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });

    // Cargar comuneros desde la API
    this.adminService.getPersonas().subscribe({
      next: (res) => {
        if (res && res.data && res.data.length > 0) {
            this.usuarios = res.data.map((p: any) => ({
              id: p.id,
              cedula: p.cedula,
              nombres: `${p.nombres} ${p.apellidos}`,
              sector: p.direccion || 'Sector Las Jones',
              loteCodigo: p.loteCodigo || 'Sin Lote',
              loteId: p.loteId || null,
              superficie: Number(p.superficie) || 0,
              latitud: Number(p.latitud) || -1.33241, // Fallback si no tiene coordenadas
              longitud: Number(p.longitud) || -78.51421,
              radioError: Number(p.radioError) || 20,
              estado: p.estado
            }));
            this.cdr.detectChanges();
        }
      },
      error: () => {}
    });

    // Cargar eventos desde la API
    this.adminService.getEventos().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.eventos = res.data.map((e: any) => ({
            id: e.id,
            tipo: e.tipo,
            titulo: e.titulo,
            fecha: new Date(e.fecha).toLocaleDateString(),
            asistentes: Number(e.asistentes) || 0,
            totalComuneros: Number(e.totalComuneros) || 0,
            multaAbsencia: Number(e.valor_multa)
          }));
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });

    // Cargar turnos desde la API
    this.adminService.getTurnos().subscribe({
      next: (res) => {
        if (res && res.data) {
          const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
          this.turnos = res.data.map((t: any) => ({
            lote: t.lote_codigo || 'N/A',
            usuario: t.comunero_nombre,
            dia: diasSemana[t.dia_semana] || 'Desconocido',
            horaInicio: t.hora_inicio,
            horaFin: t.hora_fin,
            sector: t.sector_nombre || 'N/A',
            observacion: t.observacion || 'Ninguna'
          }));
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  cambiarTab(tab: 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS' | 'ACTAS') {
    this.tabActiva = tab;
  }

  cambiarSubTabEventos(subTab: 'ASAMBLEA' | 'MINGA') {
    this.subTabEventos = subTab;
  }

  cambiarSubTabFinanzas(subTab: 'INGRESOS' | 'EGRESOS') {
    this.subTabFinanzas = subTab;
  }

  get eventosFiltrados() {
    return this.eventos.filter(e => e.tipo === this.subTabEventos);
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

  // Lógica Asistencia
  abrirModalAsistencia(evento: EventoAdmin) {
    this.eventoSeleccionado = evento;
    this.usuariosAsistencia = this.usuarios.map(u => ({
      id: u.id,
      nombres: u.nombres,
      cedula: u.cedula,
      presente: false
    }));
    this.modalAsistenciaVisible = true;
  }

  cerrarModalAsistencia() {
    this.modalAsistenciaVisible = false;
    this.eventoSeleccionado = null;
  }

  marcarTodosAsistencia() {
    this.usuariosAsistencia.forEach(u => u.presente = true);
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
        alert(`Asistencia guardada con éxito en el backend. Presentes: ${payload.filter(p => p.estado === 'PRESENTE').length}`);
        this.cerrarModalAsistencia();
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert('Hubo un error al guardar las asistencias.');
        console.error(err);
      }
    });
  }

  // Lógica Turnos
  abrirModalTurno() {
    this.nuevoTurno = { persona_id: null, dia_semana: 1, hora_inicio: '08:00', hora_fin: '10:00', tipo: 'REGULAR', observacion: '' };
    this.modalTurnoVisible = true;
  }

  cerrarModalTurno() {
    this.modalTurnoVisible = false;
  }

  guardarTurno() {
    if (!this.nuevoTurno.persona_id) {
      alert('Debe seleccionar un comunero.');
      return;
    }
    
    const comunero = this.usuarios.find(u => Number(u.id) === Number(this.nuevoTurno.persona_id));
    if (!comunero || !comunero.loteId) {
      alert('El comunero seleccionado no tiene un lote asociado.');
      return;
    }

    const payload = {
      ...this.nuevoTurno,
      lote_id: comunero.loteId
    };

    this.adminService.asignarTurno(payload).subscribe({
      next: () => {
        alert('Turno de agua asignado con éxito.');
        this.cerrarModalTurno();
        // Recargar turnos
        this.adminService.getTurnos().subscribe(res => {
          if (res && res.data) {
            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            this.turnos = res.data.map((t: any) => ({
              lote: t.lote_codigo || 'N/A',
              usuario: t.comunero_nombre,
              dia: diasSemana[t.dia_semana] || 'Desconocido',
              horaInicio: t.hora_inicio,
              horaFin: t.hora_fin,
              sector: t.sector_nombre || 'N/A'
            }));
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        alert(err.error?.message || 'Error al asignar el turno.');
      }
    });
  }

  // Lógica Finanzas
  comuneroBusqueda: string = '';
  obligacionesComunero: any[] = [];
  obligacionSeleccionada: any = null;

  buscarObligaciones() {
    if (!this.comuneroBusqueda) {
      this.obligacionesComunero = [];
      return;
    }
    const term = this.comuneroBusqueda.toLowerCase();
    const comunero = this.usuarios.find(u => u.cedula === term || u.nombres.toLowerCase().includes(term));
    if (comunero) {
      this.adminService.getObligaciones(comunero.id).subscribe({
        next: (res) => {
          this.obligacionesComunero = res.data.filter((o: any) => o.estado === 'PENDIENTE');
          if (this.obligacionesComunero.length > 0) {
            this.obligacionSeleccionada = this.obligacionesComunero[0]; // Selecciona la primera por defecto
          }
          this.cdr.detectChanges();
        },
        error: () => alert('Error al buscar obligaciones.')
      });
    } else {
      alert('Comunero no encontrado.');
      this.obligacionesComunero = [];
      this.cdr.detectChanges();
    }
  }

  cobrarObligacion() {
    if (!this.obligacionSeleccionada) return;
    
    // Regla de Negocio: Se cobra la totalidad del valor. No se permiten abonos.
    const payload = {
      persona_id: this.obligacionSeleccionada.persona_id,
      metodo: 'EFECTIVO',
      obligacionesIds: [this.obligacionSeleccionada.id],
      observaciones: 'Pago completo procesado desde panel administrativo.'
    };

    this.adminService.registrarPago(payload).subscribe({
      next: () => {
        alert('Pago registrado exitosamente.');
        this.cargarDatosBackend(); // Recargar balance
        this.buscarObligaciones(); // Recargar lista del usuario
      },
      error: (err) => alert(err.error?.message || 'Error al procesar pago.')
    });
  }
}
