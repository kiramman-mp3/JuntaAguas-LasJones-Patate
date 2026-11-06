import { problemaConPassword } from './password-policy';

describe('política de contraseñas', () => {
  it('exige 10 caracteres con letras y números', () => {
    expect(problemaConPassword('Corta1')).toContain('10 caracteres');
    expect(problemaConPassword('soloLetrasAqui')).toContain('letras y números');
    expect(problemaConPassword('Riego-Patate-2026')).toBeNull();
  });

  it('rechaza contraseñas comunes aunque lleven números o símbolos', () => {
    for (const clave of ['password123', 'Qwerty12345', 'Junta2026!!', 'LaJones-2026']) {
      expect(problemaConPassword(clave)).toContain('demasiado común');
    }
  });

  it('rechaza la cédula y la contraseña actual', () => {
    expect(problemaConPassword('xyz1803456789abc', { cedula: '1803456789' })).toContain('cédula');
    expect(problemaConPassword('Canal-Matriz-0417', { actual: 'Canal-Matriz-0417' })).toContain(
      'distinta',
    );
  });
});
