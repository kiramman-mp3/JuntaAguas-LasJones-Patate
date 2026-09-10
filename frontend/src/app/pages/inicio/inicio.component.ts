import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss']
})
export class InicioComponent {


  sectores = [
    { nombre: 'Sector Las Jones Alto', canal: 'Canal Matriz A', lotesCount: 42, caudal: '15.5 L/s' },
    { nombre: 'Sector Las Jones Centro', canal: 'Canal Secundario B', lotesCount: 68, caudal: '22.0 L/s' },
    { nombre: 'Sector Las Jones Bajo', canal: 'Canal Ramal C', lotesCount: 55, caudal: '18.2 L/s' }
  ];
}
