import { Component, input } from '@angular/core';

/**
 * Encabezado de un módulo del panel: título con tracking negativo, descripción breve
 * y las acciones principales a la derecha (proyectadas con <ng-content>).
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="page-header">
      <div class="page-header__text">
        @if (icono()) {
          <span class="page-header__icon" aria-hidden="true"><i [class]="icono()"></i></span>
        }
        <div>
          <h2 class="page-header__title">{{ titulo() }}</h2>
          @if (subtitulo()) {
            <p class="page-header__subtitle">{{ subtitulo() }}</p>
          }
        </div>
      </div>
      <div class="page-header__actions">
        <ng-content />
      </div>
    </header>
  `
})
export class PageHeaderComponent {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>();
  readonly icono = input<string>();
}
