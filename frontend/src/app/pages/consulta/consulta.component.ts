import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConsultaService, DeudaItem } from '../../core/services/consulta.service';

interface UsuarioResultado {
  cedula: string;
  nombres: string;
  sector: string;
  loteCodigo: string;
  deudas: DeudaItem[];
}

@Component({
  selector: 'app-consulta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consulta.component.html',
  styleUrls: ['./consulta.component.scss']
})
export class ConsultaComponent {
  cedulaInput: string = '';
  buscado: boolean = false;
  cargando: boolean = false;
  resultado: UsuarioResultado | null = null;
  errorMensaje: string = '';

  constructor(private consultaService: ConsultaService) {}

  buscarCedula() {
    if (!this.cedulaInput.trim()) return;

    this.cargando = true;
    this.buscado = false;
    this.resultado = null;
    this.errorMensaje = '';

    const cedula = this.cedulaInput.trim();

    // Conexión directa a la API REST Backend
    this.consultaService.consultarPorCedula(cedula).subscribe({
      next: (res) => {
        this.cargando = false;
        this.buscado = true;
        if (res && res.resultado) {
          this.resultado = res.resultado;
        }
      },
      error: (err) => {
        this.cargando = false;
        this.buscado = true;
        if (err.status === 404) {
          this.errorMensaje = 'No se encontró ningún comunero registrado con la cédula ingresada.';
        } else {
          // Si el servidor backend no responde, mostrar datos de demostración
          this.resultado = {
            cedula: cedula,
            nombres: 'Comunero de Prueba (Modo Sin Conexión)',
            sector: 'Sector Las Jones Alto',
            loteCodigo: 'LOT-JONES-A04',
            deudas: [
              { id: 101, concepto: 'Agua de Riego - Mensual', anio: 2026, periodo: 'Agosto', valor: 10.00, estado: 'PENDIENTE', fechaEmision: '2026-08-01' },
              { id: 103, concepto: 'Multa por Inasistencia a Minga', anio: 2026, periodo: 'Minga #1', valor: 15.00, estado: 'PENDIENTE', fechaEmision: '2026-08-20' }
            ]
          };
        }
      }
    });
  }

  get totalPendiente(): number {
    if (!this.resultado) return 0;
    return this.resultado.deudas
      .filter(d => d.estado === 'PENDIENTE')
      .reduce((sum, d) => sum + Number(d.valor), 0);
  }
}
