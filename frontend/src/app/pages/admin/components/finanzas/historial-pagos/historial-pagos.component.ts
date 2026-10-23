import { Component, computed, inject, output, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import { ComprobantePdfService } from '../../../../../core/services/comprobante-pdf.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { EstadoPago, Recibo, TipoRecibo } from '../../../../../core/models/finanzas';
import { hoyEnEcuador } from '../../../../../core/utils/fechas';
import { ComprobanteBancarioComponent } from '../comprobante-bancario/comprobante-bancario.component';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';

/**
 * Historial de recibos de un rango de fechas: los pagos de multas y otros cobros (REC-…) y los
 * pagos anuales de agua (REC-AGUA-…). Permite reimprimir el comprobante y anular cualquiera de ellos.
 */
@Component({
  selector: 'app-historial-pagos',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe, TitleCasePipe, ComprobanteBancarioComponent],
  templateUrl: './historial-pagos.component.html',
})
export class HistorialPagosComponent {
  private finanzas = inject(FinanzasService);
  private pdf = inject(ComprobantePdfService);
  private notify = inject(NotificationService);
  private dialog = inject(DialogService);

  readonly anulado = output<void>();

  readonly desde = signal(`${hoyEnEcuador().slice(0, 7)}-01`);
  readonly hasta = signal(hoyEnEcuador());
  readonly estado = signal<EstadoPago | ''>('');
  readonly tipo = signal<TipoRecibo | ''>('');
  readonly texto = signal('');
  readonly recibos = signal<Recibo[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  /** Clave (tipo-id) del recibo que se está imprimiendo o anulando. */
  readonly procesando = signal<string | null>(null);

  readonly filtrados = computed(() => {
    const t = this.texto().trim().toLowerCase();
    const tipo = this.tipo();
    return this.recibos().filter(
      (r) =>
        (!tipo || r.tipo === tipo) &&
        (!t ||
          [
            r.usuario_nombre,
            r.cedula,
            r.numero,
            r.referencia,
            r.registrado_por_usuario,
            r.detalle,
          ].some((campo) =>
            String(campo ?? '')
              .toLowerCase()
              .includes(t),
          )),
    );
  });

  readonly totalVigente = computed(
    () =>
      Math.round(
        this.filtrados()
          .filter((r) => r.estado === 'VIGENTE')
          .reduce((s, r) => s + r.valor_total, 0) * 100,
      ) / 100,
  );

  constructor() {
    this.cargar();
  }

  clave(r: Recibo): string {
    return `${r.tipo}-${r.id}`;
  }

  cargar(): void {
    if (this.desde() && this.hasta() && this.desde() > this.hasta()) {
      this.error.set('La fecha inicial debe ser anterior a la final.');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.finanzas
      .getRecibos({
        desde: this.desde() || undefined,
        hasta: this.hasta() || undefined,
        estado: this.estado() || undefined,
      })
      .subscribe({
        next: (recibos) => {
          this.recibos.set(recibos);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.error.set(err.error?.message || 'No se pudo cargar el historial de pagos.');
        },
      });
  }

  reimprimir(recibo: Recibo): void {
    if (this.procesando()) return;
    this.procesando.set(this.clave(recibo));
    this.finanzas.getComprobante(recibo.tipo, recibo.id).subscribe({
      next: async (comprobante) => {
        try {
          await this.pdf.imprimir(comprobante);
        } catch {
          this.notify.error('No se pudo generar el comprobante.');
        } finally {
          this.procesando.set(null);
        }
      },
      error: (err) => {
        this.procesando.set(null);
        this.notify.error(err.error?.message || 'No se pudo consultar el pago.');
      },
    });
  }

  async anular(recibo: Recibo): Promise<void> {
    if (recibo.estado === 'ANULADO' || this.procesando()) return;
    const motivo = await this.dialog.solicitar({
      titulo: `Anular ${recibo.numero}`,
      mensaje: `El pago de ${recibo.usuario_nombre} por $${recibo.valor_total.toFixed(2)} quedará anulado y sus obligaciones volverán a estar pendientes. Indique el motivo (mínimo 5 caracteres).`,
      placeholder: 'Motivo de la anulación',
      textoConfirmar: 'Anular pago',
      tipo: 'DANGER',
    });
    if (!motivo?.trim()) return;
    if (motivo.trim().length < 5) {
      this.notify.warning('Describa el motivo con al menos 5 caracteres.');
      return;
    }
    this.procesando.set(this.clave(recibo));
    this.finanzas.anularRecibo(recibo.tipo, recibo.id, motivo.trim()).subscribe({
      next: (res) => {
        this.procesando.set(null);
        this.notify.success(res.message || 'Pago anulado.');
        this.cargar();
        this.anulado.emit();
      },
      error: (err) => {
        this.procesando.set(null);
        this.notify.error(err.error?.message || 'No se pudo anular el pago.');
      },
    });
  }
}
