import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import { ComprobantePdfService, Comprobante } from '../../../../../core/services/comprobante-pdf.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ComuneroBusqueda, MetodoPago, ObligacionItem, etiquetaPeriodo, numeroRecibo } from '../../../../../core/models/finanzas';
import { formatearFecha } from '../../../../../core/utils/fechas';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';

type FiltroObligaciones = 'TODAS' | 'AGUA' | 'OTRAS';

interface GrupoObligaciones {
  etiqueta: string;
  obligaciones: ObligacionItem[];
  subtotal: number;
}

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

  readonly grupos = computed<GrupoObligaciones[]>(() => {
    const porAnio = new Map<string, GrupoObligaciones>();
    for (const o of this.visibles()) {
      const clave = o.periodo_anio ? String(o.periodo_anio) : 'Sin período';
      const grupo = porAnio.get(clave) ?? { etiqueta: clave, obligaciones: [], subtotal: 0 };
      grupo.obligaciones.push(o);
      grupo.subtotal = redondear(grupo.subtotal + Number(o.valor));
      porAnio.set(clave, grupo);
    }
    return [...porAnio.values()];
  });

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
