import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import {
  ComprobantePdfService,
  Comprobante,
  ComprobanteLinea,
} from '../../../../../core/services/comprobante-pdf.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import {
  UsuarioBusqueda,
  MESES,
  MetodoPagoNuevo,
  NuevoPago,
  ObligacionAnualAgua,
  ObligacionItem,
  PagoRegistrado,
  TipoRecibo,
  etiquetaPeriodo,
  numeroRecibo,
  numeroReciboAgua,
} from '../../../../../core/models/finanzas';
import { formatearFecha } from '../../../../../core/utils/fechas';
import { ComprobanteBancarioComponent } from '../comprobante-bancario/comprobante-bancario.component';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';

/** Pestañas de la caja: el pago anual de agua o las multas y otros cobros. */
export type PestanaCobro = 'AGUA' | 'OTRAS';

/** Mes del árbol de obligaciones: sus conceptos de cobro y el subtotal. */
export interface NodoMes {
  clave: string;
  etiqueta: string;
  obligaciones: ObligacionItem[];
  subtotal: number;
}

/** Año del árbol de obligaciones: sus meses y el total del año. */
export interface NodoAnio {
  clave: string;
  etiqueta: string;
  meses: NodoMes[];
  total: number;
  cantidad: number;
}

export type EstadoSeleccion = 'todas' | 'algunas' | 'ninguna';

const SIN_PERIODO = 'sin-periodo';
const SIN_MES = 'sin-mes';

const redondear = (n: number) => Math.round(n * 100) / 100;
const sumar = (valores: number[]) => redondear(valores.reduce((s, v) => s + v, 0));

/**
 * Cobro en caja: buscar al usuario en el servidor, elegir sus obligaciones pendientes
 * (pago anual de agua, o multas y otros rubros), registrar el pago y entregar el comprobante.
 * Cada pestaña se cobra por separado porque el agua anual y las demás obligaciones tienen su propio recibo.
 */
@Component({
  selector: 'app-cobro-caja',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe, ComprobanteBancarioComponent],
  templateUrl: './cobro-caja.component.html',
})
export class CobroCajaComponent {
  private finanzas = inject(FinanzasService);
  private pdf = inject(ComprobantePdfService);
  private notify = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  /** Se emite tras registrar un pago, para refrescar los indicadores. */
  readonly cobrado = output<void>();

  private campoBusqueda = viewChild<ElementRef<HTMLInputElement>>('campoBusqueda');
  private busqueda$ = new Subject<string>();

  readonly termino = signal('');
  readonly resultados = signal<UsuarioBusqueda[]>([]);
  readonly buscando = signal(false);
  readonly errorBusqueda = signal('');

  readonly usuario = signal<UsuarioBusqueda | null>(null);
  readonly pestana = signal<PestanaCobro>('AGUA');

  // Multas y otros cobros
  readonly obligaciones = signal<ObligacionItem[]>([]);
  readonly cargandoObligaciones = signal(false);
  readonly errorObligaciones = signal('');
  readonly seleccion = signal<ReadonlySet<number>>(new Set());

  // Pago anual de agua
  readonly obligacionesAgua = signal<ObligacionAnualAgua[]>([]);
  readonly cargandoAgua = signal(false);
  readonly errorAgua = signal('');
  readonly seleccionAgua = signal<ReadonlySet<number>>(new Set());

  readonly metodo = signal<MetodoPagoNuevo>('TRANSFERENCIA');
  readonly referencia = signal('');
  readonly observacion = signal('');
  readonly procesando = signal(false);
  readonly comprobante = signal<Comprobante | null>(null);
  readonly pagoRegistradoId = signal<number | null>(null);
  readonly pagoRegistradoTipo = signal<TipoRecibo>('GENERAL');
  readonly imprimiendo = signal(false);

  readonly metodos: { valor: MetodoPagoNuevo; etiqueta: string }[] = [
    { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
    { valor: 'DEPOSITO', etiqueta: 'Depósito' },
  ];

  /**
   * Árbol año → mes → concepto de las multas y otros cobros, del período más antiguo al más reciente.
   * Las obligaciones sin año van al final.
   */
  readonly arbol = computed<NodoAnio[]>(() => {
    const anios = new Map<string, NodoAnio>();
    for (const o of this.obligaciones()) {
      const claveAnio = o.periodo_anio ? String(o.periodo_anio) : SIN_PERIODO;
      let anio = anios.get(claveAnio);
      if (!anio) {
        anio = {
          clave: claveAnio,
          etiqueta: o.periodo_anio ? String(o.periodo_anio) : 'Sin período',
          meses: [],
          total: 0,
          cantidad: 0,
        };
        anios.set(claveAnio, anio);
      }
      const numMes =
        o.periodo_mes && o.periodo_mes >= 1 && o.periodo_mes <= 12 ? o.periodo_mes : null;
      const claveMes = `${claveAnio}-${numMes ?? SIN_MES}`;
      let mes = anio.meses.find((m) => m.clave === claveMes);
      if (!mes) {
        mes = {
          clave: claveMes,
          etiqueta: numMes ? MESES[numMes - 1] : o.periodo_anio ? 'Sin mes' : 'Otros rubros',
          obligaciones: [],
          subtotal: 0,
        };
        anio.meses.push(mes);
      }
      mes.obligaciones.push(o);
      mes.subtotal = redondear(mes.subtotal + Number(o.valor));
      anio.total = redondear(anio.total + Number(o.valor));
      anio.cantidad++;
    }
    const numero = (clave: string) =>
      clave.endsWith(SIN_MES) || clave === SIN_PERIODO
        ? Number.MAX_SAFE_INTEGER
        : Number(clave.split('-').pop());
    return [...anios.values()]
      .map((a) => ({ ...a, meses: [...a.meses].sort((x, y) => numero(x.clave) - numero(y.clave)) }))
      .sort((a, b) => numero(a.clave) - numero(b.clave));
  });

  /** Nodos plegados; por defecto todo está desplegado para que el cajero vea el detalle. */
  readonly plegados = signal<ReadonlySet<string>>(new Set());

  readonly totalOtras = computed(() => sumar(this.obligaciones().map((o) => Number(o.valor))));
  readonly seleccionadasOtras = computed(() =>
    this.obligaciones().filter((o) => this.seleccion().has(o.id)),
  );
  readonly totalSeleccionadoOtras = computed(() =>
    sumar(this.seleccionadasOtras().map((o) => Number(o.valor))),
  );
  readonly todasOtrasMarcadas = computed(
    () =>
      this.obligaciones().length > 0 &&
      this.obligaciones().every((o) => this.seleccion().has(o.id)),
  );

  readonly totalAgua = computed(() =>
    sumar(this.obligacionesAgua().map((o) => Number(o.valor_total))),
  );
  readonly seleccionadasAgua = computed(() =>
    this.obligacionesAgua().filter((o) => this.seleccionAgua().has(o.id)),
  );
  readonly totalSeleccionadoAgua = computed(() =>
    sumar(this.seleccionadasAgua().map((o) => Number(o.valor_total))),
  );
  readonly todasAguaMarcadas = computed(
    () =>
      this.obligacionesAgua().length > 0 &&
      this.obligacionesAgua().every((o) => this.seleccionAgua().has(o.id)),
  );

  /** Cantidad y total de lo que se cobrará en la pestaña activa. */
  readonly cantidadSeleccionada = computed(
    () => (this.pestana() === 'AGUA' ? this.seleccionadasAgua() : this.seleccionadasOtras()).length,
  );
  readonly total = computed(() =>
    this.pestana() === 'AGUA' ? this.totalSeleccionadoAgua() : this.totalSeleccionadoOtras(),
  );

  /** Mensaje que impide cobrar, o '' si el cobro es válido. Se muestra junto al botón, no al enviar. */
  readonly bloqueo = computed(() => {
    if (!this.cantidadSeleccionada()) return 'Seleccione al menos una obligación.';
    if (!this.referencia().trim()) return 'Ingrese el número de referencia.';
    return '';
  });

  readonly etiquetaPeriodo = etiquetaPeriodo;

  constructor() {
    this.busqueda$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap(() => this.errorBusqueda.set('')),
        switchMap((texto) => {
          if (texto.length < 2) {
            this.buscando.set(false);
            return of(null);
          }
          this.buscando.set(true);
          return this.finanzas.buscarUsuarios(texto).pipe(
            catchError(() => {
              this.errorBusqueda.set('No se pudo buscar. Revise su conexión e intente de nuevo.');
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.buscando.set(false);
        this.resultados.set(res?.data ?? []);
      });

    afterNextRender(() => this.campoBusqueda()?.nativeElement.focus());
  }

  onBuscar(texto: string): void {
    this.termino.set(texto);
    this.busqueda$.next(texto.trim());
  }

  seleccionarUsuario(c: UsuarioBusqueda): void {
    this.usuario.set(c);
    this.resultados.set([]);
    this.termino.set('');
    this.comprobante.set(null);
    this.reiniciarPago();
    this.cargarObligaciones();
  }

  cambiarUsuario(): void {
    this.usuario.set(null);
    this.obligaciones.set([]);
    this.obligacionesAgua.set([]);
    this.seleccion.set(new Set());
    this.seleccionAgua.set(new Set());
    this.plegados.set(new Set());
    this.comprobante.set(null);
    this.reiniciarPago();
    setTimeout(() => this.campoBusqueda()?.nativeElement.focus());
  }

  /** Carga las dos listas del usuario (una petición por tipo) y deja todo marcado. */
  cargarObligaciones(): void {
    this.cargarOtras();
    this.cargarAgua();
  }

  cargarOtras(): void {
    const c = this.usuario();
    if (!c) return;
    this.cargandoObligaciones.set(true);
    this.errorObligaciones.set('');
    this.finanzas.getObligaciones({ persona_id: c.id, estado: 'PENDIENTE' }).subscribe({
      next: (res) => {
        const ordenadas = [...res.data]
          .sort(
            (a, b) =>
              (a.periodo_anio ?? 0) - (b.periodo_anio ?? 0) ||
              (a.periodo_mes ?? 0) - (b.periodo_mes ?? 0) ||
              a.id - b.id,
          )
          .map((o) => ({ ...o, valor: Number(o.valor) }));
        this.obligaciones.set(ordenadas);
        this.seleccion.set(new Set(ordenadas.map((o) => o.id)));
        this.cargandoObligaciones.set(false);
      },
      error: (err) => {
        this.cargandoObligaciones.set(false);
        this.errorObligaciones.set(
          err.error?.message || 'No se pudieron cargar las multas y otros cobros.',
        );
      },
    });
  }

  cargarAgua(): void {
    const c = this.usuario();
    if (!c) return;
    this.cargandoAgua.set(true);
    this.errorAgua.set('');
    this.finanzas.getObligacionesAnualesAgua(c.id).subscribe({
      next: (res) => {
        const ordenadas = [...(res.data ?? [])]
          .sort((a, b) => a.periodo_anio - b.periodo_anio || a.id - b.id)
          .map((o) => ({ ...o, valor_total: Number(o.valor_total) }));
        this.obligacionesAgua.set(ordenadas);
        this.seleccionAgua.set(new Set(ordenadas.map((o) => o.id)));
        this.cargandoAgua.set(false);
      },
      error: (err) => {
        this.cargandoAgua.set(false);
        this.errorAgua.set(err.error?.message || 'No se pudo cargar el pago anual de agua.');
      },
    });
  }

  alternarAgua(id: number): void {
    this.seleccionAgua.set(conmutar(this.seleccionAgua(), id));
  }

  alternarTodasAgua(): void {
    this.seleccionAgua.set(
      this.todasAguaMarcadas() ? new Set() : new Set(this.obligacionesAgua().map((o) => o.id)),
    );
  }

  alternar(id: number): void {
    this.seleccion.set(conmutar(this.seleccion(), id));
  }

  alternarTodasOtras(): void {
    this.seleccion.set(
      this.todasOtrasMarcadas() ? new Set() : new Set(this.obligaciones().map((o) => o.id)),
    );
  }

  estaAbierto(clave: string): boolean {
    return !this.plegados().has(clave);
  }

  alternarNodo(clave: string): void {
    this.plegados.set(conmutar(this.plegados(), clave));
  }

  idsDe(nodo: NodoAnio | NodoMes): number[] {
    return 'meses' in nodo
      ? nodo.meses.flatMap((m) => m.obligaciones.map((o) => o.id))
      : nodo.obligaciones.map((o) => o.id);
  }

  estadoSeleccion(ids: number[]): EstadoSeleccion {
    const marcadas = ids.filter((id) => this.seleccion().has(id)).length;
    return marcadas === 0 ? 'ninguna' : marcadas === ids.length ? 'todas' : 'algunas';
  }

  /** Marca o desmarca de una vez todo un año o un mes. */
  alternarGrupo(ids: number[]): void {
    const marcar = this.estadoSeleccion(ids) !== 'todas';
    const nueva = new Set(this.seleccion());
    for (const id of ids) {
      if (marcar) nueva.add(id);
      else nueva.delete(id);
    }
    this.seleccion.set(nueva);
  }

  cobrar(): void {
    const c = this.usuario();
    if (!c || this.bloqueo() || this.procesando()) return;

    const anual = this.pestana() === 'AGUA';
    const lineas: ComprobanteLinea[] = anual
      ? this.seleccionadasAgua().map((o) => ({
          concepto: 'Pago anual de agua',
          periodo: `Año ${o.periodo_anio}`,
          valor: o.valor_total,
        }))
      : this.seleccionadasOtras().map((o) => ({
          concepto: o.concepto_nombre || 'Obligación',
          periodo: etiquetaPeriodo(o.periodo_anio, o.periodo_mes),
          valor: o.valor,
        }));
    const datos: NuevoPago = {
      persona_id: c.id,
      obligacionesIds: (anual ? this.seleccionadasAgua() : this.seleccionadasOtras()).map(
        (o) => o.id,
      ),
      metodo: this.metodo(),
      referencia: this.referencia().trim(),
      observacion: this.observacion().trim() || undefined,
    };
    const total = this.total();
    const peticion: Observable<PagoRegistrado> = anual
      ? this.finanzas.registrarPagoAnualAgua(datos)
      : this.finanzas.registrarPago(datos);

    this.procesando.set(true);
    peticion.subscribe({
      next: (res) => {
        this.procesando.set(false);
        const numero = anual ? numeroReciboAgua(res.pagoId) : numeroRecibo(res.pagoId);
        this.pagoRegistradoId.set(res.pagoId);
        this.pagoRegistradoTipo.set(anual ? 'AGUA' : 'GENERAL');
        this.comprobante.set({
          numero,
          fechaHora: formatearFecha(new Date(), 'conHora'),
          usuarioNombre: `${c.nombres} ${c.apellidos}`.trim(),
          usuarioCedula: c.cedula,
          lineas,
          total: res.valorTotal ?? total,
          metodo: datos.metodo,
          referencia: datos.referencia ?? null,
          observacion: datos.observacion ?? null,
        });
        this.notify.success(
          `Pago ${numero} registrado por $${(res.valorTotal ?? total).toFixed(2)}.`,
        );
        this.reiniciarPago(this.pestana());
        this.cargarObligaciones();
        this.cobrado.emit();
      },
      error: (err) => {
        this.procesando.set(false);
        this.notify.error(err.error?.message || 'No se pudo registrar el pago.');
      },
    });
  }

  async imprimirComprobante(descargar = false): Promise<void> {
    const c = this.comprobante();
    if (!c || this.imprimiendo()) return;
    this.imprimiendo.set(true);
    try {
      await (descargar ? this.pdf.descargar(c) : this.pdf.imprimir(c));
    } catch {
      this.notify.error(
        'El pago quedó registrado, pero no se pudo generar el comprobante. Puede reimprimirlo desde el historial de pagos.',
      );
    } finally {
      this.imprimiendo.set(false);
    }
  }

  private reiniciarPago(pestana: PestanaCobro = 'AGUA'): void {
    this.metodo.set('TRANSFERENCIA');
    this.referencia.set('');
    this.observacion.set('');
    this.pestana.set(pestana);
  }
}

/** Copia del conjunto con `valor` agregado o quitado. */
function conmutar<T>(conjunto: ReadonlySet<T>, valor: T): Set<T> {
  const nuevo = new Set(conjunto);
  if (nuevo.has(valor)) nuevo.delete(valor);
  else nuevo.add(valor);
  return nuevo;
}
