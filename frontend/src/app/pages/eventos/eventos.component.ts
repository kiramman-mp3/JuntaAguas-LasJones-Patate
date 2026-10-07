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

  descargarConvocatoria(ev: any) {
    if (ev.convocatoria_firmada_url) {
      this.consultaService.abrirDocumento(ev.convocatoria_firmada_url);
    } else {
      this.actasService.generarConvocatoriaPDF(ev);
    }
  }
}
