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

  sectores = [
    { nombre: 'Sector Las Jones Alto', canal: 'Canal Matriz A', lotesCount: 42, caudal: '15.5 L/s' },
    { nombre: 'Sector Las Jones Centro', canal: 'Canal Secundario B', lotesCount: 68, caudal: '22.0 L/s' },
    { nombre: 'Sector Las Jones Bajo', canal: 'Canal Ramal C', lotesCount: 55, caudal: '18.2 L/s' }
  ];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.http.get<any>('http://localhost:3000/api/personas/stats').subscribe({
      next: (res) => {
        console.log('Stats recibidos del backend:', res);
        if (res && res.stats) {
          this.totalComuneros = res.stats.totalComuneros;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error obteniendo stats:', err);
        this.totalComuneros = 165; // fallback
        this.cdr.detectChanges();
      }
    });
  }
}
