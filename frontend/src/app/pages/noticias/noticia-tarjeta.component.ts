import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Noticia, NoticiasService } from '../../core/services/noticias.service';
import { FechaLocalPipe } from '../../shared/pipes/fecha-local.pipe';

/**
 * Cómo se presenta una noticia:
 * - `destacada`: la principal de la portada, con la imagen grande al lado del texto.
 * - `fila`: una del canal de la portada (la fecha la muestra el riel de la lista).
 * - `tarjeta`: la del archivo y la de "Otras noticias".
 */
export type VarianteNoticia = 'destacada' | 'fila' | 'tarjeta';

/** Una noticia: imagen, etiquetas, fecha, título y descripción corta. Todo el bloque lleva al detalle. */
@Component({
  selector: 'app-noticia-tarjeta',
  standalone: true,
  imports: [RouterLink, FechaLocalPipe],
  template: `
    <article class="noticia-card" [class]="'noticia-card noticia-card--' + variante()">
      <a
        class="noticia-card__imagen"
        [routerLink]="['/noticias', noticia().id]"
        tabindex="-1"
        aria-hidden="true"
      >
        <img [src]="urlImagen()" alt="" loading="lazy" width="960" height="540" />
      </a>
      <div class="noticia-card__cuerpo">
        <div class="noticia-card__meta">
          @if (variante() !== 'fila') {
            <time [attr.datetime]="noticia().publicada_en">{{
              noticia().publicada_en | fechaLocal: formatoFecha()
            }}</time>
          }
          @if (noticia().tags.length) {
            <ul class="noticia-card__tags" aria-label="Etiquetas">
              @for (tag of noticia().tags; track tag) {
                <li>
                  <a
                    class="noticia-tag"
                    routerLink="/noticias/todas"
                    [queryParams]="{ tag: tag }"
                    >{{ tag }}</a
                  >
                </li>
              }
            </ul>
          }
        </div>
        <h3 class="noticia-card__titulo">
          <a [routerLink]="['/noticias', noticia().id]">{{ noticia().titulo }}</a>
        </h3>
        <p class="noticia-card__resumen">{{ noticia().descripcion_corta }}</p>
        @if (variante() === 'destacada') {
          <span class="noticia-card__mas" aria-hidden="true">
            Leer la noticia <i class="ri-arrow-right-line"></i>
          </span>
        }
      </div>
    </article>
  `,
  styleUrl: './noticia-tarjeta.scss',
  host: { '[class.destacada]': "variante() === 'destacada'" },
})
export class NoticiaTarjetaComponent {
  private readonly servicio = inject(NoticiasService);

  readonly noticia = input.required<Noticia>();
  readonly variante = input<VarianteNoticia>('tarjeta');

  /** La destacada lleva la fecha completa; en el resto basta la corta. */
  readonly formatoFecha = computed(() => (this.variante() === 'destacada' ? 'larga' : 'corta'));

  urlImagen(): string {
    return this.servicio.urlImagen(this.noticia().imagen_url);
  }
}
