import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AdminService } from '../../../../../core/services/admin.service';
import { SectorItem } from '../../../../../core/models/api-payloads';
import { hoyEnEcuador } from '../../../../../core/utils/fechas';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { MultaConfiguradaComponent } from '../../../../../shared/multa-configurada/multa-configurada.component';

/** Registro de una minga comunitaria con selección de sector o convocatoria a todos. */
@Component({
  selector: 'app-minga-form',
  standalone: true,
  imports: [FormsModule, ModalComponent, MultaConfiguradaComponent],
  templateUrl: './minga-form.component.html',
})
export class MingaFormComponent implements OnInit {
  private admin = inject(AdminService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  readonly cerrar = output<void>();
  readonly creada = output<void>();

  guardando = false;
  cargandoSectores = false;
  error = '';
  sectores: SectorItem[] = [];
  readonly fechaMinima = hoyEnEcuador();

  formulario: {
    titulo: string;
    descripcion: string;
    fecha: string;
    hora_inicio: string;
    lugar: string;
    sector_id: number | null;
    genera_multa_ausencia: boolean;
  } = {
    titulo: '',
    descripcion: '',
    fecha: hoyEnEcuador(),
    hora_inicio: '08:00',
    lugar: '',
    sector_id: null,
    genera_multa_ausencia: true,
  };

  ngOnInit(): void {
    this.cargarSectores();
  }

  private cargarSectores(): void {
    this.cargandoSectores = true;
    this.admin
      .getSectores()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.cargandoSectores = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.sectores = res.data || [];
        },
        error: () => {
          // Si no se pueden cargar, se conserva la lista vacía y la opción "Todos"
        },
      });
  }

  guardar(): void {
    if (this.guardando) return;
    const f = this.formulario;
    if (
      !f.titulo.trim() ||
      !f.descripcion.trim() ||
      !f.lugar.trim() ||
      !f.fecha ||
      !f.hora_inicio
    ) {
      this.error = 'Complete la actividad, el trabajo a realizar, la fecha, la hora y el lugar.';
      return;
    }
    if (f.fecha < this.fechaMinima) {
      this.error = 'La fecha de la minga no puede ser anterior a la fecha actual.';
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
      sector_id: f.sector_id ? Number(f.sector_id) : null,
      requiere_asistencia: true,
      // El valor de la multa lo toma el servidor de Ajustes → Tarifas.
    };
    this.admin
      .createEvento(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.guardando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => this.creada.emit(),
        error: (err) => (this.error = err.error?.message || 'No se pudo registrar la minga.'),
      });
  }
}
