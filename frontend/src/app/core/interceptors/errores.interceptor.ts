import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { mensajeAmigable } from '../utils/errores';

/**
 * Reescribe el mensaje de los errores HTTP para que lo lea una persona sin conocimientos técnicos
 * (sin conexión, error del servidor, datos inválidos con el nombre interno del campo). Los
 * componentes siguen leyendo `err.error.message` como siempre; el resto del cuerpo no cambia.
 */
export const erroresInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
      const cuerpo =
        error.error && typeof error.error === 'object' && !(error.error instanceof Blob)
          ? (error.error as { message?: string })
          : {};
      const mensaje = mensajeAmigable(error.status, cuerpo.message);
      if (mensaje === undefined || mensaje === cuerpo.message) return throwError(() => error);
      return throwError(
        () =>
          new HttpErrorResponse({
            error: { ...cuerpo, message: mensaje },
            headers: error.headers,
            status: error.status,
            statusText: error.statusText,
            url: error.url ?? undefined,
          }),
      );
    }),
  );
