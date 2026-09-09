import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConsultaService } from '../../core/services/consulta.service';
import { ActasService } from '../../core/services/actas.service';

@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './eventos.component.html',
  styleUrls: ['./eventos.component.scss']
})
export class EventosComponent implements OnInit {
  eventosFuturos: any[] = [];
  eventosPasados: any[] = [];
  tabActivo: 'FUTUROS' | 'PASADOS' = 'FUTUROS';
  cargandoActa: boolean = false;

  constructor(private consultaService: ConsultaService, private actasService: ActasService) {}

  ngOnInit() {
    this.consultaService.getEventosPublicos().subscribe({
      next: (res) => {
        if (res.status === 'OK') {
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);

          res.data.forEach((ev: any) => {
            const fechaEv = new Date(ev.fecha);
            fechaEv.setHours(0, 0, 0, 0);

            if (fechaEv >= hoy) {
              this.eventosFuturos.push(ev);
            } else {
              this.eventosPasados.push(ev);
            }
          });
        }
      },
      error: (err) => console.error('Error al cargar eventos', err)
    });
  }

  setTab(tab: 'FUTUROS' | 'PASADOS') {
    this.tabActivo = tab;
  }

  descargarActa(id: number) {
    this.cargandoActa = true;
    this.consultaService.getEventoDetalle(id).subscribe({
      next: (res) => {
        this.cargandoActa = false;
        if (res.status === 'OK') {
           this.actasService.generarActaPDF(res.evento, res.puntos || [], res.asistenciaStats);
        }
      },
      error: (err) => {
        this.cargandoActa = false;
        console.error('Error al descargar acta', err);
        alert('No se pudo descargar el acta del evento.');
      }
    });
  }
}
