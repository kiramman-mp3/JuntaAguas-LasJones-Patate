import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface DeudaItem {
  id: number;
  concepto: string;
  anio: number;
  periodo: string;
  valor: number;
  estado: 'PENDIENTE' | 'PAGADA';
  fechaEmision: string;
}

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

  // Datos mock para demostración de búsqueda
  mockDatabase: Record<string, UsuarioResultado> = {
    '1801234567': {
      cedula: '1801234567',
      nombres: 'Juan Carlos Morales Soria',
      sector: 'Sector Las Jones Alto',
      loteCodigo: 'LOT-JONES-A04',
      deudas: [
        { id: 101, concepto: 'Agua de Riego - Mensual', anio: 2026, periodo: 'Agosto', valor: 10.00, estado: 'PENDIENTE', fechaEmision: '2026-08-01' },
        { id: 102, concepto: 'Multa por Inasistencia a Asamblea Ordinaria', anio: 2026, periodo: 'Julio (Asamblea #2)', valor: 10.00, estado: 'PENDIENTE', fechaEmision: '2026-07-15' },
        { id: 103, concepto: 'Multa por Inasistencia a Minga de Limpieza', anio: 2026, periodo: 'Agosto (Minga #1)', valor: 15.00, estado: 'PENDIENTE', fechaEmision: '2026-08-20' },
        { id: 104, concepto: 'Agua de Riego - Mensual', anio: 2026, periodo: 'Julio', valor: 10.00, estado: 'PAGADA', fechaEmision: '2026-07-01' }
      ]
    },
    '1809876543': {
      cedula: '1809876543',
      nombres: 'María Elena Salazar Tamayo',
      sector: 'Sector Las Jones Centro',
      loteCodigo: 'LOT-JONES-C12',
      deudas: []
    }
  };

  buscarCedula() {
    if (!this.cedulaInput.trim()) return;

    this.cargando = true;
    this.buscado = false;

    setTimeout(() => {
      this.cargando = false;
      this.buscado = true;

      const found = this.mockDatabase[this.cedulaInput.trim()];
      if (found) {
        this.resultado = found;
      } else {
        // Generar un resultado de prueba dinámico
        this.resultado = {
          cedula: this.cedulaInput.trim(),
          nombres: 'Usuario Registrado de Prueba',
          sector: 'Sector Las Jones Bajo',
          loteCodigo: 'LOT-JONES-B22',
          deudas: [
            { id: 201, concepto: 'Agua de Riego - Mensual', anio: 2026, periodo: 'Agosto', valor: 10.00, estado: 'PENDIENTE', fechaEmision: '2026-08-01' },
            { id: 202, concepto: 'Multa por Inasistencia a Minga', anio: 2026, periodo: 'Agosto', valor: 15.00, estado: 'PENDIENTE', fechaEmision: '2026-08-22' }
          ]
        };
      }
    }, 600);
  }

  get totalPendiente(): number {
    if (!this.resultado) return 0;
    return this.resultado.deudas
      .filter(d => d.estado === 'PENDIENTE')
      .reduce((sum, d) => sum + d.valor, 0);
  }
}
