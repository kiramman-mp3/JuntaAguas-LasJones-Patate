import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ROLES, session } from '../auth/session';

export interface LoginResponse {
  status: string;
  message: string;
  token: string;
  user: {
    cuentaId: number;
    personaId: number;
    cedula: string;
    nombres: string;
    apellidos: string;
    email: string;
    rol: 'ADMIN' | 'USUARIO';
    rolNombre: string;
    debeCambiarPassword: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  login(cedula: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { cedula, password }).pipe(
      tap(res => {
        if (res.token) session.guardar(res.token, res.user);
      })
    );
  }

  logout() {
    session.limpiar();
  }

  /**
   * Cambia la contraseña. El servidor revoca los tokens anteriores y devuelve uno nuevo
   * con acceso completo, que reemplaza al de la sesión.
   */
  changePassword(actualPassword: string, nuevaPassword: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/change-password`, { actualPassword, nuevaPassword }).pipe(
      tap(res => {
        if (res.token) session.guardar(res.token, res.user);
      })
    );
  }

  getToken(): string | null {
    return session.token();
  }

  getUser(): LoginResponse['user'] | null {
    return session.usuario<LoginResponse['user']>();
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /** La sesión tiene un token temporal que solo sirve para cambiar la contraseña. */
  debeCambiarPassword(): boolean {
    return this.getUser()?.debeCambiarPassword === true;
  }

  esAdmin(): boolean {
    return this.getUser()?.rol === ROLES.ADMIN;
  }
}
