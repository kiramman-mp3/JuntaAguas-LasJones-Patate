import { AfterViewInit, Component, ElementRef, OnDestroy, input, output, viewChild } from '@angular/core';
import * as L from 'leaflet';

/** Centro aproximado de Patate, Tungurahua. */
const CENTRO_PATATE: L.LatLngTuple = [-1.3121, -78.5085];

const ICONO = L.icon({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl: 'assets/leaflet/marker-icon.png',
  shadowUrl: 'assets/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

/**
 * Mapa de un lote. En modo editable un clic (o arrastrar el pin) emite la ubicación;
 * en modo lectura muestra el pin y el círculo del margen de error.
 * Usa su propio elemento (sin ids globales) y libera Leaflet al destruirse.
 */
@Component({
  selector: 'app-lotes-map',
  standalone: true,
  template: `<div #contenedor class="lote-map" [style.height.px]="alto()"></div>`
})
export class LotesMapComponent implements AfterViewInit, OnDestroy {
  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');

  readonly latitud = input<number | null>(null);
  readonly longitud = input<number | null>(null);
  readonly radioError = input(0);
  readonly editable = input(false);
  readonly alto = input(280);

  readonly ubicacion = output<{ lat: number; lng: number }>();

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private observador: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    const lat = this.latitud();
    const lng = this.longitud();
    const tieneUbicacion = lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng);
    const elemento = this.contenedor().nativeElement;

    this.map = L.map(elemento).setView(tieneUbicacion ? [lat, lng] : CENTRO_PATATE, tieneUbicacion ? 16 : 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    if (tieneUbicacion) {
      this.colocarMarcador(L.latLng(lat, lng));
      if (!this.editable() && this.radioError() > 0) {
        L.circle([lat, lng], { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.18, weight: 1.5, radius: this.radioError() }).addTo(this.map);
      }
    }

    if (this.editable()) {
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.colocarMarcador(e.latlng);
        this.ubicacion.emit({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }

    // Dentro de un modal el tamaño final llega tras la animación de entrada.
    if (typeof ResizeObserver !== 'undefined') {
      this.observador = new ResizeObserver(() => this.map?.invalidateSize());
      this.observador.observe(elemento);
    }
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    this.map?.remove();
    this.map = null;
    this.marker = null;
  }

  private colocarMarcador(posicion: L.LatLng): void {
    if (!this.map) return;
    if (this.marker) {
      this.marker.setLatLng(posicion);
      return;
    }
    this.marker = L.marker(posicion, { icon: ICONO, draggable: this.editable() }).addTo(this.map);
    if (this.editable()) {
      this.marker.on('dragend', () => {
        const p = this.marker!.getLatLng();
        this.ubicacion.emit({ lat: p.lat, lng: p.lng });
      });
    }
  }
}
