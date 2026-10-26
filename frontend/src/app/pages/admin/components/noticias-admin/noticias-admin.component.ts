import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { DialogService } from '../../../../core/services/dialog.service';
import {
  DatosNoticia,
  LIMITES_NOTICIA,
  Noticia,
  NoticiasService,
} from '../../../../core/services/noticias.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { mensajeError } from '../../../../core/utils/errores';
import { FechaLocalPipe } from '../../../../shared/pipes/fecha-local.pipe';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { ModalComponent } from '../../../../shared/ui/modal.component';
import { PaginadorComponent } from '../../../../shared/ui/paginador.component';
import { SkeletonComponent } from '../../../../shared/ui/skeleton.component';

const TIPOS_IMAGEN = ['image/jpeg', 'image/png'];
const TAMANO_MAXIMO_IMAGEN = 10 * 1024 * 1024;

const formularioVacio = (): DatosNoticia => ({
  titulo: '',
  descripcion_corta: '',
  descripcion_larga: '',
  tags: [],
});

/** Administración de noticias: la directiva las publica, edita y elimina. */
@Component({
  selector: 'app-noticias-admin',
  standalone: true,
  imports: [
    FormsModule,
    FechaLocalPipe,
    EmptyStateComponent,
    ModalComponent,
    PaginadorComponent,
    SkeletonComponent,
  ],
  templateUrl: './noticias-admin.component.html',
  styleUrl: './noticias-admin.component.scss',
})
export class NoticiasAdminComponent implements OnInit {
  private readonly servicio = inject(NoticiasService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly escritura$ = new Subject<string>();

  readonly limites = LIMITES_NOTICIA;

  readonly noticias = signal<Noticia[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly porPagina = signal(10);
  readonly busqueda = signal('');
  readonly cargando = signal(true);
  readonly error = signal('');

  /** `null` cierra el formulario; `'nueva'` abre uno vacío; una noticia abre su edición. */
  readonly formulario = signal<'nueva' | Noticia | null>(null);
  readonly guardando = signal(false);
  readonly abriendo = signal<number | null>(null);
  readonly eliminando = signal<number | null>(null);

  form: DatosNoticia = formularioVacio();
  etiquetaNueva = '';
  imagen: File | null = null;
  vistaPrevia = signal<string | null>(null);
  errorImagen = signal('');

  ngOnInit(): void {
    this.escritura$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pagina.set(1);
        this.cargar();
      });
    this.destroyRef.onDestroy(() => this.liberarVistaPrevia());
    this.cargar();
  }

  get editando(): Noticia | null {
    const f = this.formulario();
    return f && f !== 'nueva' ? f : null;
  }

  urlImagen(ruta: string): string {
    return this.servicio.urlImagen(ruta);
  }

  escribirBusqueda(texto: string): void {
    this.busqueda.set(texto);
    this.escritura$.next(texto.trim());
  }

  cambiarPagina(pagina: number): void {
    this.pagina.set(pagina);
    this.cargar();
  }

  cambiarPorPagina(limite: number): void {
    this.porPagina.set(limite);
    this.pagina.set(1);
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.servicio
      .listar({ q: this.busqueda().trim(), pagina: this.pagina(), limite: this.porPagina() })
      .subscribe({
        next: (res) => {
          this.noticias.set(res.data);
          this.total.set(res.total);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.error.set(mensajeError(err, 'Revise su conexión e intente nuevamente.'));
        },
      });
  }

  abrirNueva(): void {
    this.reiniciarFormulario();
    this.formulario.set('nueva');
  }

  /** La lista no trae la descripción larga: se pide la noticia completa antes de editar. */
  abrirEdicion(noticia: Noticia): void {
    if (this.abriendo() !== null) return;
    this.abriendo.set(noticia.id);
    this.servicio.obtener(noticia.id).subscribe({
      next: (completa) => {
        this.abriendo.set(null);
        this.reiniciarFormulario();
        this.form = {
          titulo: completa.titulo,
          descripcion_corta: completa.descripcion_corta,
          descripcion_larga: completa.descripcion_larga ?? '',
          tags: [...completa.tags],
        };
        this.formulario.set(completa);
      },
      error: (err) => {
        this.abriendo.set(null);
        this.notify.error(mensajeError(err, 'No se pudo abrir la noticia.'));
      },
    });
  }

  cerrarFormulario(): void {
    if (this.guardando()) return;
    this.formulario.set(null);
    this.reiniciarFormulario();
  }

  // --- Etiquetas -------------------------------------------------------------------------

  /** Agrega la etiqueta escrita (Enter o coma). Se guardan en minúsculas y sin repetir. */
  agregarEtiqueta(): void {
    const valor = this.etiquetaNueva.replace(/,/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!valor) return;
    const { min, max } = this.limites.etiqueta;
    if (valor.length < min || valor.length > max) {
      this.notify.warning(`Cada etiqueta debe tener entre ${min} y ${max} caracteres.`);
      return;
    }
    if (this.form.tags.includes(valor)) {
      this.etiquetaNueva = '';
      return;
    }
    if (this.form.tags.length >= this.limites.etiquetas) {
      this.notify.warning(`Use como máximo ${this.limites.etiquetas} etiquetas.`);
      return;
    }
    this.form.tags = [...this.form.tags, valor];
    this.etiquetaNueva = '';
  }

  teclaEtiqueta(evento: KeyboardEvent): void {
    if (evento.key === 'Enter' || evento.key === ',') {
      evento.preventDefault();
      this.agregarEtiqueta();
    } else if (evento.key === 'Backspace' && !this.etiquetaNueva && this.form.tags.length) {
      this.form.tags = this.form.tags.slice(0, -1);
    }
  }

  quitarEtiqueta(etiqueta: string): void {
    this.form.tags = this.form.tags.filter((t) => t !== etiqueta);
  }

  // --- Imagen ----------------------------------------------------------------------------

  elegirImagen(input: HTMLInputElement): void {
    const archivo = input.files?.[0] ?? null;
    input.value = '';
    if (!archivo) return;
    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      this.errorImagen.set('Elija una imagen JPG o PNG.');
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_IMAGEN) {
      this.errorImagen.set('La imagen no puede superar los 10 MB.');
      return;
    }
    this.errorImagen.set('');
    this.liberarVistaPrevia();
    this.imagen = archivo;
    this.vistaPrevia.set(URL.createObjectURL(archivo));
  }

  // --- Guardar y eliminar ----------------------------------------------------------------

  guardar(): void {
    if (this.guardando()) return;
    // Lo escrito en el campo de etiquetas sin confirmar también cuenta.
    this.agregarEtiqueta();
    const problema = this.validar();
    if (problema) {
      this.notify.warning(problema);
      return;
    }
    const datos: DatosNoticia = {
      titulo: this.form.titulo.trim(),
      descripcion_corta: this.form.descripcion_corta.trim(),
      descripcion_larga: this.form.descripcion_larga.trim(),
      tags: this.form.tags,
    };
    const edicion = this.editando;
    this.guardando.set(true);
    const peticion = edicion
      ? this.servicio.actualizar(edicion.id, datos, this.imagen)
      : this.servicio.crear(datos, this.imagen as File);
    peticion.subscribe({
      next: (res) => {
        this.guardando.set(false);
        this.notify.success(
          res.message || (edicion ? 'Noticia actualizada.' : 'Noticia publicada.'),
        );
        this.formulario.set(null);
        this.reiniciarFormulario();
        if (!edicion) this.pagina.set(1);
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.notify.error(mensajeError(err, 'No se pudo guardar la noticia.'));
      },
    });
  }

  async eliminar(noticia: Noticia): Promise<void> {
    if (this.eliminando() !== null) return;
    const confirmado = await this.dialog.confirmar({
      tipo: 'DANGER',
      titulo: 'Eliminar noticia',
      mensaje: `¿Eliminar la noticia "${noticia.titulo}"? Se borrarán también su imagen y sus etiquetas. Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
    });
    if (!confirmado) return;
    this.eliminando.set(noticia.id);
    this.servicio.eliminar(noticia.id).subscribe({
      next: (res) => {
        this.eliminando.set(null);
        this.notify.success(res.message || 'Noticia eliminada.');
        // Si era la última de la página, se vuelve a la anterior.
        if (this.noticias().length === 1 && this.pagina() > 1) this.pagina.update((p) => p - 1);
        this.cargar();
      },
      error: (err) => {
        this.eliminando.set(null);
        this.notify.error(mensajeError(err, 'No se pudo eliminar la noticia.'));
      },
    });
  }

  private validar(): string {
    const { titulo, corta, larga } = this.limites;
    const f = this.form;
    if (f.titulo.trim().length < titulo.min || f.titulo.trim().length > titulo.max)
      return `El título debe tener entre ${titulo.min} y ${titulo.max} caracteres.`;
    if (!f.tags.length) return 'Indique al menos una etiqueta.';
    if (
      f.descripcion_corta.trim().length < corta.min ||
      f.descripcion_corta.trim().length > corta.max
    )
      return `La descripción corta debe tener entre ${corta.min} y ${corta.max} caracteres.`;
    if (
      f.descripcion_larga.trim().length < larga.min ||
      f.descripcion_larga.trim().length > larga.max
    )
      return `La descripción larga debe tener entre ${larga.min} y ${larga.max} caracteres.`;
    if (!this.editando && !this.imagen) return 'La imagen de la noticia es obligatoria.';
    return '';
  }

  private reiniciarFormulario(): void {
    this.form = formularioVacio();
    this.etiquetaNueva = '';
    this.imagen = null;
    this.errorImagen.set('');
    this.liberarVistaPrevia();
  }

  private liberarVistaPrevia(): void {
    const actual = this.vistaPrevia();
    if (actual) URL.revokeObjectURL(actual);
    this.vistaPrevia.set(null);
  }
}
