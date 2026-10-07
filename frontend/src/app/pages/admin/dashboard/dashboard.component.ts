import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { DashboardResumen } from '../../../core/models/api-payloads';
import { FechaLocalPipe } from '../../../shared/pipes/fecha-local.pipe';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';

/** Indicadores reales de /dashboard/resumen y accesos directos a las tareas frecuentes. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FechaLocalPipe, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  resumen: DashboardResumen | null = null;
  cargandoResumen = false;
  errorCarga = '';

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
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
}
