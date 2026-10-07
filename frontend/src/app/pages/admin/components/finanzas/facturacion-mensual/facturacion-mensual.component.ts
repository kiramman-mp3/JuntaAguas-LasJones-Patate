import { Component, computed, inject, output, signal } from '@angular/core';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { FacturacionMes, MESES, ResultadoFacturacion } from '../../../../../core/models/finanzas';
import { hoyEnEcuador } from '../../../../../core/utils/fechas';

/**
 * Facturación mensual de agua: muestra el año mes a mes y emite las cuotas de un período.
 * Antes de emitir siempre se calcula una vista previa (simulación en el servidor).
 */
@Component({
  selector: 'app-facturacion-mensual',
  standalone: true,
  templateUrl: './facturacion-mensual.component.html'
})
export class FacturacionMensualComponent {
  private finanzas = inject(FinanzasService);
  private notify = inject(NotificationService);
  private dialog = inject(DialogService);

  readonly emitido = output<void>();

  private readonly hoy = hoyEnEcuador();
  readonly anioActual = Number(this.hoy.slice(0, 4));
  readonly mesActual = Number(this.hoy.slice(5, 7));
  readonly anios = Array.from({ length: 4 }, (_, i) => this.anioActual - i);
  readonly MESES = MESES;

  readonly anio = signal(this.anioActual);
  readonly meses = signal<FacturacionMes[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly mesSeleccionado = signal<number | null>(null);
  readonly vistaPrevia = signal<ResultadoFacturacion | null>(null);
  readonly calculando = signal(false);
  readonly errorVistaPrevia = signal('');
  readonly emitiendo = signal(false);

  readonly detalle = computed(() => {
    const mes = this.mesSeleccionado();
    return mes ? this.meses().find((m) => m.mes === mes) ?? null : null;
  });

  readonly totalesAnio = computed(() => {
    const ms = this.meses();
    const suma = (k: keyof FacturacionMes) => Math.round(ms.reduce((s, m) => s + m[k], 0) * 100) / 100;
    return { emitido: suma('total'), recaudado: suma('recaudado'), pendientes: suma('pendientes'), mesesEmitidos: ms.filter((m) => m.emitidas).length };
  });

  constructor() {
    this.cargar();
  }

  esFuturo(mes: number): boolean {
    return this.anio() > this.anioActual || (this.anio() === this.anioActual && mes > this.mesActual);
  }

  /** Proporción cobrada del mes (0 a 1) para la barra de progreso. */
  progreso(m: FacturacionMes): number {
    return m.emitidas ? m.pagadas / m.emitidas : 0;
  }

  cambiarAnio(valor: string): void {
    this.anio.set(Number(valor));
    this.mesSeleccionado.set(null);
    this.vistaPrevia.set(null);
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.finanzas.getResumenFacturacion(this.anio()).subscribe({
      next: (res) => {
        this.meses.set(res.data.meses);
        this.cargando.set(false);
        if (this.mesSeleccionado() === null && this.anio() === this.anioActual) this.seleccionar(this.mesActual);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err.error?.message || 'No se pudo cargar el estado de la facturación.');
      }
    });
  }

  seleccionar(mes: number): void {
    if (this.esFuturo(mes)) return;
    this.mesSeleccionado.set(mes);
    this.calcular();
  }

  /** Vista previa: cuántas cuotas se emitirían y por cuánto, sin escribir nada. */
  calcular(): void {
    const mes = this.mesSeleccionado();
    if (!mes) return;
    const anio = this.anio();
    this.calculando.set(true);
    this.errorVistaPrevia.set('');
    this.vistaPrevia.set(null);
    this.finanzas.facturarMes(anio, mes, true).subscribe({
      next: (res) => {
        // Se ignora una respuesta atrasada si el usuario ya eligió otro mes.
        if (this.mesSeleccionado() !== mes || this.anio() !== anio) return;
        this.vistaPrevia.set(res.data);
        this.calculando.set(false);
      },
      error: (err) => {
        if (this.mesSeleccionado() !== mes || this.anio() !== anio) return;
        this.calculando.set(false);
        this.errorVistaPrevia.set(err.error?.message || 'No se pudo calcular la facturación de este mes.');
      }
    });
  }

  async emitir(): Promise<void> {
    const previa = this.vistaPrevia();
    if (!previa || !previa.generadas || this.emitiendo()) return;
    const periodo = `${MESES[previa.mes - 1]} ${previa.anio}`;
    const confirmado = await this.dialog.confirmar({
      titulo: `Emitir cuotas de ${periodo}`,
      mensaje: `Se emitirán ${previa.generadas} cuotas de $${previa.valor.toFixed(2)} (total $${previa.total.toFixed(2)}). Las cuotas emitidas solo se pueden anular una por una.`,
      textoConfirmar: `Emitir ${previa.generadas} cuotas`,
      tipo: 'WARNING'
    });
    if (!confirmado) return;
    this.emitiendo.set(true);
    this.finanzas.facturarMes(previa.anio, previa.mes, false).subscribe({
      next: (res) => {
        this.emitiendo.set(false);
        this.notify.success(res.message || 'Cuotas emitidas.');
        this.cargar();
        this.calcular();
        this.emitido.emit();
      },
      error: (err) => {
        this.emitiendo.set(false);
        this.notify.error(err.error?.message || 'No se pudieron emitir las cuotas.');
      }
    });
  }
}
