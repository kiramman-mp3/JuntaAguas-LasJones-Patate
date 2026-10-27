import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaApi } from '../models/api-payloads';

/** Noticia tal como la devuelve la API. La lista no incluye `descripcion_larga`; el detalle sí. */
export interface Noticia {
  id: number;
  titulo: string;
  descripcion_corta: string;
  descripcion_larga?: string;
  imagen_url: string;
  /** Fecha y hora de publicación en UTC. */
  publicada_en: string;
  tags: string[];
}

export interface PaginaNoticias {
  data: Noticia[];
  total: number;
  pagina: number;
  limite: number;
}

export interface FiltrosNoticias {
  q?: string;
  tag?: string;
  desde?: string;
  hasta?: string;
  pagina?: number;
  limite?: number;
}

export interface EtiquetaNoticia {
  etiqueta: string;
  cantidad: number;
}

/** Datos que escribe la directiva al publicar o editar una noticia. */
export interface DatosNoticia {
  titulo: string;
  descripcion_corta: string;
  descripcion_larga: string;
  tags: string[];
}

/** Límites que también valida el servidor; se usan para avisar antes de enviar. */
export const LIMITES_NOTICIA = {
  titulo: { min: 5, max: 160 },
  corta: { min: 10, max: 300 },
  larga: { min: 20, max: 10000 },
  etiqueta: { min: 2, max: 30 },
  etiquetas: 8,
} as const;

/** Noticias del portal: lectura pública y administración de la directiva. */
@Injectable({ providedIn: 'root' })
export class NoticiasService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/noticias`;

  listar(filtros: FiltrosNoticias = {}): Observable<PaginaNoticias> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return this.http.get<PaginaNoticias>(this.url, { params });
  }

  etiquetas(): Observable<EtiquetaNoticia[]> {
    return this.http
      .get<RespuestaApi<EtiquetaNoticia[]>>(`${this.url}/etiquetas`)
      .pipe(map((res) => res.data));
  }

  obtener(id: number): Observable<Noticia> {
    return this.http.get<RespuestaApi<Noticia>>(`${this.url}/${id}`).pipe(map((res) => res.data));
  }

  crear(datos: DatosNoticia, imagen: File): Observable<{ noticiaId: number; message: string }> {
    return this.http.post<{ noticiaId: number; message: string }>(
      this.url,
      this.formulario(datos, imagen),
    );
  }

  /** La imagen solo se envía si se eligió una nueva; si no, se conserva la actual. */
  actualizar(
    id: number,
    datos: DatosNoticia,
    imagen?: File | null,
  ): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.url}/${id}`, this.formulario(datos, imagen));
  }

  eliminar(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }

  /** URL absoluta de la imagen de una noticia ('/uploads/documentos/…'). */
  urlImagen(ruta: string): string {
    return /^https?:\/\//.test(ruta) ? ruta : `${environment.serverUrl}${ruta}`;
  }

  private formulario(datos: DatosNoticia, imagen?: File | null): FormData {
    const cuerpo = new FormData();
    cuerpo.append('titulo', datos.titulo);
    cuerpo.append('descripcion_corta', datos.descripcion_corta);
    cuerpo.append('descripcion_larga', datos.descripcion_larga);
    cuerpo.append('tags', JSON.stringify(datos.tags));
    if (imagen) cuerpo.append('archivo', imagen, imagen.name);
    return cuerpo;
  }
}
