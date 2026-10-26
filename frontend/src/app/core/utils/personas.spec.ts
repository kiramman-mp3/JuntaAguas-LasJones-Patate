import { iniciales } from './personas';

describe('iniciales', () => {
  it('toma el primer nombre y el primer apellido', () => {
    expect(iniciales('Luis Alberto Paredes Moreta')).toBe('LP');
    expect(iniciales('Beatriz Elena Viteri Mayorga')).toBe('BV');
  });

  it('con tres palabras usa la segunda, y con una usa sus dos primeras letras', () => {
    expect(iniciales('Rosa Fanny Pazmiño')).toBe('RF');
    expect(iniciales('Cher')).toBe('CH');
  });

  it('tolera vacíos y espacios sobrantes', () => {
    expect(iniciales('')).toBe('');
    expect(iniciales(null)).toBe('');
    expect(iniciales('  Ana   María   Quispe   Toapanta ')).toBe('AQ');
  });
});
