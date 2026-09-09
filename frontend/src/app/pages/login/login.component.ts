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
  usuario: string = '';
  password: string = '';
  mostrarPassword: boolean = false;
  cargando: boolean = false;
  errorMensaje: string = '';
  
  // Flujo de cambio de contraseña
  requiereCambioPassword: boolean = false;
  nuevaPassword1: string = '';
  nuevaPassword2: string = '';
  exitoMensaje: string = '';

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
          if (res.user.debeCambiarPassword) {
             this.requiereCambioPassword = true;
          } else {
             this.redirigirPorRol(res.user.rol);
          }
        }
      },
      error: (err) => {
        this.cargando = false;
        if (err.error && err.error.message) {
          this.errorMensaje = err.error.message;
        }
      }
    });
  }

  redirigirPorRol(rol: string) {
    if (rol === 'ADMIN' || rol === 'SECRETARIO') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/consulta']);
    }
  }

  cambiarPassword() {
    if (this.nuevaPassword1.length < 6) {
       this.errorMensaje = 'La contraseña debe tener al menos 6 caracteres.';
       return;
    }
    if (this.nuevaPassword1 !== this.nuevaPassword2) {
       this.errorMensaje = 'Las contraseñas no coinciden.';
       return;
    }

    this.cargando = true;
    this.errorMensaje = '';

    this.authService.changePassword(this.password, this.nuevaPassword1).subscribe({
      next: () => {
         this.cargando = false;
         this.exitoMensaje = 'Contraseña actualizada. Redirigiendo...';
         const user = this.authService.getUser();
         setTimeout(() => {
           this.redirigirPorRol(user.rol);
         }, 1500);
      },
      error: (err) => {
         this.cargando = false;
         this.errorMensaje = err.error?.message || 'Error al cambiar contraseña.';
      }
    });
  }

  togglePassword() {
    this.mostrarPassword = !this.mostrarPassword;
  }
}
