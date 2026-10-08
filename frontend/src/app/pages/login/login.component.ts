import { Component, ChangeDetectorRef, OnInit, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ROLES } from '../../core/auth/session';
import { HttpErrorResponse } from '@angular/common/http';
import { REQUISITOS_PASSWORD, problemaConPassword } from '../../core/auth/password-policy';

/**
 * Mensaje para el usuario según el error HTTP. Sin respuesta (status 0) el problema es la red
 * o el servidor apagado, no las credenciales: se dice así para que no reintente la contraseña.
 */
export function mensajeDeError(err: HttpErrorResponse, porDefecto: string): string {
  if (err.status === 0)
    return 'No hay conexión con el servidor. Revise su conexión a internet e intente de nuevo.';
  if (err.error?.message) return err.error.message;
  if (err.status === 429) return 'Demasiados intentos. Espere unos minutos e intente de nuevo.';
  if (err.status >= 500) return 'El servidor tuvo un problema. Intente de nuevo en unos minutos.';
  return porDefecto;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  usuario = '';
  password = '';
  mostrarPassword = false;
  cargando = false;
  errorMensaje = '';
  recordarSesion = true;
  mostrarAyudaPassword = false;

  // Flujo de cambio de contraseña
  requiereCambioPassword = false;
  nuevaPassword1 = '';
  nuevaPassword2 = '';
  /** Contraseña temporal; se pide si la sesión se retomó sin pasar por el formulario de ingreso. */
  passwordActual = '';
  exitoMensaje = '';
  readonly requisitosPassword = REQUISITOS_PASSWORD;

  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    if (!this.authService.isLoggedIn()) return;
    if (this.authService.debeCambiarPassword()) {
      this.requiereCambioPassword = true;
    } else {
      this.redirigirPorRol(this.authService.getUser()?.rol ?? ROLES.USUARIO);
    }
  }

  iniciarSesion() {
    if (!this.usuario || !this.password) {
      this.errorMensaje = 'Por favor ingrese cédula y contraseña.';
      return;
    }

    this.cargando = true;
    this.errorMensaje = '';

    // Petición al backend REST /api/v1/auth/login
    this.authService.login(this.usuario.trim(), this.password, this.recordarSesion).subscribe({
      next: (res) => {
        this.cargando = false;
        if (res.status === 'OK') {
          if (res.user.debeCambiarPassword) {
            this.requiereCambioPassword = true;
            this.passwordActual = this.password;
          } else {
            this.redirigirPorRol(res.user.rol);
          }
        }
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.cargando = false;
        this.errorMensaje = mensajeDeError(err, 'No se pudo iniciar sesión. Intente de nuevo.');
        this.cdr.detectChanges();
      },
    });
  }

  redirigirPorRol(rol: string) {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
      return;
    }
    if (rol === ROLES.ADMIN) {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/mi-cuenta']);
    }
  }

  cambiarPassword() {
    const problema = !this.passwordActual
      ? 'Ingrese la contraseña temporal que le entregaron.'
      : problemaConPassword(this.nuevaPassword1, {
          cedula: this.authService.getUser()?.cedula,
          actual: this.passwordActual,
        });
    if (problema) {
      this.errorMensaje = problema;
      return;
    }
    if (this.nuevaPassword1 !== this.nuevaPassword2) {
      this.errorMensaje = 'Las contraseñas no coinciden.';
      return;
    }

    this.cargando = true;
    this.errorMensaje = '';

    // El servidor devuelve un token nuevo con acceso completo; AuthService lo guarda.
    this.authService.changePassword(this.passwordActual, this.nuevaPassword1).subscribe({
      next: (res) => {
        this.cargando = false;
        this.exitoMensaje = 'Contraseña actualizada. Redirigiendo...';
        this.passwordActual = this.password = this.nuevaPassword1 = this.nuevaPassword2 = '';
        this.cdr.detectChanges();
        setTimeout(() => this.redirigirPorRol(res.user.rol), 1200);
      },
      error: (err) => {
        this.cargando = false;
        this.errorMensaje = mensajeDeError(
          err,
          'No se pudo cambiar la contraseña. Intente de nuevo.',
        );
        this.cdr.detectChanges();
      },
    });
  }

  /** Abandona el cambio de contraseña y vuelve al formulario de ingreso. */
  cancelarCambioPassword() {
    this.authService.logout();
    this.requiereCambioPassword = false;
    this.password = this.passwordActual = this.nuevaPassword1 = this.nuevaPassword2 = '';
    this.errorMensaje = '';
  }

  togglePassword() {
    this.mostrarPassword = !this.mostrarPassword;
  }

  alternarAyudaPassword() {
    this.mostrarAyudaPassword = !this.mostrarAyudaPassword;
  }
}
