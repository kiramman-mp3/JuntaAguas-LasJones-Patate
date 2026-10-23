import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { DialogService } from '../../../../../core/services/dialog.service';

@Component({
  selector: 'app-comprobante-bancario',
  standalone: true,
  template: `
    @if (editable()) {
      <input #archivo type="file" accept="application/pdf,image/jpeg,image/png" hidden (change)="subir(archivo)" />
      <button type="button" class="btn btn--outline btn--sm" [disabled]="ocupado()" (click)="archivo.click()">
        <i class="ri-upload-2-line" aria-hidden="true"></i>
        {{ ocupado() ? 'Procesando…' : existe() ? 'Reemplazar comprobante bancario' : 'Subir comprobante bancario' }}
      </button>
      <span class="field__hint">PDF, JPG o PNG · hasta 10 MB</span>
    }
    @if (existe()) {
      <button type="button" class="btn btn--outline btn--sm" [disabled]="ocupado()" (click)="descargar()">
        <i class="ri-download-2-line" aria-hidden="true"></i> Descargar comprobante bancario
      </button>
    }
  `
})
export class ComprobanteBancarioComponent {
  readonly pagoId = input.required<number>();
  readonly existente = input(false);
  readonly editable = input(true);
  readonly subido = output<void>();
  readonly ocupado = signal(false);
  private readonly cargado = signal(false);
  existe() { return this.existente() || this.cargado(); }
  private readonly api = inject(FinanzasService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);

  async subir(input: HTMLInputElement): Promise<void> {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo || this.ocupado() || !this.editable()) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(archivo.type) || !archivo.size || archivo.size > 10 * 1024 * 1024) {
      this.notify.warning('Seleccione un PDF, JPG o PNG de hasta 10 MB.');
      return;
    }
    this.ocupado.set(true);
    try {
      if (this.existe() && !await this.dialog.confirmar({ titulo: 'Reemplazar comprobante bancario',
        mensaje: 'Se sustituirá el archivo adjunto de este pago.', textoConfirmar: 'Reemplazar' })) return;
      if (this.destroyRef.destroyed) return;
      await new Promise<void>((resolve) => {
        this.api.subirComprobante(this.pagoId(), archivo).pipe(takeUntilDestroyed(this.destroyRef), finalize(resolve)).subscribe({
          next: () => { this.cargado.set(true); this.notify.success('Comprobante bancario guardado.'); this.subido.emit(); },
          error: err => this.notify.error(err.error?.message || 'No se pudo subir el archivo. El pago sigue registrado; puede reintentar desde el historial.')
        });
      });
    } finally { this.ocupado.set(false); }
  }

  descargar(): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.api.descargarComprobante(this.pagoId()).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.ocupado.set(false))).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        const ext = blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg';
        enlace.download = `Comprobante_pago_${this.pagoId()}.${ext}`;
        enlace.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.notify.error('No se pudo descargar el comprobante bancario.')
    });
  }
}
