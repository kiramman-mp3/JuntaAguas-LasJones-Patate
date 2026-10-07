import { ChangeDetectorRef, Component, DestroyRef, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AdminService } from '../../../../../core/services/admin.service';
import { hoyEnEcuador } from '../../../../../core/utils/fechas';
import { ModalComponent } from '../../../../../shared/ui/modal.component';

/** Registro de una minga comunitaria (sin subtipo ni orden del día: no es una asamblea). */
@Component({
  selector: 'app-minga-form',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './minga-form.component.html'
})
export class MingaFormComponent {
  private admin = inject(AdminService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  readonly cerrar = output<void>();
  readonly creada = output<void>();

  guardando = false;
  error = '';
  formulario = {
    titulo: '',
    descripcion: '',
    fecha: hoyEnEcuador(),
    hora_inicio: '08:00',
    lugar: '',
    genera_multa_ausencia: true,
    valor_multa: 10
  };

  guardar(): void {
    if (this.guardando) return;
    const f = this.formulario;
    if (
      !f.titulo.trim() ||
      !f.descripcion.trim() ||
      !f.lugar.trim() ||
      !f.fecha ||
      !f.hora_inicio ||
      (f.genera_multa_ausencia && (!Number.isFinite(Number(f.valor_multa)) || Number(f.valor_multa) <= 0))
    ) {
      this.error = 'Complete la actividad, fecha, hora y lugar. Si aplica multa, ingrese un valor mayor a cero.';
      return;
    }
    this.guardando = true;
    this.error = '';
    // Una minga no tiene subtipo de asamblea ni puntos de orden del día.
    const payload = {
      ...f,
      tipo: 'MINGA',
      titulo: f.titulo.trim(),
      descripcion: f.descripcion.trim(),
      lugar: f.lugar.trim(),
      requiere_asistencia: true,
      valor_multa: f.genera_multa_ausencia ? Number(f.valor_multa) : 0
    };
    this.admin
      .createEvento(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.guardando = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => this.creada.emit(),
        error: (err) => (this.error = err.error?.message || 'No se pudo registrar la minga.')
      });
  }
}
