import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { DashboardResumen } from '../../core/models/api-payloads';
import { FechaLocalPipe } from '../../shared/pipes/fecha-local.pipe';
import { ComunerosAdminComponent } from './components/comuneros-admin/comuneros-admin.component';
import { FinanzasComponent, SeccionFinanzas } from './components/finanzas/finanzas.component';

import { TurnosAdminComponent } from './components/turnos-admin/turnos-admin.component';
import { AsistenciasAdminComponent } from './components/asistencias-admin/asistencias-admin.component';

type TabAdmin = 'DASHBOARD' | 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, FechaLocalPipe, ComunerosAdminComponent, FinanzasComponent, TurnosAdminComponent, AsistenciasAdminComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  tabActiva: TabAdmin = 'DASHBOARD';

  /** Sección con la que se abre Finanzas y si debe abrir el formulario de egreso (atajos del dashboard). */
  finanzasSeccion: SeccionFinanzas = 'COBRAR';
  finanzasNuevoEgreso = false;

  @ViewChild(ComunerosAdminComponent) comunerosAdmin!: ComunerosAdminComponent;
  @ViewChild(AsistenciasAdminComponent) asistenciasAdmin!: AsistenciasAdminComponent;

  resumen: DashboardResumen | null = null;
  cargandoResumen = false;
  errorCarga: string = '';

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarDatosBackend();
  }

  cargarDashboard() {
    // Para recargar en caso de emit
    this.cargarDatosBackend();
  }

  cargarDatosBackend() {
    this.errorCarga = '';
    this.cargandoResumen = true;
    this.adminService.getDashboardResumen().subscribe({
      next: (res) => {
        this.resumen = res.data;
        this.cargandoResumen = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoResumen = false;
        this.errorCarga = 'No se pudieron cargar los indicadores. Verifique su conexión e intente de nuevo.';
        this.cdr.detectChanges();
      }
    });
  }

  cambiarTab(tab: TabAdmin) {
    if (tab === 'FINANZAS' && this.tabActiva !== 'FINANZAS') this.abrirFinanzas('COBRAR');
    this.tabActiva = tab;
  }

  private abrirFinanzas(seccion: SeccionFinanzas, nuevoEgreso = false) {
    this.finanzasSeccion = seccion;
    this.finanzasNuevoEgreso = nuevoEgreso;
    this.tabActiva = 'FINANZAS';
  }

  prepararNuevoCobroDashboard() {
    this.abrirFinanzas('COBRAR');
  }

  abrirModalNuevoUsuarioDashboard() {
    this.cambiarTab('USUARIOS');
    setTimeout(() => { if (this.comunerosAdmin) this.comunerosAdmin.abrirModalNuevoUsuario(); }, 50);
  }

  abrirModalEgresoDashboard() {
    this.abrirFinanzas('EGRESOS', true);
  }

  abrirModalWhatsApp() {
    this.cambiarTab('ASISTENCIAS');
    setTimeout(() => { if (this.asistenciasAdmin) this.asistenciasAdmin.abrirModalWhatsApp(); }, 50);
  }
}
