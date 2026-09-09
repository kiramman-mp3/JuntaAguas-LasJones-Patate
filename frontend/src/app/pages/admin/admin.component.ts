import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';

interface UsuarioAdmin {
  id: number;
  cedula: string;
  nombres: string;
  sector: string;
  loteCodigo: string;
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
  modalMapaVisible: boolean = false;
  loteSeleccionadoMapa: UsuarioAdmin | null = null;
  
  // Asistencia
  modalAsistenciaVisible: boolean = false;
  eventoSeleccionado: EventoAdmin | null = null;
  usuariosAsistencia: any[] = [];
  filtroAsistencia: string = '';

  // KPIs Financieros
  kpis = {
    recaudadoMes: 1450.00,
    pendientesCobro: 680.00,
    egresosMes: 320.00,
    balanceAlDia: 1130.00
  };

  // Mocks de Usuarios por defecto inicializados en vacío
  usuarios: UsuarioAdmin[] = [];

  // Mocks de Eventos / Asistencias inicializados en vacío
  eventos: EventoAdmin[] = [];

  // Turnos de agua inicializados en vacío
  turnos: any[] = [];

  constructor(private adminService: AdminService) {}

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
            loteCodigo: `LOT-JONES-${p.id}`,
            superficie: 2000,
            latitud: -1.33241,
            longitud: -78.51421,
            radioError: 20, // valor simulado si la BD no lo trae en esta query
            estado: p.estado
          }));
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
            asistentes: 0,
            totalComuneros: this.usuarios.length || 0,
            multaAbsencia: Number(e.valor_multa)
          }));
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
            sector: t.sector_nombre || 'N/A'
          }));
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
      },
      error: (err) => {
        alert('Hubo un error al guardar las asistencias.');
        console.error(err);
      }
    });
  }
}
