import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../../core/services/admin.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ROLES, Rol } from '../../../../../core/auth/session';
import { CredencialTemporal, PasswordTemporalComponent } from '../../../../../shared/password-temporal/password-temporal.component';
import { ModalComponent } from '../../../../../shared/ui/modal.component';

/**
 * Alta y edición de un comunero, con la gestión de su cuenta de acceso web.
 * Las contraseñas temporales se muestran una sola vez; al crear, el formulario
 * avisa que terminó (`guardado`) cuando el administrador confirma que la anotó.
 */
@Component({
  selector: 'app-comunero-form',
  standalone: true,
  imports: [FormsModule, LowerCasePipe, ModalComponent, PasswordTemporalComponent],
  templateUrl: './comunero-form.component.html'
})
export class ComuneroFormComponent implements OnInit {
  private admin = inject(AdminService);
  private dialog = inject(DialogService);
  private notify = inject(NotificationService);

  /** Comunero a editar; sin valor, el formulario registra uno nuevo. */
  readonly comunero = input<any | null>(null);
  readonly cerrar = output<void>();
  readonly guardado = output<void>();

  readonly guardando = signal(false);
  readonly gestionandoCuenta = signal(false);

  modoEdicion = false;
  /** Cuenta de acceso del comunero en edición (null si no tiene). */
  cuenta: { estado: string; rol: Rol } | null = null;
  /** Contraseña temporal recién generada, mostrada una sola vez. */
  credencialTemporal: CredencialTemporal | null = null;
  private creadoPendienteDeCierre = false;

  form = {
    id: null as number | null,
    cedula: '',
    nombres: '',
    apellidos: '',
    direccion: '',
    telefono: '',
    celular: '',
    email: '',
    fecha_nacimiento: '',
    estado: 'ACTIVO',
    crearCuenta: true,
    rol: ROLES.USUARIO as Rol
  };

  ngOnInit(): void {
    const u = this.comunero();
    if (!u) return;
    this.modoEdicion = true;
    this.cuenta = u.cuenta_estado ? { estado: u.cuenta_estado, rol: u.rol } : null;
    this.form = {
      id: u.id,
      nombres: u.nombres || '',
      apellidos: u.apellidos || '',
      cedula: u.cedula,
      direccion: u.direccion || '',
      telefono: u.telefono,
      celular: u.celular,
      email: u.email,
      fecha_nacimiento: u.fecha_nacimiento,
      estado: u.estado,
      crearCuenta: false,
      rol: ROLES.USUARIO
    };
  }

  guardar(): void {
    if (!this.form.cedula || !this.form.nombres || !this.form.apellidos) {
      this.notify.warning('Cédula, nombres y apellidos son obligatorios.');
      return;
    }
    this.guardando.set(true);

    if (this.modoEdicion && this.form.id) {
      this.admin.updatePersona(this.form.id, this.form).subscribe({
        next: () => {
          this.guardando.set(false);
          this.notify.success('Comunero actualizado.');
          this.guardado.emit();
        },
        error: (err) => {
          this.guardando.set(false);
          this.notify.error(err.error?.message || 'Error al actualizar comunero.');
        }
      });
      return;
    }

    this.admin.createPersona(this.form).subscribe({
      next: (res) => {
        this.guardando.set(false);
        this.notify.success('Comunero registrado.');
        if (res?.passwordTemporal) {
          this.creadoPendienteDeCierre = true;
          this.mostrarCredencial(res.passwordTemporal);
        } else {
          this.guardado.emit();
        }
      },
      error: (err) => {
        this.guardando.set(false);
        this.notify.error(err.error?.message || 'Error al registrar comunero.');
      }
    });
  }

  /** Crea la cuenta de acceso del comunero en edición. */
  crearCuenta(): void {
    if (!this.form.id || this.gestionandoCuenta()) return;
    this.gestionandoCuenta.set(true);
    this.admin.crearCuenta(this.form.id, this.form.rol).subscribe({
      next: (res) => {
        this.gestionandoCuenta.set(false);
        this.cuenta = { estado: 'ACTIVA', rol: this.form.rol };
        this.mostrarCredencial(res.passwordTemporal);
      },
      error: (err) => {
        this.gestionandoCuenta.set(false);
        this.notify.error(err.error?.message || 'No se pudo crear la cuenta.');
      }
    });
  }

  /** Genera una contraseña temporal nueva para el comunero en edición. */
  async restablecerPassword(): Promise<void> {
    if (!this.form.id || this.gestionandoCuenta()) return;
    const confirmado = await this.dialog.confirmar({
      tipo: 'WARNING',
      titulo: 'Restablecer contraseña',
      mensaje: `Se generará una contraseña temporal para ${this.form.nombres} ${this.form.apellidos} y su contraseña actual dejará de funcionar.`,
      textoConfirmar: 'Restablecer'
    });
    if (!confirmado) return;
    this.gestionandoCuenta.set(true);
    this.admin.restablecerPassword(this.form.id).subscribe({
      next: (res) => {
        this.gestionandoCuenta.set(false);
        this.mostrarCredencial(res.passwordTemporal);
      },
      error: (err) => {
        this.gestionandoCuenta.set(false);
        this.notify.error(err.error?.message || 'No se pudo restablecer la contraseña.');
      }
    });
  }

  cerrarCredencial(): void {
    this.credencialTemporal = null;
    if (this.creadoPendienteDeCierre) {
      this.creadoPendienteDeCierre = false;
      this.guardado.emit();
    }
  }

  /** Tras crear un comunero solo queda visible la credencial, no el formulario. */
  get ocultarFormulario(): boolean {
    return this.creadoPendienteDeCierre;
  }

  private mostrarCredencial(password: string): void {
    this.credencialTemporal = {
      nombre: `${this.form.nombres} ${this.form.apellidos}`.trim(),
      cedula: this.form.cedula,
      password
    };
  }
}
