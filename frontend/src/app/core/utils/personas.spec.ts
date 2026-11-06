import {
  errorCedula,
  errorNacimiento,
  esCedulaValida,
  fechaMaximaNacimiento,
  iniciales,
} from './personas';

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

describe('fechaMaximaNacimiento y errorNacimiento', () => {
  const ahora = new Date('2026-11-06T17:00:00Z');

  it('el límite es la misma fecha de hace 18 años en el calendario de Ecuador', () => {
    expect(fechaMaximaNacimiento(ahora)).toBe('2008-11-06');
    // 02:00 UTC del día 7 todavía es el 6 en Ecuador (UTC-5).
    expect(fechaMaximaNacimiento(new Date('2026-11-07T02:00:00Z'))).toBe('2008-11-06');
  });

  it('acepta una fecha vacía, a los 18 años exactos y de una persona mayor', () => {
    expect(errorNacimiento('', ahora)).toBe('');
    expect(errorNacimiento('2008-11-06', ahora)).toBe('');
    expect(errorNacimiento('1980-05-20', ahora)).toBe('');
  });

  it('rechaza menores, fechas futuras y fechas anteriores a 1900', () => {
    expect(errorNacimiento('2008-11-07', ahora)).toContain('al menos 18 años');
    expect(errorNacimiento('2099-01-01', ahora)).toContain('al menos 18 años');
    expect(errorNacimiento('1899-12-31', ahora)).toContain('no es válida');
  });
});
