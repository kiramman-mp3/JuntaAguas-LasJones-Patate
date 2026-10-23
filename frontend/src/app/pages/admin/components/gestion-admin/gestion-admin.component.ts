import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/ui/page-header.component';
import { SectionNavComponent, SeccionNav } from '../../../../shared/ui/section-nav.component';

/** Gestión interna de la directiva: registro de auditoría, inventario de bienes y plan anual. */
@Component({
  selector: 'app-gestion-admin',
  standalone: true,
  imports: [RouterOutlet, PageHeaderComponent, SectionNavComponent],
  template: `
    <section class="module">
      <app-page-header
        titulo="Gestión interna"
        subtitulo="Revise quién hizo cada cambio, lleve el inventario de bienes y planifique las actividades del año."
        icono="ri-briefcase-4-line"
      />
      <app-section-nav [items]="secciones" etiqueta="Secciones de gestión interna" />
      <router-outlet />
    </section>
  `
})
export class GestionAdminComponent {
  readonly secciones: SeccionNav[] = [
    { ruta: '/admin/gestion/auditoria', etiqueta: 'Auditoría', icono: 'ri-shield-check-line' },
    { ruta: '/admin/gestion/inventario', etiqueta: 'Inventario', icono: 'ri-archive-line' },
    { ruta: '/admin/gestion/plan-anual', etiqueta: 'Plan anual', icono: 'ri-calendar-todo-line' }
  ];
}
