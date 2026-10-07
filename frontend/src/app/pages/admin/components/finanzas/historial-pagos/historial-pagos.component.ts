import { Component, computed, inject, output, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import { ComprobantePdfService } from '../../../../../core/services/comprobante-pdf.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { EstadoPago, Pago, etiquetaPeriodo, numeroRecibo } from '../../../../../core/models/finanzas';
import { formatearFecha, hoyEnEcuador } from '../../../../../core/utils/fechas';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';

/** Historial de pagos de un rango de fechas: reimprimir comprobantes y anular pagos. */
@Component({
  selector: 'app-historial-pagos',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe, TitleCasePipe],
  templateUrl: './historial-pagos.component.html'
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
  readonly texto = signal('');
  readonly pagos = signal<Pago[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly procesandoId = signal<number | null>(null);

  readonly numeroRecibo = numeroRecibo;

  readonly filtrados = computed(() => {
    const t = this.texto().trim().toLowerCase();
    if (!t) return this.pagos();
    return this.pagos().filter((p) =>
      [p.comunero_nombre, p.cedula, numeroRecibo(p.id), p.referencia, p.registrado_por_usuario]
        .some((campo) => String(campo ?? '').toLowerCase().includes(t)));
  });

  readonly totalVigente = computed(() =>
    Math.round(this.filtrados().filter((p) => p.estado === 'VIGENTE').reduce((s, p) => s + Number(p.valor_total), 0) * 100) / 100);

  constructor() {
    this.cargar();
  }

  cargar(): void {
    if (this.desde() && this.hasta() && this.desde() > this.hasta()) {
      this.error.set('La fecha inicial debe ser anterior a la final.');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.finanzas.getPagos({ desde: this.desde() || undefined, hasta: this.hasta() || undefined, estado: this.estado() || undefined }).subscribe({
      next: (res) => {
        this.pagos.set(res.data.map((p) => ({ ...p, valor_total: Number(p.valor_total) })));
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err.error?.message || 'No se pudo cargar el historial de pagos.');
      }
    });
  }

  reimprimir(pago: Pago): void {
    if (this.procesandoId()) return;
    this.procesandoId.set(pago.id);
    this.finanzas.getPago(pago.id).subscribe({
      next: async (res) => {
        const p = res.data;
        try {
          await this.pdf.imprimir({
            numero: numeroRecibo(p.id),
            fechaHora: formatearFecha(p.fecha_pago, 'conHora'),
            comuneroNombre: p.comunero_nombre,
            comuneroCedula: p.cedula,
            lineas: p.detalles.map((d) => ({
              concepto: d.concepto_nombre,
              periodo: etiquetaPeriodo(d.periodo_anio, d.periodo_mes),
              valor: Number(d.valor_pagado)
            })),
            total: Number(p.valor_total),
            metodo: p.metodo,
            referencia: p.referencia,
            observacion: p.estado === 'ANULADO' ? `Anulado: ${p.motivo_anulacion ?? ''}` : p.observacion,
            anulado: p.estado === 'ANULADO'
          });
        } catch {
          this.notify.error('No se pudo generar el comprobante.');
        } finally {
          this.procesandoId.set(null);
        }
      },
      error: (err) => {
        this.procesandoId.set(null);
        this.notify.error(err.error?.message || 'No se pudo consultar el pago.');
      }
    });
  }

  async anular(pago: Pago): Promise<void> {
    if (pago.estado === 'ANULADO' || this.procesandoId()) return;
    const motivo = await this.dialog.solicitar({
      titulo: `Anular ${numeroRecibo(pago.id)}`,
      mensaje: `El pago de ${pago.comunero_nombre} por $${Number(pago.valor_total).toFixed(2)} quedará anulado y sus obligaciones volverán a estar pendientes. Indique el motivo (mínimo 5 caracteres).`,
      placeholder: 'Motivo de la anulación',
      textoConfirmar: 'Anular pago',
      tipo: 'DANGER'
    });
    if (!motivo?.trim()) return;
    if (motivo.trim().length < 5) {
      this.notify.warning('Describa el motivo con al menos 5 caracteres.');
      return;
    }
    this.procesandoId.set(pago.id);
    this.finanzas.anularPago(pago.id, motivo.trim()).subscribe({
      next: (res) => {
        this.procesandoId.set(null);
        this.notify.success(res.message || 'Pago anulado.');
        this.cargar();
        this.anulado.emit();
      },
      error: (err) => {
        this.procesandoId.set(null);
        this.notify.error(err.error?.message || 'No se pudo anular el pago.');
      }
    });
  }
}
