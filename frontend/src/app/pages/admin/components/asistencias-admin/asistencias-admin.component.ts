import { Component, OnDestroy, ChangeDetectorRef, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../../core/services/admin.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { ModalA11yDirective } from '../../../../core/directives/modal-a11y.directive';
import { MingasAdminComponent } from '../mingas-admin/mingas-admin.component';
import { AsambleasAdminComponent } from '../asambleas-admin/asambleas-admin.component';

interface EstadoWhatsApp {
  status: string;
  statusMessage: string;
  isReady: boolean;
  qrCodeDataUrl: string;
}

/**
 * Vista de Asistencias: pestañas de asambleas y mingas, y el panel para vincular
 * la sesión de WhatsApp Web que envía las convocatorias.
 */
@Component({
  selector: 'app-asistencias-admin',
  standalone: true,
  imports: [CommonModule, MingasAdminComponent, AsambleasAdminComponent, ModalA11yDirective],
  templateUrl: './asistencias-admin.component.html'
})
export class AsistenciasAdminComponent implements OnDestroy {
  private adminService = inject(AdminService);
  private dialog = inject(DialogService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** ?whatsapp=1 abre el panel de WhatsApp Web (botón del encabezado del panel). */
  @Input() set whatsapp(valor: string | undefined) {
    if (valor) this.abrirModalWhatsApp();
  }

  subTabEventos: 'ASAMBLEA' | 'MINGA' = 'ASAMBLEA';

  modalWhatsAppVisible = false;
  whatsAppStatus: EstadoWhatsApp | null = null;
  cargandoWhatsApp = false;
  private whatsAppPollInterval: ReturnType<typeof setInterval> | null = null;

  cambiarSubTabEventos(subTab: 'ASAMBLEA' | 'MINGA') {
    this.subTabEventos = subTab;
  }

  abrirModalWhatsApp() {
    this.modalWhatsAppVisible = true;
    this.consultarEstadoWhatsApp();
    this.iniciarPollingWhatsApp();
  }

  cerrarModalWhatsApp() {
    this.modalWhatsAppVisible = false;
    this.detenerPollingWhatsApp();
    // Quita ?whatsapp=1 para que el botón del encabezado pueda volver a abrirlo.
    if (this.route.snapshot.queryParamMap.has('whatsapp')) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { whatsapp: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  ngOnDestroy() {
    this.detenerPollingWhatsApp();
  }

  private iniciarPollingWhatsApp() {
    this.detenerPollingWhatsApp();
    this.whatsAppPollInterval = setInterval(() => {
      if (this.modalWhatsAppVisible) {
        this.consultarEstadoWhatsApp(true);
      } else {
        this.detenerPollingWhatsApp();
      }
    }, 1500);
  }

  private detenerPollingWhatsApp() {
    if (this.whatsAppPollInterval) {
      clearInterval(this.whatsAppPollInterval);
      this.whatsAppPollInterval = null;
    }
  }

  consultarEstadoWhatsApp(silencioso = false) {
    if (!silencioso && !this.whatsAppStatus) {
      this.cargandoWhatsApp = true;
    }
    this.adminService.getWhatsAppStatus().subscribe({
      next: (res: { data: EstadoWhatsApp }) => {
        this.whatsAppStatus = res.data;
        this.cargandoWhatsApp = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoWhatsApp = false;
        this.cdr.detectChanges();
      }
    });
  }

  reiniciarWhatsApp() {
    this.cargandoWhatsApp = true;
    this.adminService.initWhatsApp().subscribe({
      next: (res: { data: EstadoWhatsApp }) => {
        this.whatsAppStatus = res.data;
        this.cargandoWhatsApp = false;
        this.consultarEstadoWhatsApp();
      },
      error: () => {
        this.cargandoWhatsApp = false;
        this.cdr.detectChanges();
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
      next: () => this.consultarEstadoWhatsApp(),
      error: () => {
        this.cargandoWhatsApp = false;
        this.cdr.detectChanges();
      }
    });
  }
}
