import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { erroresInterceptor } from '../interceptors/errores.interceptor';
import { mensajeAmigable } from './errores';

describe('mensajeAmigable', () => {
  it('explica la falta de conexión y los errores del servidor sin tecnicismos', () => {
    expect(mensajeAmigable(0, undefined)).toContain('Revise su conexión a internet');
    const caido = mensajeAmigable(500, 'Error interno del servidor.');
    expect(caido).toContain('avise a la directiva');
    expect(caido).not.toContain('Error interno');
  });

  it('conserva el mensaje de la API, incluido el de demasiados intentos', () => {
    expect(mensajeAmigable(409, 'La cédula ya está registrada.')).toBe(
      'La cédula ya está registrada.',
    );
    expect(mensajeAmigable(429, 'Demasiados intentos. Espere 15 minutos.')).toBe(
      'Demasiados intentos. Espere 15 minutos.',
    );
    expect(mensajeAmigable(429, undefined)).toContain('demasiados intentos');
  });

  it('cambia el nombre interno del campo por el que ve el usuario', () => {
    expect(
      mensajeAmigable(400, 'celular: El celular debe tener 10 dígitos y empezar con 09.'),
    ).toBe('Celular: El celular debe tener 10 dígitos y empezar con 09.');
    expect(mensajeAmigable(400, 'hora_inicio: Required')).toBe('Hora de inicio es obligatorio.');
    expect(mensajeAmigable(400, 'puntos.0.titulo: Invalid input')).toBe(
      'Título no tiene un valor válido.',
    );
    expect(mensajeAmigable(400, 'campo_raro: Required')).toBe('Campo raro es obligatorio.');
  });

  it('deja intacto un mensaje sin campo y no inventa nada si no hay mensaje', () => {
    expect(mensajeAmigable(400, 'Datos de entrada inválidos.')).toBe('Datos de entrada inválidos.');
    expect(mensajeAmigable(404, undefined)).toBeUndefined();
  });
});

describe('erroresInterceptor', () => {
  const peticion = new HttpRequest('GET', '/api/x');

  function fallar(error: unknown): Promise<HttpErrorResponse> {
    return TestBed.runInInjectionContext(() =>
      firstValueFrom(erroresInterceptor(peticion, () => throwError(() => error))).then(
        () => {
          throw new Error('la petición debía fallar');
        },
        (e: unknown) => e as HttpErrorResponse,
      ),
    );
  }

  it('reescribe el mensaje y conserva el resto del cuerpo y el estado', async () => {
    const original = new HttpErrorResponse({
      status: 500,
      error: { status: 'ERROR', message: 'Error interno del servidor.', requestId: 'abc' },
    });
    const resultado = await fallar(original);
    expect(resultado.status).toBe(500);
    expect(resultado.error.requestId).toBe('abc');
    expect(resultado.error.message).toContain('avise a la directiva');
  });

  it('crea el mensaje cuando no hay respuesta del servidor', async () => {
    const resultado = await fallar(
      new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }),
    );
    expect(resultado.error.message).toContain('No hay conexión con el servidor');
  });

  it('no toca los errores que ya traen un mensaje claro', async () => {
    const original = new HttpErrorResponse({ status: 409, error: { message: 'Ya existe.' } });
    expect(await fallar(original)).toBe(original);
  });

  it('deja pasar tal cual un error que no viene de una respuesta HTTP', async () => {
    const raro = new Error('fallo local');
    expect(await fallar(raro)).toBe(raro);
  });
});
