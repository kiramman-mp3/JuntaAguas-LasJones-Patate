import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

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
    rol: string;
    rolNombre: string;
    debeCambiarPassword: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private tokenKey = 'junta_token';
  private userKey = 'junta_user';

  constructor(private http: HttpClient) {}

  login(cedula: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { cedula, password }).pipe(
      tap(res => {
        if (res.token) {
          this.setItem(this.tokenKey, res.token);
          this.setItem(this.userKey, JSON.stringify(res.user));
        }
      })
    );
  }

  logout() {
    this.removeItem(this.tokenKey);
    this.removeItem(this.userKey);
  }

  changePassword(actualPassword: string, nuevaPassword: string): Observable<any> {
    const token = this.getToken();
    const headers = { Authorization: `Bearer ${token}` };
    return this.http.post(`${this.apiUrl}/change-password`, { actualPassword, nuevaPassword }, { headers });
  }

  getToken(): string | null {
    return this.getItem(this.tokenKey);
  }

  getUser() {
    const data = this.getItem(this.userKey);
    return data ? JSON.parse(data) : null;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /* Acceso seguro al almacenamiento: puede no existir en SSR o en pruebas. */
  private getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* almacenamiento no disponible */
    }
  }
}
