import { aFecha, aFechaIso, formatearFecha, hoyEnEcuador } from './fechas';

describe('fechas de la Junta', () => {
  it('una fecha AAAA-MM-DD se muestra el mismo día, sin restar un día por la zona horaria', () => {
    expect(formatearFecha('2026-10-05')).toBe('05/10/2026');
    expect(formatearFecha('2026-01-01', 'mesAnio')).toContain('2026');
    expect(formatearFecha('2026-01-01', 'mesAnio').toLowerCase()).toContain('enero');
  });

  it('aFecha conserva el día de calendario', () => {
    const fecha = aFecha('2026-03-01')!;
    expect([fecha.getFullYear(), fecha.getMonth(), fecha.getDate()]).toEqual([2026, 2, 1]);
    expect(aFechaIso(fecha)).toBe('2026-03-01');
    expect(aFecha('')).toBeNull();
    expect(aFecha('no es fecha')).toBeNull();
  });

  it('un instante se muestra en la hora de Ecuador', () => {
    // 03:30 UTC del 6 de octubre son las 22:30 del 5 de octubre en Ecuador.
    expect(formatearFecha('2026-10-06T03:30:00.000Z', 'conHora')).toMatch(/05\/10\/2026.*22:30/);
  });

  it('hoy se calcula en la zona de la Junta', () => {
    expect(hoyEnEcuador(new Date('2026-10-06T03:30:00Z'))).toBe('2026-10-05');
    expect(hoyEnEcuador(new Date('2026-10-06T05:30:00Z'))).toBe('2026-10-06');
  });
});
