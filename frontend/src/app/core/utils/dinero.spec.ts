import { formatearDinero } from './dinero';

describe('formatearDinero', () => {
  it('agrega el separador de miles y siempre dos decimales', () => {
    expect(formatearDinero(8301)).toBe('$8,301.00');
    expect(formatearDinero(1234567.8)).toBe('$1,234,567.80');
    expect(formatearDinero(12)).toBe('$12.00');
    expect(formatearDinero(0.5)).toBe('$0.50');
  });

  it('pone el signo menos antes del símbolo', () => {
    expect(formatearDinero(-5)).toBe('-$5.00');
  });

  it('acepta texto numérico y tolera valores vacíos', () => {
    expect(formatearDinero('10.5')).toBe('$10.50');
    expect(formatearDinero(null)).toBe('$0.00');
    expect(formatearDinero(undefined)).toBe('$0.00');
    expect(formatearDinero('abc')).toBe('$0.00');
  });
});
