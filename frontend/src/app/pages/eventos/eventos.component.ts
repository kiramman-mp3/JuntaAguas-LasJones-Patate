import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConsultaService } from '../../core/services/consulta.service';
import { ActasService } from '../../core/services/actas.service';
import { hoyEnEcuador } from '../../core/utils/fechas';
import { FechaLocalPipe } from '../../shared/pipes/fecha-local.pipe';

@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [CommonModule, FechaLocalPipe],
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
          const hoy = hoyEnEcuador();

          const eventos = res.data || res.eventos || [];
          eventos.forEach((ev: any) => {
            // Solo mostrar próximos eventos. Las fechas AAAA-MM-DD se comparan como texto, sin zona horaria.
            if (String(ev.fecha).slice(0, 10) >= hoy && ev.estado !== 'CANCELADO') {
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
