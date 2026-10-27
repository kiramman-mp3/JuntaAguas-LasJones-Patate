import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  EtiquetaNoticia,
  FiltrosNoticias,
  Noticia,
  NoticiasService,
} from '../../core/services/noticias.service';
import { diaEnEcuador, formatearFecha } from '../../core/utils/fechas';
import { CurvasNivelComponent } from '../../shared/ui/curvas-nivel.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PaginadorComponent } from '../../shared/ui/paginador.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { NoticiaTarjetaComponent } from './noticia-tarjeta.component';

interface GrupoMes {
  clave: string;
  etiqueta: string;
  noticias: Noticia[];
}

/**
 * Archivo de noticias: todas las publicadas, con filtros por texto, etiqueta y fechas y paginación.
 * Los resultados se agrupan por mes. Los filtros viven en la URL (?q=&tag=&desde=&hasta=&pagina=)
 * para poder compartir o volver a una búsqueda.
 */
@Component({
  selector: 'app-noticias-archivo',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    CurvasNivelComponent,
    EmptyStateComponent,
    PaginadorComponent,
    SkeletonComponent,
    NoticiaTarjetaComponent,
  ],
  templateUrl: './noticias-archivo.component.html',
  styleUrl: './noticias.scss',
})
export class NoticiasArchivoComponent implements OnInit {
  private readonly servicio = inject(NoticiasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly escritura$ = new Subject<string>();

  readonly opcionesPorPagina = [6, 12, 24];

  readonly etiquetas = signal<EtiquetaNoticia[]>([]);
  readonly noticias = signal<Noticia[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(true);
  readonly error = signal(false);

  readonly q = signal('');
  readonly tag = signal('');
  readonly desde = signal('');
  readonly hasta = signal('');
  readonly pagina = signal(1);
  readonly limite = signal(12);

  readonly hayFiltros = computed(() => !!(this.q() || this.tag() || this.desde() || this.hasta()));
  readonly rangoInvertido = computed(
    () => !!this.desde() && !!this.hasta() && this.desde() > this.hasta(),
  );

  /** Las noticias de la página, agrupadas por el mes en que se publicaron (ya vienen de más reciente a más antigua). */
  readonly grupos = computed<GrupoMes[]>(() => {
    const porMes = new Map<string, Noticia[]>();
    for (const noticia of this.noticias()) {
      const clave = diaEnEcuador(noticia.publicada_en).slice(0, 7);
      porMes.set(clave, [...(porMes.get(clave) ?? []), noticia]);
    }
    return [...porMes].map(([clave, noticias]) => ({
      clave,
      etiqueta: formatearFecha(`${clave}-01`, 'mesAnio'),
      noticias,
    }));
  });

  ngOnInit(): void {
    this.servicio.etiquetas().subscribe({
      next: (lista) => this.etiquetas.set(lista),
      // Sin etiquetas el resto del archivo sigue funcionando.
      error: () => this.etiquetas.set([]),
    });

    // El texto se envía al dejar de escribir; el resto de filtros, al instante.
    this.escritura$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((texto) => this.aplicar({ q: texto }));

    this.ruta.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.q.set(params.get('q') ?? '');
      this.tag.set(params.get('tag') ?? '');
      this.desde.set(params.get('desde') ?? '');
      this.hasta.set(params.get('hasta') ?? '');
      this.pagina.set(Math.max(1, Number(params.get('pagina')) || 1));
      this.cargar();
    });
  }

  escribir(texto: string): void {
    this.q.set(texto);
    this.escritura$.next(texto.trim());
  }

  /** Elegir de nuevo la etiqueta activa la quita. */
  alternarEtiqueta(etiqueta: string): void {
    this.aplicar({ tag: this.tag() === etiqueta ? '' : etiqueta });
  }

  /** Cambia filtros en la URL; la suscripción a la ruta recarga la lista. */
  aplicar(cambios: {
    q?: string;
    tag?: string;
    desde?: string;
    hasta?: string;
    pagina?: number;
  }): void {
    const nuevo = {
      q: cambios.q ?? this.q(),
      tag: cambios.tag ?? this.tag(),
      desde: cambios.desde ?? this.desde(),
      hasta: cambios.hasta ?? this.hasta(),
      // Cualquier cambio de filtro vuelve a la primera página.
      pagina: cambios.pagina ?? 1,
    };
    this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: {
        q: nuevo.q || null,
        tag: nuevo.tag || null,
        desde: nuevo.desde || null,
        hasta: nuevo.hasta || null,
        pagina: nuevo.pagina > 1 ? nuevo.pagina : null,
      },
    });
  }

  limpiar(): void {
    this.aplicar({ q: '', tag: '', desde: '', hasta: '' });
  }

  cambiarLimite(limite: number): void {
    this.limite.set(limite);
    // En la primera página la dirección no cambia y no habría recarga: se consulta directamente.
    if (this.pagina() === 1) this.cargar();
    else this.aplicar({ pagina: 1 });
  }

  cargar(): void {
    if (this.rangoInvertido()) {
      this.noticias.set([]);
      this.total.set(0);
      this.cargando.set(false);
      return;
    }
    const filtros: FiltrosNoticias = {
      q: this.q(),
      tag: this.tag(),
      desde: this.desde(),
      hasta: this.hasta(),
      pagina: this.pagina(),
      limite: this.limite(),
    };
    this.cargando.set(true);
    this.error.set(false);
    this.servicio.listar(filtros).subscribe({
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
