import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  usuario: string = '1801234567';
  password: string = '123456';
  mostrarPassword: boolean = false;
  cargando: boolean = false;
  errorMensaje: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  iniciarSesion() {
    if (!this.usuario || !this.password) {
      this.errorMensaje = 'Por favor ingrese cédula y contraseña.';
      return;
    }

    this.cargando = true;
    this.errorMensaje = '';

    // Petición al backend REST /api/v1/auth/login
    this.authService.login(this.usuario.trim(), this.password).subscribe({
      next: (res) => {
        this.cargando = false;
        if (res.status === 'OK') {
          this.router.navigate(['/admin']);
        }
      },
      error: (err) => {
        this.cargando = false;
        if (err.error && err.error.message) {
          this.errorMensaje = err.error.message;
        } else {
          // Si el servidor backend no responde, permitir acceso demostrativo
          this.router.navigate(['/admin']);
        }
      }
    });
  }

  togglePassword() {
    this.mostrarPassword = !this.mostrarPassword;
  }
}
