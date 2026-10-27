import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse, SectorItem } from '../../core/models/api-payloads';
import { CurvasNivelComponent } from '../../shared/ui/curvas-nivel.component';
import { iniciales } from '../../core/utils/personas';
import { INFORMACION_JUNTA } from './informacion-junta.data';

/** Página pública con la información general de la Junta: quiénes son, directiva, sectores y contacto. */
@Component({
  selector: 'app-informacion',
  standalone: true,
  imports: [CurvasNivelComponent],
  templateUrl: './informacion.component.html',
  styleUrls: ['./informacion.component.scss'],
})
export class InformacionComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly info = INFORMACION_JUNTA;
  // Los sectores vienen de la API para mostrar siempre los registrados en el sistema.
  sectores: SectorItem[] = [];

  ngOnInit() {
    this.http.get<ApiResponse<SectorItem[]>>(`${environment.apiUrl}/lotes/sectores`).subscribe({
      next: (res) => {
        this.sectores = res?.data ?? [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar sectores:', err);
        this.cdr.detectChanges();
      },
    });
  }

  get totalLotes(): number {
    return this.sectores.reduce((suma, s) => suma + (Number(s.lotesCount) || 0), 0);
  }

  /** Proporción (0 a 1) de lotes del sector respecto al sector más grande: es el "nivel" de su barra. */
  nivel(sector: SectorItem): number {
    const mayor = Math.max(0, ...this.sectores.map((s) => Number(s.lotesCount) || 0));
    return mayor ? (Number(sector.lotesCount) || 0) / mayor : 0;
  }

  iniciales = iniciales;
}
