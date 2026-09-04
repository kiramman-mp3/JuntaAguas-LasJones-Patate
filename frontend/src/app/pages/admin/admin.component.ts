import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface UsuarioAdmin {
  id: number;
  cedula: string;
  nombres: string;
  sector: string;
  loteCodigo: string;
  superficie: number;
  latitud: number;
  longitud: number;
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
export class AdminComponent {
  tabActiva: 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS' | 'ACTAS' = 'USUARIOS';
  modalMapaVisible: boolean = false;
  loteSeleccionadoMapa: UsuarioAdmin | null = null;

  // KPIs Financieros
  kpis = {
    recaudadoMes: 1450.00,
    pendientesCobro: 680.00,
    egresosMes: 320.00,
    balanceAlDia: 1130.00
  };

  // Mocks de Usuarios
  usuarios: UsuarioAdmin[] = [
    { id: 1, cedula: '1801234567', nombres: 'Juan Carlos Morales Soria', sector: 'Sector Las Jones Alto', loteCodigo: 'LOT-JONES-A04', superficie: 2500, latitud: -1.33241, longitud: -78.51421, estado: 'ACTIVO' },
    { id: 2, cedula: '1809876543', nombres: 'María Elena Salazar Tamayo', sector: 'Sector Las Jones Centro', loteCodigo: 'LOT-JONES-C12', superficie: 1800, latitud: -1.33502, longitud: -78.51105, estado: 'ACTIVO' },
    { id: 3, cedula: '1803456789', nombres: 'Segundo Luis Chimbo Ortiz', sector: 'Sector Las Jones Alto', loteCodigo: 'LOT-JONES-A09', superficie: 3200, latitud: -1.33110, longitud: -78.51600, estado: 'ACTIVO' },
    { id: 4, cedula: '1805554433', nombres: 'Rosa Mercedes Vargas Paredes', sector: 'Sector Las Jones Bajo', loteCodigo: 'LOT-JONES-B02', superficie: 1450, latitud: -1.33920, longitud: -78.50890, estado: 'ACTIVO' }
  ];

  // Mocks de Eventos / Asistencias
  eventos: EventoAdmin[] = [
    { id: 1, tipo: 'ASAMBLEA', titulo: 'Asamblea General Trimestral #3', fecha: '2026-08-15', asistentes: 142, totalComuneros: 165, multaAbsencia: 10.00 },
    { id: 2, tipo: 'MINGA', titulo: 'Minga de Limpieza Canal Matriz A', fecha: '2026-08-22', asistentes: 130, totalComuneros: 165, multaAbsencia: 15.00 }
  ];

  // Turnos de agua
  turnos = [
    { lote: 'LOT-JONES-A04', usuario: 'Juan Morales', dia: 'Lunes', horaInicio: '08:00 AM', horaFin: '12:00 PM', sector: 'Sector Alto' },
    { lote: 'LOT-JONES-C12', usuario: 'María Salazar', dia: 'Lunes', horaInicio: '12:00 PM', horaFin: '04:00 PM', sector: 'Sector Centro' },
    { lote: 'LOT-JONES-A09', usuario: 'Segundo Chimbo', dia: 'Martes', horaInicio: '08:00 AM', horaFin: '12:00 PM', sector: 'Sector Alto' },
    { lote: 'LOT-JONES-B02', usuario: 'Rosa Vargas', dia: 'Miércoles', horaInicio: '09:00 AM', horaFin: '01:00 PM', sector: 'Sector Bajo' }
  ];

  cambiarTab(tab: 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS' | 'ACTAS') {
    this.tabActiva = tab;
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
}
