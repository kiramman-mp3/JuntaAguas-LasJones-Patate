import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/ui/page-header.component';
import { SectionNavComponent, SeccionNav } from '../../../../shared/ui/section-nav.component';

/**
 * Módulo de Comuneros y lotes. El padrón de personas y el catastro de terrenos son contextos
 * distintos, así que cada uno es una ruta hija con su propio componente y sus modales.
 */
@Component({
  selector: 'app-comuneros-admin',
  standalone: true,
  imports: [RouterOutlet, PageHeaderComponent, SectionNavComponent],
  template: `
    <section class="module">
      <app-page-header
        titulo="Comuneros y lotes"
        subtitulo="Registro de comuneros, sus cuentas de acceso y el catastro de terrenos de la Junta."
        icono="ri-team-line"
      />
      <app-section-nav [items]="secciones" etiqueta="Secciones de comuneros" />
      <router-outlet />
    </section>
  `
})
export class ComunerosAdminComponent {
  readonly secciones: SeccionNav[] = [
    { ruta: '/admin/comuneros/padron', etiqueta: 'Padrón', icono: 'ri-user-line' },
    { ruta: '/admin/comuneros/lotes', etiqueta: 'Catastro de lotes', icono: 'ri-map-pin-line' }
  ];
}
