import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/ui/page-header.component';
import { SectionNavComponent, SeccionNav } from '../../../../shared/ui/section-nav.component';

/**
 * Gestión de usuarios y lotes. El padrón de personas y el catastro de terrenos son contextos
 * distintos, así que cada uno es una ruta hija con su propio componente y sus modales.
 */
@Component({
  selector: 'app-usuarios-admin',
  standalone: true,
  imports: [RouterOutlet, PageHeaderComponent, SectionNavComponent],
  template: `
    <section class="module">
      <app-page-header
        titulo="Gestión de Usuarios"
        subtitulo="Administre usuarios, sus cuentas de acceso y el catastro de terrenos de la Junta."
        icono="ri-team-line"
      />
      <app-section-nav [items]="secciones" etiqueta="Secciones de usuarios" />
      <router-outlet />
    </section>
  `,
})
export class UsuariosAdminComponent {
  readonly secciones: SeccionNav[] = [
    { ruta: '/admin/usuarios/padron', etiqueta: 'Padrón', icono: 'ri-user-line' },
    { ruta: '/admin/usuarios/lotes', etiqueta: 'Catastro de lotes', icono: 'ri-map-pin-line' },
  ];
}
