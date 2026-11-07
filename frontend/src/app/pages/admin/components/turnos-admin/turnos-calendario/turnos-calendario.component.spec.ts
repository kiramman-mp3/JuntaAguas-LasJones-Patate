import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLORES_SECTOR, Turno, diaSemanaDe, indiceSector } from '../turno.model';
import { TurnosCalendarioComponent } from './turnos-calendario.component';

const turno = (id: number, dia: number, inicio: string, usuario: string, sector = 'La Merced') =>
  ({
    id,
    persona_id: id,
    lote_id: id,
    dia_semana: dia,
    dia: '',
    usuario,
    lote: `LJA-${id}`,
    sector,
    horaInicio: inicio,
    horaFin: '12:00',
  }) as Turno;

describe('Color por sector y día de la semana', () => {
  it('asigna un color estable a cada sector y los tres sectores actuales no se repiten', () => {
    const nombres = ['La Merced', 'Patate Viejo', 'San Javier'];
    const colores = nombres.map(indiceSector);
    expect(new Set(colores).size).toBe(3);
    expect(nombres.map(indiceSector)).toEqual(colores);
    for (const c of colores) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(COLORES_SECTOR);
    }
  });

  it('calcula el día de la semana de una fecha, con el domingo como 7', () => {
    expect(diaSemanaDe('2026-11-07')).toBe(6); // sábado
    expect(diaSemanaDe('2026-11-08')).toBe(7); // domingo
    expect(diaSemanaDe('2026-11-09')).toBe(1); // lunes
  });
});

describe('TurnosCalendarioComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Sábado 7 de noviembre de 2026, mediodía en Ecuador.
    vi.setSystemTime(new Date('2026-11-07T17:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  function crear(turnos: Turno[]) {
    const fixture = TestBed.createComponent(TurnosCalendarioComponent);
    fixture.componentRef.setInput('turnos', turnos);
    return fixture;
  }

  it('agrupa los turnos de cada día por hora de inicio y los ordena', () => {
    const { componentInstance: c } = crear([
      turno(1, 1, '07:00', 'Zoila Vera'),
      turno(2, 1, '05:00', 'Rosa Quispe'),
      turno(3, 1, '05:00', 'Ana Pérez'),
      turno(4, 2, '06:00', 'Luis Mora'),
    ]);
    const lunes = c.columnas()[0];
    expect(lunes.total).toBe(3);
    expect(lunes.grupos.map((g) => [g.hora, g.turnos.map((t) => t.usuario)])).toEqual([
      ['05:00', ['Ana Pérez', 'Rosa Quispe']],
      ['07:00', ['Zoila Vera']],
    ]);
    expect(c.columnas()[2].grupos).toEqual([]);
  });

  it('resalta solo la columna del día de hoy', () => {
    const { componentInstance: c } = crear([]);
    expect(
      c
        .columnas()
        .filter((d) => d.esHoy)
        .map((d) => d.dia.label),
    ).toEqual(['Sábado']);
  });

  it('pinta el borde de cada turno con el color de su sector y deja las acciones en la tarjeta', async () => {
    const fixture = crear([
      turno(1, 1, '05:00', 'Ana Pérez', 'La Merced'),
      turno(2, 1, '05:00', 'Luis Mora', 'San Javier'),
    ]);
    fixture.detectChanges();
    const tarjetas = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.shift'));
    expect(tarjetas[0].classList).toContain(`sector-${indiceSector('La Merced')}`);
    expect(tarjetas[1].classList).toContain(`sector-${indiceSector('San Javier')}`);
    expect(tarjetas[0].querySelectorAll('.shift__actions button').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.week__today').textContent).toContain('Hoy');
    expect(fixture.nativeElement.querySelector('.week__hour').textContent).toContain('05:00');
  });
});
