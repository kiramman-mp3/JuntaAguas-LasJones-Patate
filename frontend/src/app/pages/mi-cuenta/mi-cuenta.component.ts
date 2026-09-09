import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConsultaService, DeudaItem } from '../../core/services/consulta.service';
import { AuthService } from '../../core/services/auth.service';

interface UsuarioResultado {
  cedula: string;
  nombres: string;
  sector: string;
  loteCodigo: string;
  deudas: DeudaItem[];
}

@Component({
  selector: 'app-mi-cuenta',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mi-cuenta.component.html',
  styleUrls: ['./mi-cuenta.component.scss']
})
export class MiCuentaComponent implements OnInit {
  cargando: boolean = true;
  resultado: UsuarioResultado | null = null;
  errorMensaje: string = '';

  constructor(
    private consultaService: ConsultaService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    const user = this.authService.getUser();
    if (!user || !user.cedula) {
      this.router.navigate(['/login']);
      return;
    }

    this.consultarDatos(user.cedula);
  }

  consultarDatos(cedula: string) {
    this.cargando = true;
    this.errorMensaje = '';

    this.consultaService.consultarPorCedula(cedula).subscribe({
      next: (res) => {
        this.cargando = false;
        if (res && res.resultado) {
          this.resultado = res.resultado;
        }
      },
      error: (err) => {
        this.cargando = false;
        if (err.status === 404) {
          this.errorMensaje = 'No se encontró información financiera para su cuenta.';
        } else {
          this.errorMensaje = 'Error al cargar los datos. Intente más tarde.';
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

  cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
