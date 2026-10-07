import { Injectable, inject, signal } from '@angular/core';
import { AdminService } from './admin.service';
import { DialogService } from './dialog.service';
import { EstadoWhatsApp } from '../models/api-payloads';

/**
 * Sesión de WhatsApp Web que envía las convocatorias. Centraliza el estado y el sondeo
 * del código QR para que cualquier vista del panel pueda abrir el mismo panel de conexión.
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppSesionService {
  private admin = inject(AdminService);
  private dialog = inject(DialogService);

  readonly visible = signal(false);
  readonly estado = signal<EstadoWhatsApp | null>(null);
  readonly cargando = signal(false);

  private sondeo: ReturnType<typeof setInterval> | null = null;

  abrir(): void {
    this.visible.set(true);
    this.consultar();
    this.detenerSondeo();
    this.sondeo = setInterval(() => this.consultar(true), 1500);
  }

  cerrar(): void {
    this.visible.set(false);
    this.detenerSondeo();
  }

  consultar(silencioso = false): void {
    if (!silencioso && !this.estado()) this.cargando.set(true);
    this.admin.getWhatsAppStatus().subscribe({
      next: (res) => {
        this.estado.set(res.data);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }

  reiniciar(): void {
    this.cargando.set(true);
    this.admin.initWhatsApp().subscribe({
      next: (res) => {
        this.estado.set(res.data);
        this.consultar();
      },
      error: () => this.cargando.set(false)
    });
  }

  async cerrarSesion(): Promise<void> {
    const confirmado = await this.dialog.confirmar({
      tipo: 'DANGER',
      titulo: 'Cerrar sesión de WhatsApp',
      mensaje: '¿Está seguro de cerrar la sesión de WhatsApp?',
      textoConfirmar: 'Cerrar sesión'
    });
    if (!confirmado) return;
    this.cargando.set(true);
    this.admin.logoutWhatsApp().subscribe({
      next: () => this.consultar(),
      error: () => this.cargando.set(false)
    });
  }

  private detenerSondeo(): void {
    if (this.sondeo) {
      clearInterval(this.sondeo);
      this.sondeo = null;
    }
  }
}
