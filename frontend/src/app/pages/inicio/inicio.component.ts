import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss']
})
export class InicioComponent implements OnInit {
  totalComuneros: number = 0;
  proximosEventos: any[] = [];

  sectores: any[] = [];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.http.get<any>('http://localhost:3000/api/personas/stats').subscribe({
      next: (res) => {
        if (res && res.stats) {
          this.totalComuneros = res.stats.totalComuneros;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.totalComuneros = 165; // fallback
        this.cdr.detectChanges();
      }
    });

    this.http.get<any>('http://localhost:3000/api/eventos/publicos').subscribe({
      next: (res) => {
        if (res && res.eventos) {
          this.proximosEventos = res.eventos;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error cargando eventos:', err);
        this.cdr.detectChanges();
      }
    });

    this.http.get<any>('http://localhost:3000/api/lotes/sectores').subscribe({
      next: (res) => {
        if (res && res.data) {
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
}
