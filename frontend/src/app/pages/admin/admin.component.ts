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
  modalMapaVisible: boolean = false;
  loteSeleccionadoMapa: UsuarioAdmin | null = null;

  // KPIs Financieros
  kpis = {
    recaudadoMes: 1450.00,
    pendientesCobro: 680.00,
    egresosMes: 320.00,
    balanceAlDia: 1130.00
  };

  // Mocks de Usuarios por defecto
  usuarios: UsuarioAdmin[] = [
    { id: 1, cedula: '1801234567', nombres: 'Juan Carlos Morales Soria', sector: 'Sector Las Jones Alto', loteCodigo: 'LOT-JONES-A04', superficie: 2500, latitud: -1.33241, longitud: -78.51421, estado: 'ACTIVO' },
    { id: 2, cedula: '1802345678', nombres: 'Luis Fernando Salazar Guaman', sector: 'Sector Las Jones Centro', loteCodigo: 'LOT-JONES-C12', superficie: 1800, latitud: -1.33502, longitud: -78.51105, estado: 'ACTIVO' },
    { id: 3, cedula: '1804567890', nombres: 'Segundo Luis Chimbo Ortiz', sector: 'Sector Las Jones Alto', loteCodigo: 'LOT-JONES-A09', superficie: 3200, latitud: -1.33110, longitud: -78.51600, estado: 'ACTIVO' },
    { id: 4, cedula: '1805678901', nombres: 'Rosa Mercedes Vargas Paredes', sector: 'Sector Las Jones Bajo', loteCodigo: 'LOT-JONES-B02', superficie: 1450, latitud: -1.33920, longitud: -78.50890, estado: 'ACTIVO' }
  ];

  // Mocks de Eventos / Asistencias
  eventos: EventoAdmin[] = [
    { id: 1, tipo: 'ASAMBLEA', titulo: 'Asamblea General Trimestral #3', fecha: '2026-08-15', asistentes: 142, totalComuneros: 165, multaAbsencia: 10.00 },
    { id: 2, tipo: 'MINGA', titulo: 'Minga de Limpieza Canal Matriz A', fecha: '2026-08-22', asistentes: 130, totalComuneros: 165, multaAbsencia: 15.00 }
  ];

  // Turnos de agua
  turnos = [
    { lote: 'LOT-JONES-A04', usuario: 'Juan Morales', dia: 'Lunes', horaInicio: '08:00 AM', horaFin: '12:00 PM', sector: 'Sector Alto' },
    { lote: 'LOT-JONES-C12', usuario: 'Luis Salazar', dia: 'Lunes', horaInicio: '12:00 PM', horaFin: '04:00 PM', sector: 'Sector Centro' },
    { lote: 'LOT-JONES-A09', usuario: 'Segundo Chimbo', dia: 'Martes', horaInicio: '08:00 AM', horaFin: '12:00 PM', sector: 'Sector Alto' },
    { lote: 'LOT-JONES-B02', usuario: 'Rosa Vargas', dia: 'Miércoles', horaInicio: '09:00 AM', horaFin: '01:00 PM', sector: 'Sector Bajo' }
  ];

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
            estado: p.estado
          }));
        }
      },
      error: () => {}
    });
  }

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
