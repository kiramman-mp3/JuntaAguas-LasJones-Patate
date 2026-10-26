import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Noticia, NoticiasService } from '../../core/services/noticias.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { NoticiaTarjetaComponent } from './noticia-tarjeta.component';

/** Cuántas noticias se muestran en la portada de Noticias; el resto está en el archivo. */
export const NOTICIAS_EN_PORTADA = 5;

/** Portada de Noticias: las cinco más recientes y el acceso al archivo completo. */
@Component({
  selector: 'app-noticias',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, SkeletonComponent, NoticiaTarjetaComponent],
  templateUrl: './noticias.component.html',
  styleUrl: './noticias.scss',
})
export class NoticiasComponent implements OnInit {
  private readonly servicio = inject(NoticiasService);

  readonly noticias = signal<Noticia[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(true);
  readonly error = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.servicio.listar({ limite: NOTICIAS_EN_PORTADA }).subscribe({
      next: (pagina) => {
        this.noticias.set(pagina.data);
        this.total.set(pagina.total);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }
}
