import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MingasAdminComponent } from '../mingas-admin/mingas-admin.component';
import { AsambleasAdminComponent } from '../asambleas-admin/asambleas-admin.component';

/** Vista de Asistencias: pestañas de asambleas y mingas. */
@Component({
  selector: 'app-asistencias-admin',
  standalone: true,
  imports: [CommonModule, MingasAdminComponent, AsambleasAdminComponent],
  templateUrl: './asistencias-admin.component.html'
})
export class AsistenciasAdminComponent {
  subTabEventos: 'ASAMBLEA' | 'MINGA' = 'ASAMBLEA';

  cambiarSubTabEventos(subTab: 'ASAMBLEA' | 'MINGA') {
    this.subTabEventos = subTab;
  }
}
