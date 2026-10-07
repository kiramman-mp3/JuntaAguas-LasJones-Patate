import { Component, inject, input, output } from '@angular/core';
import { DocumentosService } from '../../../../../core/services/documentos.service';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { DocumentoFirmado } from '../asamblea.model';

/** Ficha de un documento firmado ya registrado en el servidor, con acceso al archivo. */
@Component({
  selector: 'app-documento-firmado',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [titulo]="documento().titulo" subtitulo="Documento firmado registrado" icono="ri-shield-check-line" tono="success" tamano="sm" (cerrar)="cerrar.emit()">
      <div class="modal__body form-stack">
        <div class="file-tile">
          <span class="file-tile__icon" aria-hidden="true"><i class="ri-file-pdf-2-line"></i></span>
          <div class="file-tile__text">
            <strong>{{ documento().nombre }}</strong>
            <span class="badge badge--success"><i class="ri-checkbox-circle-fill" aria-hidden="true"></i> Verificado en el servidor</span>
          </div>
        </div>
        <p class="text-muted">
          El archivo firmado está almacenado y disponible para auditoría y respaldo legal de la Junta de Riego La Jones.
        </p>
      </div>
      <div class="modal__footer">
        <button type="button" class="btn btn--outline" (click)="cerrar.emit()">Cerrar</button>
        <button type="button" class="btn btn--primary" (click)="abrir()">
          <i class="ri-external-link-line" aria-hidden="true"></i> Abrir documento
        </button>
      </div>
    </app-modal>
  `
})
export class DocumentoFirmadoComponent {
  private documentos = inject(DocumentosService);

  readonly documento = input.required<DocumentoFirmado>();
  readonly cerrar = output<void>();

  abrir(): void {
    this.documentos.abrir(this.documento().url);
  }
}
