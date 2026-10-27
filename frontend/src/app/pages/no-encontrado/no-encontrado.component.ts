import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurvasNivelComponent } from '../../shared/ui/curvas-nivel.component';

@Component({
  selector: 'app-no-encontrado',
  standalone: true,
  imports: [RouterLink, CurvasNivelComponent],
  template: `
    <section class="portal">
      <div class="portal-cabecera not-found">
        <app-curvas-nivel />
        <p class="not-found__codigo">Error 404</p>
        <h1 class="portal-cabecera__titulo">Página no encontrada</h1>
        <p class="portal-cabecera__lead">
          La dirección que intenta abrir no existe o fue movida. Puede volver al inicio o revisar
          las convocatorias vigentes.
        </p>
        <div class="not-found__acciones">
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
        min-height: calc(100vh - 360px);
        padding-top: clamp(3rem, 9vw, 7rem);
      }
      .not-found__codigo {
        margin: 0 0 1rem;
        font-family: var(--font-display);
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--color-primary);
      }
      .not-found__acciones {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 2rem;
      }
    `,
  ],
})
export class NoEncontradoComponent {}
