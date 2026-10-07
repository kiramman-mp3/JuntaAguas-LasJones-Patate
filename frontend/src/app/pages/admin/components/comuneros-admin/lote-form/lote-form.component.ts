import { ChangeDetectorRef, Component, OnDestroy, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../../core/services/admin.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { LotesMapComponent } from '../../lotes-map/lotes-map.component';

const PATRON_CODIGO = /^[A-Z]{3}-\d{3,8}$/;

/** Registro de un lote en el catastro: sector, código, superficie y ubicación tomada del mapa. */
@Component({
  selector: 'app-lote-form',
  standalone: true,
  imports: [FormsModule, ModalComponent, LotesMapComponent],
  templateUrl: './lote-form.component.html'
})
export class LoteFormComponent implements OnDestroy {
  private admin = inject(AdminService);
  private notify = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  readonly sectores = input<any[]>([]);
  readonly cerrar = output<void>();
  readonly creado = output<void>();

  sugiriendoCodigo = false;
  guardando = false;
  error = '';
  /** Invalida las sugerencias de código que lleguen tarde (otro sector o formulario cerrado). */
  private solicitud = 0;
  private activo = true;

  form = {
    sector_id: null as number | null,
    codigo: '',
    superficie_m2: null as number | null,
    latitud_aproximada: '',
    longitud_aproximada: '',
    radio_error_m: 5,
    referencia_ubicacion: '',
    observacion: ''
  };

  ngOnDestroy(): void {
    this.activo = false;
    this.solicitud++;
  }

  solicitarCierre(): void {
    if (this.guardando) return;
    this.solicitud++;
    this.sugiriendoCodigo = false;
    this.cerrar.emit();
  }

  cambiarSector(): void {
    this.solicitud++;
    this.sugiriendoCodigo = false;
    this.error = '';
  }

  normalizarCodigo(codigo: string): void {
    this.form.codigo = codigo.trim().toUpperCase();
    this.error = '';
  }

  fijarUbicacion({ lat, lng }: { lat: number; lng: number }): void {
    this.form.latitud_aproximada = lat.toFixed(6);
    this.form.longitud_aproximada = lng.toFixed(6);
    this.cdr.markForCheck();
  }

  sugerirCodigo(): void {
    if (!this.form.sector_id || this.sugiriendoCodigo || this.guardando) return;
    const solicitud = ++this.solicitud;
    this.sugiriendoCodigo = true;
    this.error = '';
    this.admin.sugerirCodigoLote(this.form.sector_id).subscribe({
      next: (res) => {
        if (solicitud !== this.solicitud || !this.activo) return;
        this.form.codigo = res.data.codigo;
        this.sugiriendoCodigo = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        if (solicitud !== this.solicitud || !this.activo) return;
        this.error = err.error?.message || 'No se pudo sugerir un código. Intente nuevamente.';
        this.sugiriendoCodigo = false;
        this.cdr.markForCheck();
      }
    });
  }

  guardar(): void {
    if (this.guardando || this.sugiriendoCodigo) return;
    this.error = '';
    if (!this.form.sector_id || !this.form.codigo) {
      this.error = 'El sector y el código son obligatorios.';
      return;
    }
    this.form.codigo = this.form.codigo.trim().toUpperCase();
    if (!PATRON_CODIGO.test(this.form.codigo)) {
      this.error = 'Use tres letras y de tres a ocho dígitos, por ejemplo LJA-001.';
      return;
    }
    this.guardando = true;
    this.admin.createLote(this.form).subscribe({
      next: () => {
        this.guardando = false;
        this.notify.success('Lote creado.');
        this.creado.emit();
      },
      error: (err) => {
        // El formulario sigue abierto y editable para corregir el conflicto.
        this.guardando = false;
        this.error = err.error?.message || 'Error al crear lote.';
        this.cdr.markForCheck();
      }
    });
  }
}
