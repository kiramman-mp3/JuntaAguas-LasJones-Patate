import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import { ComprobantePdfService, Comprobante } from '../../../../../core/services/comprobante-pdf.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { UsuarioBusqueda, MESES, MetodoPagoNuevo, ObligacionItem, etiquetaPeriodo, numeroRecibo,numeroReciboPagonual,PagoAnualAgua } from '../../../../../core/models/finanzas';
import { formatearFecha } from '../../../../../core/utils/fechas';
import { ComprobanteBancarioComponent } from '../comprobante-bancario/comprobante-bancario.component';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';

type FiltroObligaciones = 'AGUA' | 'OTRAS';

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
 * Cobro en caja: buscar al usuario en el servidor, elegir sus obligaciones pendientes
 * (cuotas de agua, multas u otros rubros), registrar el pago y entregar el comprobante.
 */
@Component({
  selector: 'app-cobro-caja',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe, ComprobanteBancarioComponent],
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
  readonly resultados = signal<UsuarioBusqueda[]>([]);
  readonly buscando = signal(false);
  readonly errorBusqueda = signal('');

  readonly usuario = signal<UsuarioBusqueda | null>(null);
  readonly obligaciones = signal<ObligacionItem[]>([]);
  readonly cargandoObligaciones = signal(false);

  readonly cargandoObligacionesPagoAnualAgua = signal(false);
  readonly obligacionesPagoAnualAgua = signal<PagoAnualAgua[]>([]);
  readonly seleccionAgua = signal<Set<number>>(new Set());
  readonly errorObligaciones = signal('');
  readonly seleccion = signal<ReadonlySet<number>>(new Set());
  readonly filtro = signal<FiltroObligaciones>('AGUA');

  readonly metodo = signal<MetodoPagoNuevo>('TRANSFERENCIA');
  readonly referencia = signal('');
  readonly observacion = signal('');
  readonly procesando = signal(false);
  readonly comprobante = signal<Comprobante | null>(null);
  readonly pagoRegistradoId = signal<number | null>(null);
  readonly imprimiendo = signal(false);

  readonly metodos: { valor: MetodoPagoNuevo; etiqueta: string }[] = [
    { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
    { valor: 'DEPOSITO', etiqueta: 'Depósito' },
  ];

  readonly visibles = computed(() => {
    const filtro = this.filtro();
    return this.obligaciones().filter((o) =>
      filtro === 'OTRAS' || (filtro === 'AGUA' ? o.concepto_codigo === 'AGUA_MENSUAL' : o.concepto_codigo !== 'AGUA_MENSUAL'));
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
  // readonly seleccionadas = computed(() => this.obligaciones().filter((o) => this.seleccion().has(o.id)));
  // readonly total = computed(() => redondear(this.seleccionadas().reduce((s, o) => s + Number(o.valor), 0)));

// 1. Obligaciones seleccionadas según el filtro actual
  readonly seleccionadas = computed(() => {
    const elFiltro = this.filtro();

    if (elFiltro === 'AGUA') {
      // Solo devuelve las de agua que estén seleccionadas
      return this.obligacionesPagoAnualAgua().filter(p => this.seleccionAgua().has(p.id));
    } 
    
    if (elFiltro === 'OTRAS') {
      // Solo devuelve las multas/otras que estén seleccionadas
      return this.obligaciones().filter(o => this.seleccion().has(o.id));
    }

    // Si el filtro es 'TODAS' (o cualquier otro caso), puedes unirlas ambas si lo requieres
    const agua = this.obligacionesPagoAnualAgua().filter(p => this.seleccionAgua().has(p.id));
    const otras = this.obligaciones().filter(o => this.seleccion().has(o.id));
    return [...agua, ...otras];
  });

  // 2. Total calculado automáticamente según lo que devuelva 'seleccionadas'
  readonly total = computed(() => redondear(
    this.seleccionadas().reduce((s, o) => s + Number('valor_total' in o ? o.valor_total : o.valor), 0)
  ));
  readonly todasVisiblesMarcadas = computed(() => this.visibles().length > 0 && this.visibles().every((o) => this.seleccion().has(o.id)));
  /** Mensaje que impide cobrar, o '' si el cobro es válido. Se muestra junto al botón, no al enviar. */
  readonly bloqueo = computed(() => {
    if (!this.seleccionadas().length) return 'Seleccione al menos una obligación.';
    if (!this.referencia().trim()) {
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
        return this.finanzas.buscarUsuarios(texto).pipe(catchError(() => {
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
    this.seleccion.set(new Set());
    this.plegados.set(new Set());
    this.comprobante.set(null);
    this.reiniciarPago();
    setTimeout(() => this.campoBusqueda()?.nativeElement.focus());
  }

cargarObligaciones(): void {
    const c = this.usuario();
    if (!c) return;

    // 1. Cargar obligaciones generales
    this.cargandoObligaciones.set(true);
    this.errorObligaciones.set('');

    this.finanzas.getObligaciones({ persona_id: c.id, estado: 'PENDIENTE' }).subscribe({
      next: (res) => {
        const ordenadas = [...res.data].sort((a, b) =>
          (a.periodo_anio ?? 0) - (b.periodo_anio ?? 0) || (a.periodo_mes ?? 0) - (b.periodo_mes ?? 0) || a.id - b.id
        );
        this.obligaciones.set(ordenadas.map((o) => ({ ...o, valor: Number(o.valor) })));
        this.seleccion.set(new Set(ordenadas.map((o) => o.id)));
        this.cargandoObligaciones.set(false);
      },
      error: (err) => {
        this.cargandoObligaciones.set(false);
        this.errorObligaciones.set(err.error?.message || 'No se pudieron cargar las obligaciones.');
      }
    });

    // 2. Cargar pagos anuales de agua (Aplicando la misma lógica)
    this.cargandoObligacionesPagoAnualAgua.set(true);

    this.finanzas.getObligacionesAnualesAgua(Number(c.id)).subscribe({
      next: (res) => {
        const listaPagos = res.data || [];
        const ordenadasAgua = [...listaPagos].sort((a, b) => (a.periodo_anio ?? 0) - (b.periodo_anio ?? 0) || a.id - b.id);

        this.obligacionesPagoAnualAgua.set(ordenadasAgua);
        
        // Seleccionar todas por defecto al cargar
        this.seleccionAgua.set(new Set(ordenadasAgua.map((p) => p.id)));
        
        this.cargandoObligacionesPagoAnualAgua.set(false);
      },
      error: (error) => {
        console.error('Error al obtener pagos anuales de agua:', error);
        this.cargandoObligacionesPagoAnualAgua.set(false);
      }
    });

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
  readonly totalSeleccionadoAgua = computed(() => {
    const seleccionados = this.seleccionAgua();
    return this.obligacionesPagoAnualAgua()
      .filter((p) => seleccionados.has(p.id))
      .reduce((acc, p) => acc + Number(p.valor_total), 0);
  });

  // 3. Computed para el total general de agua disponible
  readonly totalAguaGeneral = computed(() => {
    return this.obligacionesPagoAnualAgua()
      .reduce((acc, p) => acc + Number(p.valor_total), 0);
  });

  // 4. Saber si todas están marcadas
  readonly todasAguaMarcadas = computed(() => {
    const total = this.obligacionesPagoAnualAgua().length;
    return total > 0 && this.seleccionAgua().size === total;
  });

  // 5. Métodos para alternar la selección individual y masiva
  alternarSeleccionAgua(id: number): void {
    const nuevo = new Set(this.seleccionAgua());
    if (nuevo.has(id)) {
      nuevo.delete(id);
    } else {
      nuevo.add(id);
    }
    this.seleccionAgua.set(nuevo);
  }
formatearValor(valor: any): string {
    return Number(valor || 0).toFixed(2);
  }
  alternarTodasAgua(): void {
    if (this.todasAguaMarcadas()) {
      this.seleccionAgua.set(new Set());
    } else {
      const todosIds = this.obligacionesPagoAnualAgua().map((p) => p.id);
      this.seleccionAgua.set(new Set(todosIds));
    }
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

cobrar(): void {
  const c = this.usuario();
  if (!c || this.bloqueo() || this.procesando()) return;

  // 1. Armamos las líneas adaptándonos al tipo (para que no falle TypeScript)
  const lineas = this.seleccionadas().map((o) => {
    if ('valor_total' in o) {
      return {
        concepto: `Cuota de Agua - Año ${o.periodo_anio}`,
        periodo: `Año ${o.periodo_anio}`,
        valor: Number(o.valor_total)
      };
    }
    return {
      concepto: o.concepto_nombre || 'Obligación',
      periodo: etiquetaPeriodo(o.periodo_anio, o.periodo_mes),
      valor: Number(o.valor)
    };
  });

  const metodo = this.metodo();
  const total = this.total();
  const observacion = this.observacion().trim();
  const referencia = this.referencia().trim();
  const anual = this.filtro() === 'AGUA';

  this.procesando.set(true);

  // 2. Preparamos el payload en base a la nueva interfaz NuevoPago
  const payload = {
    persona_id: c.id,
    obligacionesIds: this.seleccionadas().map((o) => o.id),
    metodo,
    referencia,
    observacion: observacion || undefined
  };

  // 3. Evaluamos qué pestaña está activa (AGUA u OTRAS) con if/else
  if (anual) {
    this.finanzas.registrarPagoAnualAgua(payload).subscribe({
      next: (res) => {
        this.procesarPagoExitoso(res, lineas, total, metodo, referencia, observacion, c, anual);
      },
      error: (err) => {
        this.procesando.set(false);
        this.notify.error(err.error?.message || 'No se pudo registrar el pago de agua.');
      }
    });
  } else {
    this.finanzas.registrarPago(payload).subscribe({
      next: (res) => {
        this.procesarPagoExitoso(res, lineas, total, metodo, referencia, observacion, c, anual);
      },
      error: (err) => {
        this.procesando.set(false);
        this.notify.error(err.error?.message || 'No se pudo registrar el pago.');
      }
    });
  }
}

// 4. Método auxiliar para procesar la respuesta (evita duplicar código)
private procesarPagoExitoso(
  res: any, 
  lineas: any[], 
  total: number, 
  metodo: any, 
  referencia: string, 
  observacion: string, 
  c: any,
  anual: boolean
): void {
  this.procesando.set(false);
  const pagoId = res.pagoId;
  const numero = anual ? numeroReciboPagonual(pagoId) : numeroRecibo(pagoId);
  // El comprobante bancario se adjunta a pagos de la tabla general; el pago anual de agua no lo admite aún.
  this.pagoRegistradoId.set(anual ? null : pagoId);

  this.comprobante.set({
    numero: numero,
    fechaHora: formatearFecha(new Date(), 'conHora'),
    usuarioNombre: `${c.nombres} ${c.apellidos}`.trim(),
    usuarioCedula: c.cedula,
    lineas,
    total: res.valorTotal ?? total,
    metodo,
    referencia,
    observacion: observacion || null
  });
  
  this.notify.success(`Pago ${numero} registrado por $${(res.valorTotal ?? total).toFixed(2)}.`);
  this.reiniciarPago();
  this.cargarObligaciones();
  this.cobrado.emit();
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
    this.metodo.set('TRANSFERENCIA');
    this.referencia.set('');
    this.observacion.set('');
    this.filtro.set('AGUA');
  }
}
