import { errorCedula, esCedulaValida, iniciales } from './personas';

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

describe('esCedulaValida', () => {
  it('acepta cédulas con dígito verificador correcto', () => {
    expect(esCedulaValida('1710034065')).toBe(true);
    expect(esCedulaValida('0926687856')).toBe(true);
  });

  it('rechaza dígito verificador, provincia o tercer dígito inválidos y formatos incorrectos', () => {
    expect(esCedulaValida('1710034066')).toBe(false);
    expect(esCedulaValida('2510034065')).toBe(false);
    expect(esCedulaValida('1768034065')).toBe(false);
    expect(esCedulaValida('171003406')).toBe(false);
    expect(esCedulaValida('17100340651')).toBe(false);
    expect(esCedulaValida('17100A4065')).toBe(false);
  });
});

describe('errorCedula', () => {
  it('no reprocha una cédula vacía ni una a medio escribir', () => {
    expect(errorCedula('')).toBe('');
    expect(errorCedula('171003')).toBe('');
  });

  it('avisa de letras, exceso de dígitos y verificador incorrecto', () => {
    expect(errorCedula('17a')).toContain('números');
    expect(errorCedula('17100340651')).toContain('10 dígitos');
    expect(errorCedula('1710034066')).toContain('no es una cédula');
    expect(errorCedula('1710034065')).toBe('');
  });
});
