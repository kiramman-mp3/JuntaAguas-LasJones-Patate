import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { DashboardResumen } from '../../core/models/api-payloads';
import { FechaLocalPipe } from '../../shared/pipes/fecha-local.pipe';
import { ComunerosAdminComponent } from './components/comuneros-admin/comuneros-admin.component';
import { FinanzasAdminComponent } from './components/finanzas-admin/finanzas-admin.component';
import { Gestioncontratacion } from './components/gestioncontratacion/gestioncontratacion';
import { Cobros } from './components/cobros/cobros';

import { TurnosAdminComponent } from './components/turnos-admin/turnos-admin.component';
import { AsistenciasAdminComponent } from './components/asistencias-admin/asistencias-admin.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, FechaLocalPipe, ComunerosAdminComponent, FinanzasAdminComponent, TurnosAdminComponent, AsistenciasAdminComponent,Cobros, Gestioncontratacion ],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  tabActiva: 'DASHBOARD' | 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS' | 'COBROS' | 'ACTAS' |'GESTIONCONTRATACION'= 'DASHBOARD';
  

  @ViewChild(FinanzasAdminComponent) finanzasAdminComponent!: FinanzasAdminComponent;
  @ViewChild(ComunerosAdminComponent) comunerosAdmin!: ComunerosAdminComponent;
  @ViewChild(AsistenciasAdminComponent) asistenciasAdmin!: AsistenciasAdminComponent;
  @ViewChild(Cobros) cobros!: Cobros;
  @ViewChild(Gestioncontratacion) gestioncontratacion!: Gestioncontratacion;



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

  cambiarTab(tab: 'DASHBOARD' | 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS' | 'COBROS' | 'ACTAS'|'GESTIONCONTRATACION') {
    this.tabActiva = tab;
  }

  prepararNuevoCobroDashboard() {
    this.cambiarTab('COBROS');
    setTimeout(() => { if (this.finanzasAdminComponent) this.finanzasAdminComponent.prepararNuevoCobro(); }, 50);
  }

  abrirModalNuevoUsuarioDashboard() {
    this.cambiarTab('USUARIOS');
    setTimeout(() => { if (this.comunerosAdmin) this.comunerosAdmin.abrirModalNuevoUsuario(); }, 50);
  }

  abrirModalEgresoDashboard() {
    this.cambiarTab('FINANZAS');
    setTimeout(() => { if (this.finanzasAdminComponent) this.finanzasAdminComponent.abrirModalEgreso(); }, 50);
  }

  abrirModalWhatsApp() {
    this.cambiarTab('ASISTENCIAS');
    setTimeout(() => { if (this.asistenciasAdmin) this.asistenciasAdmin.abrirModalWhatsApp(); }, 50);
  }
}
