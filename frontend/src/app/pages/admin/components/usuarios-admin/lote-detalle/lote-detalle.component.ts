import { Component, computed, input, output } from '@angular/core';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { LotesMapComponent } from '../../lotes-map/lotes-map.component';

/** Ficha de un lote: datos del catastro, propietarios vinculados y georreferenciación. */
@Component({
  selector: 'app-lote-detalle',
  standalone: true,
  imports: [ModalComponent, LotesMapComponent],
  template: `
    @let l = lote();
    <app-modal [titulo]="'Lote ' + l.codigo" [subtitulo]="l.sector_nombre" icono="ri-map-pin-2-line" tamano="md" (cerrar)="cerrar.emit()">
      <div class="modal__body form-stack">
        <dl class="fact-grid">
          <div><dt>Código</dt><dd class="fact-grid__big">{{ l.codigo }}</dd></div>
          <div><dt>Sector</dt><dd>{{ l.sector_nombre }}</dd></div>
          <div><dt>Superficie</dt><dd>{{ l.superficie_m2 ? l.superficie_m2 + ' m²' : 'No registrada' }}</dd></div>
        </dl>

        <section class="detail-section">
          <h4 class="detail-section__title"><i class="ri-user-star-line" aria-hidden="true"></i> Titular</h4>
          @if (l.propietario_nombre || propietarios().length) {
            <div class="ownership">
              <span class="ownership__value">100 %</span>
              <span class="ownership__text">
                <strong>{{ l.propietario_nombre || propietarios()[0] }}</strong>
                {{ l.tipo_relacion === 'REPRESENTANTE' ? 'Representante' : 'Propietario titular' }}{{ l.propietario_cedula ? ' · C.I. ' + l.propietario_cedula : '' }}
              </span>
            </div>
          } @else {
            <p class="text-muted small">El lote no tiene titular asignado ("Sin dueño").</p>
          }
        </section>

        <section class="detail-section">
          <h4 class="detail-section__title"><i class="ri-map-2-line" aria-hidden="true"></i> Georreferenciación</h4>
          @if (tieneUbicacion()) {
            <app-lotes-map [latitud]="lat()" [longitud]="lng()" [radioError]="l.radio_error_m || 5" [alto]="240" />
          }
          <dl class="kv-list">
            <div><dt>Coordenadas</dt><dd class="money">{{ l.latitud_aproximada || 'N/D' }}, {{ l.longitud_aproximada || 'N/D' }}</dd></div>
            <div><dt>Margen de error</dt><dd>±{{ l.radio_error_m || 5 }} m</dd></div>
            <div><dt>Referencia</dt><dd>{{ l.referencia_ubicacion || 'Sin referencia' }}</dd></div>
          </dl>
        </section>

        @if (l.observacion) {
          <section class="detail-section">
            <h4 class="detail-section__title"><i class="ri-file-text-line" aria-hidden="true"></i> Observaciones</h4>
            <p class="prewrap">{{ l.observacion }}</p>
          </section>
        }
      </div>
      <div class="modal__footer">
        @if (tieneUbicacion()) {
          <button type="button" class="btn btn--ghost" (click)="abrirGoogleMaps()">
            <i class="ri-google-fill" aria-hidden="true"></i> Ver en Google Maps
          </button>
        }
        <button type="button" class="btn btn--primary" (click)="cerrar.emit()">Cerrar</button>
      </div>
    </app-modal>
  `
})
export class LoteDetalleComponent {
  readonly lote = input.required<any>();
  readonly cerrar = output<void>();

  readonly propietarios = computed<string[]>(() => (this.lote().propietarios ? String(this.lote().propietarios).split(', ') : []));
  readonly lat = computed(() => parseFloat(this.lote().latitud_aproximada));
  readonly lng = computed(() => parseFloat(this.lote().longitud_aproximada));
  readonly tieneUbicacion = computed(() => !Number.isNaN(this.lat()) && !Number.isNaN(this.lng()));

  abrirGoogleMaps(): void {
    window.open(`https://www.google.com/maps?q=${this.lat()},${this.lng()}&t=k`, '_blank');
  }
}
