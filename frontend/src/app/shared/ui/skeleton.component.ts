import { Component, computed, input } from '@angular/core';

/**
 * Esqueleto de carga con la misma silueta que el contenido final (filas o tarjetas),
 * para que la vista no salte cuando llegan los datos.
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    <div class="skeleton-group" [class.skeleton-group--cards]="variante() === 'tarjetas'" aria-hidden="true">
      @for (i of filasArr(); track i) {
        @if (variante() === 'tarjetas') {
          <div class="skeleton skeleton--card"></div>
        } @else {
          <div class="skeleton-row">
            <span class="skeleton skeleton--avatar"></span>
            <span class="skeleton skeleton--text" style="width: 38%"></span>
            <span class="skeleton skeleton--text" style="width: 22%"></span>
            <span class="skeleton skeleton--text" style="width: 14%"></span>
          </div>
        }
      }
    </div>
    <span class="sr-only" role="status">{{ mensaje() }}</span>
  `
})
export class SkeletonComponent {
  readonly filas = input(5);
  readonly variante = input<'filas' | 'tarjetas'>('filas');
  readonly mensaje = input('Cargando…');
  readonly filasArr = computed(() => Array.from({ length: this.filas() }, (_, i) => i));
}
