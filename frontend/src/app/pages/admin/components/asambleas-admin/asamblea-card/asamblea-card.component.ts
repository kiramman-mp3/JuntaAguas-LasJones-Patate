import { Component, computed, input, output } from '@angular/core';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';
import { AsambleaItem, estadoBadge, estadoIcono, estadoTexto } from '../asamblea.model';

export type TipoDocumentoAsamblea = 'CONVOCATORIA' | 'ASISTENCIA';
export interface SubidaDocumento {
  tipo: TipoDocumentoAsamblea;
  input: HTMLInputElement;
}

/**
 * Tarjeta de una asamblea: estado, datos de la sesión, la siguiente acción del flujo
 * (programar → convocar → finalizar) y los documentos firmados. Solo presenta y emite intenciones.
 */
@Component({
  selector: 'app-asamblea-card',
  standalone: true,
  imports: [FechaLocalPipe],
  templateUrl: './asamblea-card.component.html'
})
export class AsambleaCardComponent {
  readonly asamblea = input.required<AsambleaItem>();
  /** Hay una acción en curso sobre esta asamblea (cambio de estado o subida). */
  readonly ocupada = input(false);

  readonly asistencia = output<void>();
  readonly actas = output<void>();
  readonly convocarWhatsApp = output<void>();
  readonly programar = output<void>();
  readonly convocar = output<void>();
  readonly finalizar = output<void>();
  readonly cancelar = output<void>();
  readonly descargarConvocatoria = output<void>();
  readonly descargarPadron = output<void>();
  readonly subirDocumento = output<SubidaDocumento>();
  readonly verDocumento = output<TipoDocumentoAsamblea>();

  readonly estadoTexto = estadoTexto;
  readonly estadoIcono = estadoIcono;
  readonly estadoBadge = estadoBadge;

  readonly abierta = computed(() => !['CANCELADO', 'REALIZADO'].includes(this.asamblea().estado));
  readonly porcentajeAsistencia = computed(() => {
    const a = this.asamblea();
    return a.totalComuneros ? Math.round((a.asistentes / a.totalComuneros) * 100) : 0;
  });

  subir(tipo: TipoDocumentoAsamblea, input: HTMLInputElement): void {
    this.subirDocumento.emit({ tipo, input });
  }
}
