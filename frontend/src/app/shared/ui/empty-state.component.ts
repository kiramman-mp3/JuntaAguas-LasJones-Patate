import { Component, input } from '@angular/core';

/**
 * Estado vacío: explica por qué no hay datos y, si se proyecta, ofrece la acción para empezar.
 * `tono="error"` lo usa para fallos de carga con un botón de reintento.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty-state" [class.empty-state--error]="tono() === 'error'" [attr.role]="tono() === 'error' ? 'alert' : null">
      <span class="empty-state__icon" aria-hidden="true"><i [class]="icono()"></i></span>
      <strong>{{ titulo() }}</strong>
      @if (mensaje()) {
        <p>{{ mensaje() }}</p>
      }
      <div class="empty-state__actions">
        <ng-content />
      </div>
    </div>
  `
})
export class EmptyStateComponent {
  readonly icono = input('ri-inbox-2-line');
  readonly titulo = input.required<string>();
  readonly mensaje = input<string>();
  readonly tono = input<'neutro' | 'error'>('neutro');
}
