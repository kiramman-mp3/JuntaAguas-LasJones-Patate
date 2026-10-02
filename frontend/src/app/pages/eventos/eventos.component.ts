import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  asambleasFuturas: any[] = [];
  mingasFuturas: any[] = [];
  tabActivo: 'ASAMBLEA' | 'MINGA' = 'ASAMBLEA';
  cargandoActa: boolean = false;

  constructor(private consultaService: ConsultaService, private actasService: ActasService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.consultaService.getEventosPublicos().subscribe({
      next: (res) => {
        if (res.status === 'OK') {
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);

          const eventos = res.data || res.eventos || [];
          eventos.forEach((ev: any) => {
            const fechaEv = new Date(ev.fecha);
            fechaEv.setHours(0, 0, 0, 0);

            // Solo mostrar próximos eventos
            if (fechaEv >= hoy && ev.estado !== 'CANCELADO') {
              if (ev.tipo === 'MINGA') {
                this.mingasFuturas.push(ev);
              } else {
                this.asambleasFuturas.push(ev);
              }
            }
          });
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error al cargar eventos', err);
        this.cdr.detectChanges();
      }
    });
  }

  setTab(tab: 'ASAMBLEA' | 'MINGA') {
    this.tabActivo = tab;
  }

  abrirPdf(url: string) {
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
    window.open(fullUrl, '_blank');
  }

  descargarConvocatoria(ev: any) {
    if (ev.convocatoria_firmada_url) {
      this.abrirPdf(ev.convocatoria_firmada_url);
    } else {
      this.actasService.generarConvocatoriaPDF(ev);
    }
  }

  descargarListaAsistencia(ev: any) {
    if (ev.lista_asistencia_firmada_url) {
      this.abrirPdf(ev.lista_asistencia_firmada_url);
    } else if (ev.lista_asistencia_url) {
      this.abrirPdf(ev.lista_asistencia_url);
    } else {
      window.open(`http://localhost:3000/api/eventos/${ev.id}/pdf-asistencia`, '_blank');
    }
  }
}
