import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { ResultadoObligacionesAnuales, ResumenAnualAgua } from '../../../../../core/models/finanzas';
import { hoyEnEcuador } from '../../../../../core/utils/fechas';

/**
 * Pago anual de agua: estado del año (emitidas, cobradas, pendientes) y emisión de la obligación
 * anual para los usuarios activos con lote. Antes de emitir siempre se calcula una vista previa en el servidor.
 * Sin un valor escrito se usa la tarifa del concepto «Pago anual de agua» vigente al 1 de enero.
 */
@Component({
  selector: 'app-facturacion-anual',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './facturacion-anual.component.html'
})
export class FacturacionAnualComponent {
  private finanzas = inject(FinanzasService);
  private notify = inject(NotificationService);
  private dialog = inject(DialogService);

  readonly emitido = output<void>();

  readonly anioActual = Number(hoyEnEcuador().slice(0, 4));
  /** No se emiten años futuros: solo el actual y los cuatro anteriores. */
  readonly anios = Array.from({ length: 5 }, (_, i) => this.anioActual - i);

  readonly anio = signal(this.anioActual);
  /** Valor escrito a mano; vacío usa la tarifa vigente. */
  readonly valor = signal<number | null>(null);

  readonly resumen = signal<ResumenAnualAgua | null>(null);
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly vistaPrevia = signal<ResultadoObligacionesAnuales | null>(null);
  readonly calculando = signal(false);
  readonly errorVistaPrevia = signal('');
  readonly emitiendo = signal(false);

  constructor() {
    this.cargar();
  }

  /** Proporción cobrada del año (0 a 1) para la barra de progreso. */
  progreso(r: ResumenAnualAgua): number {
    return r.emitidas ? r.pagadas / r.emitidas : 0;
  }

  cambiarAnio(valor: string | number): void {
    this.anio.set(Number(valor));
    this.cargar();
  }

  cambiarValor(valor: string | number | null): void {
    const numero = valor === '' || valor === null ? null : Number(valor);
    this.valor.set(numero !== null && Number.isFinite(numero) && numero > 0 ? numero : null);
    this.calcular();
  }

  cargar(): void {
    const anio = this.anio();
    this.cargando.set(true);
    this.error.set('');
    this.finanzas.getResumenAnualAgua(anio).subscribe({
      next: (res) => {
        if (this.anio() !== anio) return;
        this.resumen.set(res.data);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err.error?.message || 'No se pudo cargar el estado del pago anual.');
      }
    });
    this.calcular();
  }

  /** Vista previa: cuántas obligaciones se emitirían y por cuánto, sin escribir nada. */
  calcular(): void {
    const anio = this.anio();
    const valor = this.valor();
    this.calculando.set(true);
    this.errorVistaPrevia.set('');
    this.vistaPrevia.set(null);
    this.finanzas.generarObligacionesAnualesAgua({ anio, valor_total: valor, simular: true }).subscribe({
      next: (res) => {
        // Se ignora una respuesta atrasada si el usuario ya cambió el año o el valor.
        if (this.anio() !== anio || this.valor() !== valor) return;
        this.vistaPrevia.set(res.data);
        this.calculando.set(false);
      },
      error: (err) => {
        if (this.anio() !== anio || this.valor() !== valor) return;
        this.calculando.set(false);
        this.errorVistaPrevia.set(err.error?.message || 'No se pudo calcular el pago anual de este año.');
      }
    });
  }

  async emitir(): Promise<void> {
    const previa = this.vistaPrevia();
    if (!previa || !previa.generadas || this.emitiendo()) return;
    const confirmado = await this.dialog.confirmar({
      titulo: `Emitir el pago anual de agua ${previa.anio}`,
      mensaje: `Se emitirán ${previa.generadas} obligaciones de $${previa.valor.toFixed(2)} (total $${previa.total.toFixed(2)}). Vencen el 31 de diciembre de ${previa.anio}.`,
      textoConfirmar: `Emitir ${previa.generadas} obligaciones`,
      tipo: 'WARNING'
    });
    if (!confirmado) return;
    this.emitiendo.set(true);
    this.finanzas.generarObligacionesAnualesAgua({ anio: previa.anio, valor_total: this.valor() }).subscribe({
      next: (res) => {
        this.emitiendo.set(false);
        this.notify.success(res.message || 'Obligaciones emitidas.');
        this.cargar();
        this.emitido.emit();
      },
      error: (err) => {
        this.emitiendo.set(false);
        this.notify.error(err.error?.message || 'No se pudieron emitir las obligaciones.');
      }
    });
  }
}
