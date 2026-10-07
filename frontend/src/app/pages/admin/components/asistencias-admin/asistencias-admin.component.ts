import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/ui/page-header.component';
import { SectionNavComponent, SeccionNav } from '../../../../shared/ui/section-nav.component';

/**
 * Módulo de Asistencias. Asambleas y mingas son flujos de negocio distintos
 * (actas y multas vs. jornadas de trabajo), así que cada uno es una ruta hija con su propio componente.
 */
@Component({
  selector: 'app-asistencias-admin',
  standalone: true,
  imports: [RouterOutlet, PageHeaderComponent, SectionNavComponent],
  templateUrl: './asistencias-admin.component.html'
})
export class AsistenciasAdminComponent {
  readonly secciones: SeccionNav[] = [
    { ruta: '/admin/asistencias/asambleas', etiqueta: 'Asambleas', icono: 'ri-user-voice-line' },
    { ruta: '/admin/asistencias/mingas', etiqueta: 'Mingas', icono: 'ri-tools-line' }
  ];
}
