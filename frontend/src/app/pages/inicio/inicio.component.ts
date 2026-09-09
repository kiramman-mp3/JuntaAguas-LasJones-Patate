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
  convocatorias = [
    {
      tipo: 'ASAMBLEA GENERAL',
      titulo: 'Asamblea General Ordinaria de Usuarios de Riego - Tercer Trimestre 2026',
      fecha: '2026-09-15',
      hora: '14:00 PM',
      lugar: 'Casa Comunal Junta La Jones - Patate',
      multa: '$10.00'
    },
    {
      tipo: 'MINGA COMUNITARIA',
      titulo: 'Minga de Limpieza y Mantenimiento de la Acequia Principal - Sector Las Jones',
      fecha: '2026-09-20',
      hora: '07:00 AM',
      lugar: 'Bocatoma Principal Acequia Jones',
      multa: '$15.00'
    }
  ];

  sectores = [
    { nombre: 'Sector Las Jones Alto', canal: 'Canal Matriz A', lotesCount: 42, caudal: '15.5 L/s' },
    { nombre: 'Sector Las Jones Centro', canal: 'Canal Secundario B', lotesCount: 68, caudal: '22.0 L/s' },
    { nombre: 'Sector Las Jones Bajo', canal: 'Canal Ramal C', lotesCount: 55, caudal: '18.2 L/s' }
  ];
}
