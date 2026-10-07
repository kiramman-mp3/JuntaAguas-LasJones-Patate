import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { WhatsAppSesionService } from '../../core/services/whatsapp-sesion.service';
import { WhatsAppPanelComponent } from '../../shared/whatsapp-panel/whatsapp-panel.component';

/**
 * Contenedor del panel administrativo: menú lateral (barra de pestañas inferior en móvil).
 * Cada sección es una ruta hija (/admin/dashboard, /admin/finanzas/cobrar…), así que
 * el menú se navega con teclado, el botón Atrás funciona y cada vista tiene su URL.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, WhatsAppPanelComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  readonly whatsapp = inject(WhatsAppSesionService);

  readonly menu = [
    { ruta: '/admin/dashboard', etiqueta: 'Dashboard', corta: 'Inicio', icono: 'ri-dashboard-line' },
    { ruta: '/admin/comuneros', etiqueta: 'Comuneros y lotes', corta: 'Comuneros', icono: 'ri-team-line' },
    { ruta: '/admin/asistencias', etiqueta: 'Asistencias', corta: 'Eventos', icono: 'ri-calendar-check-line' },
    { ruta: '/admin/turnos', etiqueta: 'Turnos de agua', corta: 'Turnos', icono: 'ri-drop-line' },
    { ruta: '/admin/finanzas', etiqueta: 'Finanzas', corta: 'Finanzas', icono: 'ri-money-dollar-circle-line' }
  ];
}
