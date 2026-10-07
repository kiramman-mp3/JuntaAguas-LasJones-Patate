import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

@Component({
  selector: 'app-lotes-map',
  standalone: true,
  imports: [CommonModule],
  template: `<div #mapContainer class="map-container" style="height: 250px; width: 100%; border-radius: 8px; z-index: 1;"></div>`
})
export class LotesMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  
  // Coordenadas por defecto (Centro de Patate)
  @Input() latitud = -1.3121; 
  @Input() longitud = -78.5085;
  @Input() readonly = false; 
  
  @Output() locationSelected = new EventEmitter<{lat: number, lng: number}>();

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;

  ngOnInit() {
    // Configuración local segura de Iconos de Leaflet (sin usar CDNs)
    const iconDefault = L.icon({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = iconDefault;
  }

  ngAfterViewInit() {
    this.initMap();
    // Invalidar el tamaño para que se redimensione bien dentro de modales o pestañas
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 200);
  }

  private initMap() {
    this.map = L.map(this.mapContainer.nativeElement).setView([this.latitud, this.longitud], 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    this.marker = L.marker([this.latitud, this.longitud], {
      draggable: !this.readonly
    }).addTo(this.map);

    if (!this.readonly) {
      // Emitir cuando terminan de arrastrar el pin
      this.marker.on('dragend', () => {
        const position = this.marker!.getLatLng();
        this.locationSelected.emit({ lat: position.lat, lng: position.lng });
      });

      // Emitir y mover el pin al hacer click en el mapa
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.marker!.setLatLng(e.latlng);
        this.locationSelected.emit({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove(); // Limpieza para evitar memory leaks
      this.map = null;
      this.marker = null;
    }
  }
}
