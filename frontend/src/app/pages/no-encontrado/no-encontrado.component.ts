import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-no-encontrado',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="not-found">
      <div class="not-found__card card card--glass">
        <i class="ri-compass-3-line not-found__icon" aria-hidden="true"></i>
        <p class="not-found__code">404</p>
        <h1>Página no encontrada</h1>
        <p class="caption">
          La dirección que intenta abrir no existe o fue movida. Puede volver al inicio o revisar
          las convocatorias vigentes.
        </p>
        <div class="not-found__actions">
          <a routerLink="/" class="btn btn--primary"
            ><i class="ri-home-4-line" aria-hidden="true"></i> Ir al Inicio</a
          >
          <a routerLink="/eventos" class="btn btn--outline"
            ><i class="ri-calendar-event-line" aria-hidden="true"></i> Ver Eventos</a
          >
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .not-found {
        min-height: calc(100vh - 220px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 3rem 1.5rem;
      }
      .not-found__card {
        max-width: 520px;
        text-align: center;
        padding: 3rem 2rem;
      }
      .not-found__icon {
        font-size: 4rem;
        color: var(--color-primary);
      }
      .not-found__code {
        font-size: 3.5rem;
        font-weight: 800;
        color: var(--color-primary);
        margin: 0.5rem 0 0;
        line-height: 1;
      }
      .not-found__card h1 {
        margin: 0.5rem 0 0.75rem;
        font-size: 1.5rem;
      }
      .not-found__actions {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
        margin-top: 1.75rem;
      }
    `,
  ],
})
export class NoEncontradoComponent {}
