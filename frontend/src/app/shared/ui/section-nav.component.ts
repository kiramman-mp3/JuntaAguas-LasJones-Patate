import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';

export interface SeccionNav {
  /** Ruta absoluta de la sección (/admin/comuneros/padron). */
  ruta: string;
  etiqueta: string;
  icono: string;
}

/**
 * Navegación secundaria de un módulo: un control segmentado cuyas opciones son rutas hijas.
 * El indicador se desliza con transform (no reacomoda la página) y cada sección tiene su URL,
 * así el botón Atrás y los enlaces directos funcionan.
 */
@Component({
  selector: 'app-section-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="section-nav" [attr.aria-label]="etiqueta()">
      <div
        class="segmented"
        [class.segmented--inactivo]="indiceActivo() < 0"
        [style.--n]="items().length"
        [style.--i]="indiceActivo() < 0 ? 0 : indiceActivo()"
      >
        <span class="segmented__thumb" aria-hidden="true"></span>
        @for (s of items(); track s.ruta) {
          <a
            class="segmented__item"
            [routerLink]="s.ruta"
            routerLinkActive="segmented__item--active"
            ariaCurrentWhenActive="page"
          >
            <i [class]="s.icono" aria-hidden="true"></i>
            <span class="segmented__label">{{ s.etiqueta }}</span>
          </a>
        }
      </div>
    </nav>
  `
})
export class SectionNavComponent {
  private router = inject(Router);

  readonly items = input.required<SeccionNav[]>();
  readonly etiqueta = input('Secciones');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly indiceActivo = computed(() => {
    this.url();
    return this.items().findIndex((s) =>
      this.router.isActive(this.router.createUrlTree([s.ruta]), {
        paths: 'subset',
        queryParams: 'ignored',
        fragment: 'ignored',
        matrixParams: 'ignored'
      })
    );
  });
}
