import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule, FechaLocalPipe, RouterLink],
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
  sectorIdModal = 0;
  diaSeleccionadoModal = 'TODOS';
  busquedaModal = '';

  ngOnInit() {
    this.http.get<ApiResponse<StatsPublicos>>(`${environment.apiUrl}/personas/stats`).subscribe({
      next: (res) => {
        if (res?.data) {
          this.totalComuneros = res.data.totalComuneros;
          this.cdr.detectChanges();
        }
      },
      error: () => {
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
    this.sectorIdModal = sectorId;
    this.nombreSectorModal = nombre;
    this.modalCronogramaAbierto = true;
    this.cargandoCronograma = true;
    this.sectorCronograma = null;
    this.diaSeleccionadoModal = 'TODOS';
    this.busquedaModal = '';

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

  seleccionarDia(dia: string) {
    this.diaSeleccionadoModal = dia;
  }

  cambiarSectorModal(sectorId: number, nombre: string) {
    this.verCronograma(sectorId, nombre);
  }

  diasVisibles(): any[] {
    if (!this.sectorCronograma?.dias) return [];
    const query = this.busquedaModal.trim().toLowerCase();

    return this.sectorCronograma.dias
      .filter((d: any) => {
        if (this.diaSeleccionadoModal !== 'TODOS' && d.dia_nombre.toLowerCase() !== this.diaSeleccionadoModal.toLowerCase()) {
          return false;
        }
        return true;
      })
      .map((d: any) => {
        const turnosFiltrados = (d.turnos || []).filter((t: any) => {
          if (!query) return true;
          const nombre = (t.comunero_nombre || '').toLowerCase();
          const lote = (t.lote_codigo || '').toLowerCase();
          return nombre.includes(query) || lote.includes(query);
        });
        return {
          ...d,
          turnosFiltrados
        };
      })
      .filter((d: any) => d.turnosFiltrados.length > 0);
  }

  totalTurnosVisibles(): number {
    return this.diasVisibles().reduce((acc, d) => acc + d.turnosFiltrados.length, 0);
  }

  calcularDuracion(horaInicio: string, horaFin: string): string {
    if (!horaInicio || !horaFin) return '';
    const [h1, m1] = horaInicio.split(':').map(Number);
    const [h2, m2] = horaFin.split(':').map(Number);
    let diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMin <= 0) diffMin += 24 * 60;
    const horas = Math.floor(diffMin / 60);
    const minutos = diffMin % 60;
    if (minutos === 0) return `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
    return `${horas}h ${minutos}m`;
  }

  obtenerFranjaHoraria(horaInicio: string): { icono: string; texto: string; clase: string } {
    if (!horaInicio) return { icono: 'ri-time-line', texto: 'Horario', clase: 'franja-dia' };
    const hora = parseInt(horaInicio.split(':')[0], 10);
    if (hora < 12) {
      return { icono: 'ri-sun-cloudy-line', texto: 'Mañana', clase: 'franja-manana' };
    } else if (hora < 18) {
      return { icono: 'ri-sun-fill', texto: 'Tarde', clase: 'franja-tarde' };
    } else {
      return { icono: 'ri-moon-clear-fill', texto: 'Noche', clase: 'franja-noche' };
    }
  }

  imprimirCronograma() {
    window.print();
  }

  cerrarModalCronograma() {
    this.modalCronogramaAbierto = false;
    this.sectorCronograma = null;
  }
}
