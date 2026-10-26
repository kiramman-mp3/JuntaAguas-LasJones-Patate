import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { Noticia, NoticiasService } from '../../core/services/noticias.service';
import { FechaLocalPipe } from '../../shared/pipes/fecha-local.pipe';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';

/** Una noticia completa: imagen, etiquetas, fecha y descripción larga. */
@Component({
  selector: 'app-noticia-detalle',
  standalone: true,
  imports: [RouterLink, FechaLocalPipe, EmptyStateComponent, SkeletonComponent],
  templateUrl: './noticia-detalle.component.html',
  styleUrl: './noticias.scss',
})
export class NoticiaDetalleComponent implements OnInit {
  private readonly servicio = inject(NoticiasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly noticia = signal<Noticia | null>(null);
  readonly cargando = signal(true);
  /** 'no-existe' si el servidor responde 404; 'red' ante cualquier otro fallo. */
  readonly error = signal<'no-existe' | 'red' | null>(null);

  ngOnInit(): void {
    this.ruta.paramMap
      .pipe(
        tap(() => {
          this.cargando.set(true);
          this.error.set(null);
        }),
        switchMap((params) => this.servicio.obtener(Number(params.get('id')))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (noticia) => {
          this.noticia.set(noticia);
          this.cargando.set(false);
        },
        error: (err: { status?: number }) => {
          this.error.set(err?.status === 404 || err?.status === 400 ? 'no-existe' : 'red');
          this.cargando.set(false);
        },
      });
  }

  urlImagen(ruta: string): string {
    return this.servicio.urlImagen(ruta);
  }
}
