import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Noticia, NoticiasService } from '../../core/services/noticias.service';
import { FechaLocalPipe } from '../../shared/pipes/fecha-local.pipe';

/** Tarjeta de una noticia: imagen, etiquetas, fecha, título y descripción corta. */
@Component({
  selector: 'app-noticia-tarjeta',
  standalone: true,
  imports: [RouterLink, FechaLocalPipe],
  template: `
    <article class="card noticia-card" [class.noticia-card--destacada]="destacada()">
      <a class="noticia-card__imagen" [routerLink]="['/noticias', noticia().id]" tabindex="-1">
        <img
          [src]="urlImagen()"
          [alt]="'Imagen de la noticia: ' + noticia().titulo"
          loading="lazy"
          width="960"
          height="540"
        />
      </a>
      <div class="noticia-card__cuerpo">
        <div class="noticia-card__meta">
          <time [attr.datetime]="noticia().publicada_en">{{
            noticia().publicada_en | fechaLocal: 'larga'
          }}</time>
        </div>
        @if (noticia().tags.length) {
          <ul class="noticia-card__tags" aria-label="Etiquetas">
            @for (tag of noticia().tags; track tag) {
              <li>
                <a
                  class="badge badge--info"
                  routerLink="/noticias/todas"
                  [queryParams]="{ tag: tag }"
                  >{{ tag }}</a
                >
              </li>
            }
          </ul>
        }
        <h3 class="noticia-card__titulo">
          <a [routerLink]="['/noticias', noticia().id]">{{ noticia().titulo }}</a>
        </h3>
        <p class="noticia-card__resumen">{{ noticia().descripcion_corta }}</p>
        <a class="noticia-card__mas" [routerLink]="['/noticias', noticia().id]">
          Leer noticia <i class="ri-arrow-right-line" aria-hidden="true"></i>
        </a>
      </div>
    </article>
  `,
  styleUrl: './noticias.scss',
  host: { '[class.destacada]': 'destacada()' },
})
export class NoticiaTarjetaComponent {
  private readonly servicio = inject(NoticiasService);

  readonly noticia = input.required<Noticia>();
  /** La primera noticia de la portada se muestra más grande. */
  readonly destacada = input(false);

  urlImagen(): string {
    return this.servicio.urlImagen(this.noticia().imagen_url);
  }
}
