import { errorHorarioTurno } from './turnos';

describe('errorHorarioTurno', () => {
  it('acepta turnos del mismo día y los que cruzan la medianoche hasta 12 horas', () => {
    expect(errorHorarioTurno('08:00', '10:00')).toBeNull();
    expect(errorHorarioTurno('22:00', '02:00')).toBeNull();
    expect(errorHorarioTurno('20:00', '08:00')).toBeNull();
  });

  it('rechaza horas iguales y cruces de medianoche de más de 12 horas', () => {
    expect(errorHorarioTurno('10:00', '10:00')).toMatch(/igual/);
    expect(errorHorarioTurno('10:00', '09:00')).toMatch(/12 horas/);
    expect(errorHorarioTurno('20:00', '08:01')).toMatch(/12 horas/);
  });
});
