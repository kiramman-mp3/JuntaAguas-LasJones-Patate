import { Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import { HistorialAnual, MESES, numeroEgreso, numeroRecibo } from '../../../../../core/models/finanzas';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';

/** Un pago o un egreso dentro de un mes del historial. */
export interface Movimiento {
  tipo: 'INGRESO' | 'EGRESO';
  id: number;
  numero: string;
  fecha: string;
  detalle: string;
  tercero: string;
  valor: number;
  anulado: boolean;
}

interface EstadoMes {
  cargando: boolean;
  error: string;
  movimientos: Movimiento[];
}

/** Primer y último día de un mes 'AAAA-MM'. */
function rangoDelMes(mes: string): { desde: string; hasta: string } {
  const [anio, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

/**
 * Historial financiero anual en árbol: año → mes → movimientos.
 * Los totales y balances de cada año y mes llegan calculados del backend; los movimientos
 * de un mes se consultan al expandirlo.
 */
@Component({
  selector: 'app-historial-financiero',
  standalone: true,
  imports: [FechaLocalPipe],
  templateUrl: './historial-financiero.component.html'
})
export class HistorialFinancieroComponent {
  private finanzas = inject(FinanzasService);

  readonly historial = signal<HistorialAnual | null>(null);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly expandidos = signal<ReadonlySet<string>>(new Set());
  readonly meses = signal<Record<string, EstadoMes>>({});

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.meses.set({});
    this.finanzas.getHistorialAnual().subscribe({
      next: (res) => {
        this.historial.set(res.data);
        this.cargando.set(false);
        // El año más reciente se muestra abierto.
        const reciente = res.data.anios[0];
        this.expandidos.set(new Set(reciente ? [this.claveAnio(reciente.anio)] : []));
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err.error?.message || 'No se pudo cargar el historial financiero.');
      }
    });
  }

  claveAnio(anio: number): string {
    return `anio-${anio}`;
  }

  expandido(clave: string): boolean {
    return this.expandidos().has(clave);
  }

  alternar(clave: string): void {
    const siguiente = new Set(this.expandidos());
    if (!siguiente.delete(clave)) siguiente.add(clave);
    this.expandidos.set(siguiente);
  }

  alternarMes(mes: string): void {
    this.alternar(mes);
    const estado = this.meses()[mes];
    if (this.expandido(mes) && (!estado || estado.error)) this.cargarMovimientos(mes);
  }

  estadoMes(mes: string): EstadoMes | undefined {
    return this.meses()[mes];
  }

  nombreMes(mes: string): string {
    return MESES[Number(mes.slice(5, 7)) - 1] ?? mes;
  }

  cargarMovimientos(mes: string): void {
    this.meses.update((m) => ({ ...m, [mes]: { cargando: true, error: '', movimientos: [] } }));
    const rango = rangoDelMes(mes);
    forkJoin({ pagos: this.finanzas.getPagos(rango), egresos: this.finanzas.getEgresos(rango) }).subscribe({
      next: ({ pagos, egresos }) => {
        const movimientos: Movimiento[] = [
          ...pagos.data.map((p): Movimiento => ({
            tipo: 'INGRESO', id: p.id, numero: numeroRecibo(p.id), fecha: p.fecha_pago,
            detalle: p.observacion || 'Pago de obligaciones', tercero: p.comunero_nombre,
            valor: Number(p.valor_total), anulado: p.estado === 'ANULADO'
          })),
          ...egresos.data.map((e): Movimiento => ({
            tipo: 'EGRESO', id: e.id, numero: numeroEgreso(e.id), fecha: e.fecha,
            detalle: e.concepto, tercero: e.proveedor_nombre ?? '',
            valor: Number(e.valor), anulado: false
          }))
        ].sort((a, b) => b.fecha.localeCompare(a.fecha));
        this.meses.update((m) => ({ ...m, [mes]: { cargando: false, error: '', movimientos } }));
      },
      error: (err) => {
        this.meses.update((m) => ({ ...m, [mes]: { cargando: false, error: err.error?.message || 'No se pudieron cargar los movimientos.', movimientos: [] } }));
      }
    });
  }
}
