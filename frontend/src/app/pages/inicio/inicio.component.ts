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
    if (horas === 0) return `${minutos} minutos`;
    return `${horas} hora${horas > 1 ? 's' : ''} y ${minutos} min`;
  }

  obtenerFranjaHoraria(horaInicio: string): { icono: string; texto: string; textoLargo: string; clase: string } {
    if (!horaInicio) {
      return { icono: 'ri-time-line', texto: 'Horario', textoLargo: 'Turno programado', clase: 'franja-dia' };
    }
    const hora = parseInt(horaInicio.split(':')[0], 10);
    if (hora >= 5 && hora < 12) {
      return { icono: 'ri-sun-cloudy-fill', texto: 'Mañana', textoLargo: 'Turno en la Mañana', clase: 'franja-manana' };
    } else if (hora >= 12 && hora < 18) {
      return { icono: 'ri-sun-fill', texto: 'Tarde', textoLargo: 'Turno en la Tarde', clase: 'franja-tarde' };
    } else {
      return { icono: 'ri-moon-clear-fill', texto: 'Noche', textoLargo: 'Turno en la Noche', clase: 'franja-noche' };
    }
  }

  formatearMomento(horaStr: string): string {
    if (!horaStr) return '';
    const parts = horaStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    const minStr = m > 0 ? `:${m < 10 ? '0' + m : m}` : ':00';
    if (h === 0) return `12${minStr} de la noche`;
    if (h > 0 && h < 6) return `${h}${minStr} de la madrugada`;
    if (h >= 6 && h < 12) return `${h}${minStr} de la mañana`;
    if (h === 12) return `12${minStr} del mediodía`;
    if (h > 12 && h < 19) return `${h - 12}${minStr} de la tarde`;
    return `${h - 12}${minStr} de la noche`;
  }

  imprimirCronograma() {
    window.print();
  }

  cerrarModalCronograma() {
    this.modalCronogramaAbierto = false;
    this.sectorCronograma = null;
  }
}
