import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

export type TipoDocumento = 'CONVOCATORIA' | 'ACTA' | 'RESOLUCION' | 'OTRO';

export interface DocumentoSubido {
  status: string;
  message: string;
  url: string;
  nombre_archivo: string;
  punto_id: number | null;
}

export const TIPOS_ARCHIVO_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];
export const TAMANO_MAXIMO_ARCHIVO = 10 * 1024 * 1024;

/**
 * Subida y apertura de documentos firmados.
 * Los archivos se piden con HttpClient (llevan el token) y se muestran como blob,
 * porque una pestaña abierta con window.open no puede enviar la cabecera Authorization.
 */
@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  /** Devuelve un mensaje si el archivo no es aceptable, o null si es válido. */
  validarArchivo(archivo: File | undefined | null): string | null {
    if (!archivo || archivo.size === 0) return 'Seleccione un archivo.';
    if (!TIPOS_ARCHIVO_PERMITIDOS.includes(archivo.type)) return 'Seleccione un PDF o una imagen JPG/PNG.';
    if (archivo.size > TAMANO_MAXIMO_ARCHIVO) return 'El archivo supera los 10 MB permitidos.';
    return null;
  }

  subir(eventoId: number, tipo: TipoDocumento, archivo: File, puntoId?: number): Observable<DocumentoSubido> {
    const datos = new FormData();
    datos.append('tipo', tipo);
    if (puntoId) datos.append('punto_id', String(puntoId));
    datos.append('archivo', archivo, archivo.name);
    return this.http.post<DocumentoSubido>(`${environment.apiUrl}/eventos/${eventoId}/documentos`, datos, { headers: this.headers() });
  }

  /** URL absoluta de un documento guardado ('/uploads/...' o ya absoluta). */
  urlAbsoluta(ruta: string): string {
    return /^https?:\/\//.test(ruta) ? ruta : `${environment.serverUrl}${ruta}`;
  }

  /** Abre un documento subido en una pestaña nueva. */
  abrir(ruta: string | null | undefined): void {
    if (!ruta) return;
    this.abrirBlob(this.urlAbsoluta(ruta));
  }

  /** Abre el padrón de asistencia en PDF generado por el servidor. */
  abrirListaAsistencia(eventoId: number): void {
    this.abrirBlob(`${environment.apiUrl}/eventos/${eventoId}/pdf-asistencia`);
  }

  private abrirBlob(url: string): void {
    // La pestaña se abre en el gesto del usuario para que el navegador no la bloquee.
    const ventana = window.open('', '_blank');
    this.http.get(url, { headers: this.headers(), responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objeto = URL.createObjectURL(blob);
        if (ventana) ventana.location.href = objeto;
        else window.location.assign(objeto);
        setTimeout(() => URL.revokeObjectURL(objeto), 60_000);
      },
      error: (error: HttpErrorResponse) => {
        ventana?.close();
        const mensaje = error.status === 404 ? 'El documento ya no está disponible.'
          : error.status === 401 || error.status === 403 ? 'No tiene permiso para ver este documento.'
          : 'No se pudo abrir el documento.';
        this.notify.error(mensaje);
      }
    });
  }

  private headers(): HttpHeaders {
    const token = this.auth.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
