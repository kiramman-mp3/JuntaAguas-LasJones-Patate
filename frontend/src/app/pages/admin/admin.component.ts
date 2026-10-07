import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Contenedor del panel administrativo: menú lateral y encabezado.
 * Cada sección es una ruta hija (/admin/dashboard, /admin/finanzas/cobrar…), así que
 * el menú se navega con teclado, el botón Atrás funciona y cada vista tiene su URL.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  readonly menu = [
    { ruta: '/admin/dashboard', etiqueta: 'Dashboard', icono: 'ri-dashboard-line' },
    { ruta: '/admin/comuneros', etiqueta: 'Comuneros & Lotes', icono: 'ri-group-line' },
    { ruta: '/admin/asistencias', etiqueta: 'Asistencias', icono: 'ri-calendar-check-line' },
    { ruta: '/admin/turnos', etiqueta: 'Turnos de Agua', icono: 'ri-drop-line' },
    { ruta: '/admin/finanzas', etiqueta: 'Finanzas', icono: 'ri-money-dollar-circle-line' }
  ];
}
