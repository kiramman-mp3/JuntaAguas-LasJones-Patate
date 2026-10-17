import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { FechaLocalPipe } from '../../shared/pipes/fecha-local.pipe';
import { ApiResponse, EventoItem, SectorItem } from '../../core/models/api-payloads';

interface StatsPublicos {
  totalComuneros: number;
  totalLotes: number;
  totalSectores: number;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, FechaLocalPipe, RouterLink],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss']
})
export class InicioComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);

  totalComuneros = 0;
  proximosEventos: EventoItem[] = [];
  sectores: SectorItem[] = [];

  modalCronogramaAbierto = false;
  sectorCronograma: any = null;
  cargandoCronograma = false;
  nombreSectorModal = '';

  ngOnInit() {
    this.http.get<ApiResponse<StatsPublicos>>(`${environment.apiUrl}/personas/stats`).subscribe({
      next: (res) => {
        if (res?.data) {
          this.totalComuneros = res.data.totalComuneros;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        // Sin fallback hardcodeado: si la API no responde, se muestra 0.
        this.cdr.detectChanges();
      }
    });

    this.http.get<ApiResponse<EventoItem[]>>(`${environment.apiUrl}/eventos/publicos`).subscribe({
      next: (res) => {
        if (res?.data) {
          this.proximosEventos = res.data;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error cargando eventos:', err);
        this.cdr.detectChanges();
      }
    });

    this.http.get<ApiResponse<SectorItem[]>>(`${environment.apiUrl}/lotes/sectores`).subscribe({
      next: (res) => {
        if (res?.data) {
          this.sectores = res.data;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error al cargar sectores:', err);
        this.cdr.detectChanges();
      }
    });
  }

  verCronograma(sectorId: number, nombre: string) {
    this.nombreSectorModal = nombre;
    this.modalCronogramaAbierto = true;
    this.cargandoCronograma = true;
    this.sectorCronograma = null;

    this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/turnos/cronograma-publico?sector_id=${sectorId}`).subscribe({
      next: (res) => {
        this.cargandoCronograma = false;
        if (res?.data && res.data.length > 0) {
          this.sectorCronograma = res.data[0];
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargandoCronograma = false;
        console.error('Error cargando cronograma del sector:', err);
        this.cdr.detectChanges();
      }
    });
  }

  cerrarModalCronograma() {
    this.modalCronogramaAbierto = false;
    this.sectorCronograma = null;
  }
}
