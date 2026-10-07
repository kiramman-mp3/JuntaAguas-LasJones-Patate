import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let servicio: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    servicio = new NotificationService();
  });

  afterEach(() => vi.useRealTimers());

  it('cierra los avisos solos, dando más tiempo a los errores', () => {
    servicio.success('Guardado');
    servicio.error('Falló');
    vi.advanceTimersByTime(4500);
    expect(servicio.toasts().map((t) => t.mensaje)).toEqual(['Falló']);
    vi.advanceTimersByTime(3000);
    expect(servicio.toasts()).toEqual([]);
  });

  it('no apila el mismo mensaje dos veces y reinicia su tiempo', () => {
    servicio.success('Guardado');
    vi.advanceTimersByTime(3000);
    servicio.success('Guardado');
    expect(servicio.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(servicio.toasts()).toHaveLength(1);
  });

  it('pausa el temporizador mientras el usuario lee el aviso', () => {
    servicio.info('Leyendo');
    const id = servicio.toasts()[0].id;
    servicio.pausar(id);
    vi.advanceTimersByTime(20000);
    expect(servicio.toasts()).toHaveLength(1);
    servicio.reanudar(id);
    vi.advanceTimersByTime(6000);
    expect(servicio.toasts()).toHaveLength(0);
  });

  it('limita la pila a cuatro avisos visibles', () => {
    for (let i = 0; i < 6; i++) servicio.info(`Aviso ${i}`);
    expect(servicio.toasts().map((t) => t.mensaje)).toEqual(['Aviso 2', 'Aviso 3', 'Aviso 4', 'Aviso 5']);
  });
});
