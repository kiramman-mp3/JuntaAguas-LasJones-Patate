import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../../core/services/admin.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { LotesMapComponent } from '../../lotes-map/lotes-map.component';
import { LoteItem, SectorItem } from '../../../../../core/models/api-payloads';
import { AYUDAS_FORMULARIO } from '../../../../../core/directives/formularios';

const PATRON_CODIGO = /^[A-Z]{3}-\d{3,8}$/;

/** Alta y edición de un lote del catastro: sector, código, superficie y ubicación tomada del mapa. */
@Component({
  selector: 'app-lote-form',
  standalone: true,
  imports: [FormsModule, ...AYUDAS_FORMULARIO, ModalComponent, LotesMapComponent],
  templateUrl: './lote-form.component.html',
})
export class LoteFormComponent implements OnInit, OnDestroy {
  private admin = inject(AdminService);
  private notify = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  readonly sectores = input<SectorItem[]>([]);
  /** Lote a editar; sin valor, el formulario registra uno nuevo. */
  readonly lote = input<LoteItem | null>(null);
  readonly cerrar = output<void>();
  readonly creado = output<void>();
  readonly actualizado = output<void>();

  modoEdicion = false;
  /** Ubicación con la que se abre la edición: el mapa arranca centrado en ella. */
  latInicial: number | null = null;
  lngInicial: number | null = null;

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
    observacion: '',
  };

  ngOnInit(): void {
    const l = this.lote();
    if (!l) return;
    this.modoEdicion = true;
    this.form = {
      sector_id: l.sector_id,
      codigo: l.codigo,
      superficie_m2: l.superficie_m2 === null ? null : Number(l.superficie_m2),
      latitud_aproximada: String(l.latitud_aproximada ?? ''),
      longitud_aproximada: String(l.longitud_aproximada ?? ''),
      radio_error_m: l.radio_error_m ?? 5,
      referencia_ubicacion: l.referencia_ubicacion ?? '',
      observacion: l.observacion ?? '',
    };
    const lat = parseFloat(this.form.latitud_aproximada);
    const lng = parseFloat(this.form.longitud_aproximada);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      this.latInicial = lat;
      this.lngInicial = lng;
    }
  }

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
      },
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

    const id = this.lote()?.id;
    if (this.modoEdicion && id) {
      this.admin.updateLote(id, this.form).subscribe({
        next: () => {
          this.guardando = false;
          this.notify.success('Lote actualizado.');
          this.actualizado.emit();
        },
        error: (err) => {
          this.guardando = false;
          this.error = err.error?.message || 'Error al actualizar el lote.';
          this.cdr.markForCheck();
        },
      });
      return;
    }

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
      },
    });
  }
}
