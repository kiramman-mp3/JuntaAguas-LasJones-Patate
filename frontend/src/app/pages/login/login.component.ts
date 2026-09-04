import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  usuario: string = 'admin';
  password: string = '123456';
  mostrarPassword: boolean = false;
  cargando: boolean = false;
  errorMensaje: string = '';

  constructor(private router: Router) {}

  iniciarSesion() {
    if (!this.usuario || !this.password) {
      this.errorMensaje = 'Por favor ingrese usuario y contraseña.';
      return;
    }

    this.cargando = true;
    this.errorMensaje = '';

    setTimeout(() => {
      this.cargando = false;
      // Navegar al Panel de Administración
      this.router.navigate(['/admin']);
    }, 500);
  }

  togglePassword() {
    this.mostrarPassword = !this.mostrarPassword;
  }
}
