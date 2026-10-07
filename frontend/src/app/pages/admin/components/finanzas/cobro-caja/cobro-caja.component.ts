import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import { ComprobantePdfService, Comprobante } from '../../../../../core/services/comprobante-pdf.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ComuneroBusqueda, MESES, MetodoPago, ObligacionItem, etiquetaPeriodo, numeroRecibo } from '../../../../../core/models/finanzas';
import { formatearFecha } from '../../../../../core/utils/fechas';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';

type FiltroObligaciones = 'TODAS' | 'AGUA' | 'OTRAS';

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

/**
 * Cobro en caja: buscar al comunero en el servidor, elegir sus obligaciones pendientes
 * (cuotas de agua, multas u otros rubros), registrar el pago y entregar el comprobante.
 */
@Component({
  selector: 'app-cobro-caja',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe],
  templateUrl: './cobro-caja.component.html'
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
  readonly resultados = signal<ComuneroBusqueda[]>([]);
  readonly buscando = signal(false);
  readonly errorBusqueda = signal('');

  readonly comunero = signal<ComuneroBusqueda | null>(null);
  readonly obligaciones = signal<ObligacionItem[]>([]);
  readonly cargandoObligaciones = signal(false);
  readonly errorObligaciones = signal('');
  readonly seleccion = signal<ReadonlySet<number>>(new Set());
  readonly filtro = signal<FiltroObligaciones>('TODAS');

  readonly metodo = signal<MetodoPago>('EFECTIVO');
  readonly referencia = signal('');
  readonly recibido = signal<number | null>(null);
  readonly observacion = signal('');
  readonly procesando = signal(false);
  readonly comprobante = signal<Comprobante | null>(null);
  readonly imprimiendo = signal(false);

  readonly metodos: { valor: MetodoPago; etiqueta: string }[] = [
    { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
    { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
    { valor: 'DEPOSITO', etiqueta: 'Depósito' }
  ];

  readonly visibles = computed(() => {
    const filtro = this.filtro();
    return this.obligaciones().filter((o) =>
      filtro === 'TODAS' || (filtro === 'AGUA' ? o.concepto_codigo === 'AGUA_MENSUAL' : o.concepto_codigo !== 'AGUA_MENSUAL'));
  });

  /**
   * Árbol año → mes → concepto de las obligaciones visibles, del período más antiguo al más reciente.
   * Las obligaciones sin año (multas u otros rubros sin período) van al final.
   */
  readonly arbol = computed<NodoAnio[]>(() => {
    const anios = new Map<string, NodoAnio>();
    for (const o of this.visibles()) {
      const claveAnio = o.periodo_anio ? String(o.periodo_anio) : SIN_PERIODO;
      let anio = anios.get(claveAnio);
      if (!anio) {
        anio = { clave: claveAnio, etiqueta: o.periodo_anio ? String(o.periodo_anio) : 'Sin período', meses: [], total: 0, cantidad: 0 };
        anios.set(claveAnio, anio);
      }
      const numMes = o.periodo_mes && o.periodo_mes >= 1 && o.periodo_mes <= 12 ? o.periodo_mes : null;
      const claveMes = `${claveAnio}-${numMes ?? SIN_MES}`;
      let mes = anio.meses.find((m) => m.clave === claveMes);
      if (!mes) {
        mes = { clave: claveMes, etiqueta: numMes ? MESES[numMes - 1] : o.periodo_anio ? 'Sin mes' : 'Otros rubros', obligaciones: [], subtotal: 0 };
        anio.meses.push(mes);
      }
      mes.obligaciones.push(o);
      mes.subtotal = redondear(mes.subtotal + Number(o.valor));
      anio.total = redondear(anio.total + Number(o.valor));
      anio.cantidad++;
    }
    const numero = (clave: string) => (clave.endsWith(SIN_MES) || clave === SIN_PERIODO ? Number.MAX_SAFE_INTEGER : Number(clave.split('-').pop()));
    return [...anios.values()]
      .map((a) => ({ ...a, meses: [...a.meses].sort((x, y) => numero(x.clave) - numero(y.clave)) }))
      .sort((a, b) => numero(a.clave) - numero(b.clave));
  });

  /** Nodos plegados; por defecto todo está desplegado para que el cajero vea el detalle. */
  readonly plegados = signal<ReadonlySet<string>>(new Set());

  /** Total de lo visible y lo marcado dentro de lo visible (según el filtro activo). */
  readonly totalVisible = computed(() => redondear(this.visibles().reduce((s, o) => s + Number(o.valor), 0)));
  readonly seleccionadoVisible = computed(() =>
    redondear(this.visibles().filter((o) => this.seleccion().has(o.id)).reduce((s, o) => s + Number(o.valor), 0)));

  readonly totalPendiente = computed(() => redondear(this.obligaciones().reduce((s, o) => s + Number(o.valor), 0)));
  readonly seleccionadas = computed(() => this.obligaciones().filter((o) => this.seleccion().has(o.id)));
  readonly total = computed(() => redondear(this.seleccionadas().reduce((s, o) => s + Number(o.valor), 0)));
  readonly todasVisiblesMarcadas = computed(() => this.visibles().length > 0 && this.visibles().every((o) => this.seleccion().has(o.id)));
  readonly cambio = computed(() => {
    const recibido = this.recibido();
    return recibido === null ? 0 : redondear(Math.max(0, recibido - this.total()));
  });

  /** Mensaje que impide cobrar, o '' si el cobro es válido. Se muestra junto al botón, no al enviar. */
  readonly bloqueo = computed(() => {
    if (!this.seleccionadas().length) return 'Seleccione al menos una obligación.';
    if (this.metodo() === 'EFECTIVO') {
      const recibido = this.recibido();
      if (recibido === null || !Number.isFinite(recibido)) return 'Ingrese el valor recibido.';
      if (recibido < this.total()) return `Faltan $${(this.total() - recibido).toFixed(2)} para cubrir el total.`;
    } else if (!this.referencia().trim()) {
      return 'Ingrese el número de referencia.';
    }
    return '';
  });

  readonly etiquetaPeriodo = etiquetaPeriodo;

  constructor() {
    this.busqueda$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      tap(() => this.errorBusqueda.set('')),
      switchMap((texto) => {
        if (texto.length < 2) {
          this.buscando.set(false);
          return of(null);
        }
        this.buscando.set(true);
        return this.finanzas.buscarComuneros(texto).pipe(catchError(() => {
          this.errorBusqueda.set('No se pudo buscar. Revise su conexión e intente de nuevo.');
          return of(null);
        }));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res) => {
      this.buscando.set(false);
      this.resultados.set(res?.data ?? []);
    });

    afterNextRender(() => this.campoBusqueda()?.nativeElement.focus());
  }

  onBuscar(texto: string): void {
    this.termino.set(texto);
    this.busqueda$.next(texto.trim());
  }

  seleccionarComunero(c: ComuneroBusqueda): void {
    this.comunero.set(c);
    this.resultados.set([]);
    this.termino.set('');
    this.comprobante.set(null);
    this.reiniciarPago();
    this.cargarObligaciones();
  }

  cambiarComunero(): void {
    this.comunero.set(null);
    this.obligaciones.set([]);
    this.seleccion.set(new Set());
    this.plegados.set(new Set());
    this.comprobante.set(null);
    this.reiniciarPago();
    setTimeout(() => this.campoBusqueda()?.nativeElement.focus());
  }

  cargarObligaciones(): void {
    const c = this.comunero();
    if (!c) return;
    this.cargandoObligaciones.set(true);
    this.errorObligaciones.set('');
    this.finanzas.getObligaciones({ persona_id: c.id, estado: 'PENDIENTE' }).subscribe({
      next: (res) => {
        const ordenadas = [...res.data].sort((a, b) =>
          (a.periodo_anio ?? 0) - (b.periodo_anio ?? 0) || (a.periodo_mes ?? 0) - (b.periodo_mes ?? 0) || a.id - b.id);
        this.obligaciones.set(ordenadas.map((o) => ({ ...o, valor: Number(o.valor) })));
        this.seleccion.set(new Set(ordenadas.map((o) => o.id)));
        this.cargandoObligaciones.set(false);
      },
      error: (err) => {
        this.cargandoObligaciones.set(false);
        this.errorObligaciones.set(err.error?.message || 'No se pudieron cargar las obligaciones.');
      }
    });
  }

  alternar(id: number): void {
    const nueva = new Set(this.seleccion());
    if (nueva.has(id)) nueva.delete(id); else nueva.add(id);
    this.seleccion.set(nueva);
  }

  estaAbierto(clave: string): boolean {
    return !this.plegados().has(clave);
  }

  alternarNodo(clave: string): void {
    const nuevo = new Set(this.plegados());
    if (nuevo.has(clave)) nuevo.delete(clave); else nuevo.add(clave);
    this.plegados.set(nuevo);
  }

  idsDe(nodo: NodoAnio | NodoMes): number[] {
    return 'meses' in nodo ? nodo.meses.flatMap((m) => m.obligaciones.map((o) => o.id)) : nodo.obligaciones.map((o) => o.id);
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
      if (marcar) nueva.add(id); else nueva.delete(id);
    }
    this.seleccion.set(nueva);
  }

  alternarVisibles(): void {
    const nueva = new Set(this.seleccion());
    const marcar = !this.todasVisiblesMarcadas();
    for (const o of this.visibles()) {
      if (marcar) nueva.add(o.id); else nueva.delete(o.id);
    }
    this.seleccion.set(nueva);
  }

  /** Atajo de caja: el valor recibido es exactamente el total. */
  valorExacto(): void {
    this.recibido.set(this.total());
  }

  onRecibido(valor: number | string | null): void {
    const n = valor === null || valor === '' ? null : Number(valor);
    this.recibido.set(n !== null && Number.isFinite(n) ? n : null);
  }

  cobrar(): void {
    const c = this.comunero();
    if (!c || this.bloqueo() || this.procesando()) return;
    const lineas = this.seleccionadas().map((o) => ({
      concepto: o.concepto_nombre || 'Obligación',
      periodo: etiquetaPeriodo(o.periodo_anio, o.periodo_mes),
      valor: Number(o.valor)
    }));
    const metodo = this.metodo();
    const total = this.total();
    const recibido = metodo === 'EFECTIVO' ? this.recibido() ?? total : undefined;
    const observacion = this.observacion().trim();

    this.procesando.set(true);
    this.finanzas.registrarPago({
      persona_id: c.id,
      obligacionesIds: this.seleccionadas().map((o) => o.id),
      metodo,
      referencia: metodo === 'EFECTIVO' ? undefined : this.referencia().trim(),
      observacion: observacion || undefined
    }).subscribe({
      next: (res) => {
        this.procesando.set(false);
        this.comprobante.set({
          numero: numeroRecibo(res.pagoId),
          fechaHora: formatearFecha(new Date(), 'conHora'),
          comuneroNombre: `${c.nombres} ${c.apellidos}`.trim(),
          comuneroCedula: c.cedula,
          lineas,
          total: res.valorTotal ?? total,
          valorRecibido: recibido,
          metodo,
          referencia: metodo === 'EFECTIVO' ? null : this.referencia().trim(),
          observacion: observacion || null
        });
        this.notify.success(`Pago ${numeroRecibo(res.pagoId)} registrado por $${(res.valorTotal ?? total).toFixed(2)}.`);
        this.reiniciarPago();
        this.cargarObligaciones();
        this.cobrado.emit();
      },
      error: (err) => {
        this.procesando.set(false);
        this.notify.error(err.error?.message || 'No se pudo registrar el pago.');
      }
    });
  }

  async imprimirComprobante(descargar = false): Promise<void> {
    const c = this.comprobante();
    if (!c || this.imprimiendo()) return;
    this.imprimiendo.set(true);
    try {
      await (descargar ? this.pdf.descargar(c) : this.pdf.imprimir(c));
    } catch {
      this.notify.error('El pago quedó registrado, pero no se pudo generar el comprobante. Puede reimprimirlo desde el historial.');
    } finally {
      this.imprimiendo.set(false);
    }
  }

  private reiniciarPago(): void {
    this.metodo.set('EFECTIVO');
    this.referencia.set('');
    this.recibido.set(null);
    this.observacion.set('');
    this.filtro.set('TODAS');
  }
}
