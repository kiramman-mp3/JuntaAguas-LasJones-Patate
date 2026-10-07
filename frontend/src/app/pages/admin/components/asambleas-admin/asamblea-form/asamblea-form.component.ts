import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../../core/services/admin.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { hoyEnEcuador, sumarDias } from '../../../../../core/utils/fechas';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { MultaConfiguradaComponent } from '../../../../../shared/multa-configurada/multa-configurada.component';

/** Formulario de convocatoria de una nueva asamblea con su orden del día inicial. */
@Component({
  selector: 'app-asamblea-form',
  standalone: true,
  imports: [FormsModule, ModalComponent, MultaConfiguradaComponent],
  templateUrl: './asamblea-form.component.html'
})
export class AsambleaFormComponent {
  private admin = inject(AdminService);
  private dialog = inject(DialogService);

  readonly cerrar = output<void>();
  readonly creada = output<void>();

  private readonly listaPuntos = viewChild<ElementRef<HTMLElement>>('listaPuntos');

  readonly guardando = signal(false);
  readonly fechaMinima = hoyEnEcuador();

  formulario = {
    subtipo_asamblea: 'ORDINARIA' as 'ORDINARIA' | 'EXTRAORDINARIA',
    titulo: 'ASAMBLEA GENERAL ORDINARIA DE USUARIOS',
    descripcion: 'Tratamiento del informe de gestión, estado de cuentas y resoluciones de riego.',
    fecha: sumarDias(hoyEnEcuador(), 7),
    hora_inicio: '18:00',
    hora_fin: '21:00',
    lugar: 'Casa Comunal Junta La Jones',
    genera_multa_ausencia: true,
    puntos_orden_dia: [
      '1. Constatación del cuórum reglamentario',
      '2. Lectura y aprobación del acta de la asamblea anterior',
      '3. Informe de presidencia y balance financiero',
      '4. Asuntos varios y resoluciones'
    ] as string[]
  };

  agregarPunto(): void {
    this.formulario.puntos_orden_dia.push(`${this.formulario.puntos_orden_dia.length + 1}. Nuevo punto del orden del día`);
    // Lleva a la vista el punto recién agregado.
    setTimeout(() => {
      const lista = this.listaPuntos()?.nativeElement;
      if (lista) lista.scrollTo({ top: lista.scrollHeight, behavior: 'smooth' });
    });
  }

  eliminarPunto(indice: number): void {
    if (this.formulario.puntos_orden_dia.length > 1) this.formulario.puntos_orden_dia.splice(indice, 1);
  }

  guardar(): void {
    const f = this.formulario;
    if (!f.titulo.trim() || !f.fecha || !f.hora_inicio) {
      this.dialog.aviso({ tipo: 'WARNING', titulo: 'Campos incompletos', mensaje: 'Complete el título o asunto, la fecha de la sesión y la hora de inicio.' });
      return;
    }
    if (f.fecha < this.fechaMinima) {
      this.dialog.aviso({ tipo: 'WARNING', titulo: 'Fecha no válida', mensaje: `La fecha de la asamblea (${f.fecha}) no puede ser anterior a hoy (${this.fechaMinima}).` });
      return;
    }

    const payload = {
      tipo: 'ASAMBLEA',
      subtipo_asamblea: f.subtipo_asamblea,
      titulo: f.titulo.trim(),
      descripcion: f.descripcion.trim(),
      fecha: f.fecha,
      hora_inicio: f.hora_inicio,
      hora_fin: f.hora_fin || null,
      lugar: f.lugar.trim(),
      // El valor de la multa lo toma el servidor de Ajustes → Tarifas.
      genera_multa_ausencia: f.genera_multa_ausencia,
      puntos_orden_dia: f.puntos_orden_dia.filter((p) => p.trim().length > 0)
    };

    this.guardando.set(true);
    this.admin.createEvento(payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.creada.emit();
      },
      error: (err: any) => {
        this.guardando.set(false);
        this.dialog.aviso({ tipo: 'DANGER', titulo: 'No se pudo guardar', mensaje: err?.error?.message || 'Error al registrar la asamblea.' });
      }
    });
  }
}
