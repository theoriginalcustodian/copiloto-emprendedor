import { describe, expect, it } from 'vitest';

import { formatearFechaCorta, formatearFechaLarga, formatearImporte } from './formatoDinero';

describe('formatearImporte', () => {
  it('agrupa miles y usa coma decimal', () => {
    expect(formatearImporte('45000.00')).toBe('$45.000,00');
    expect(formatearImporte('1234567.89')).toBe('$1.234.567,89');
  });

  it('no agrupa lo que no llega a mil', () => {
    expect(formatearImporte('999.50')).toBe('$999,50');
    expect(formatearImporte('0.00')).toBe('$0,00');
  });

  it('agrupa exactamente en el borde de los mil', () => {
    expect(formatearImporte('1000.00')).toBe('$1.000,00');
    expect(formatearImporte('999999.99')).toBe('$999.999,99');
  });

  /**
   * 🔴 El invariante que justifica que este módulo exista. `Number('0.1') + Number('0.2')` da
   * `0.30000000000000004`; nada de acá opera con los importes, sólo los re-escribe. Este test es la
   * evidencia de que los decimales que entran son EXACTAMENTE los que salen — incluidos los que un
   * `Number` intermedio corrompería.
   */
  it('conserva los decimales tal cual, sin pasar por float', () => {
    expect(formatearImporte('0.10')).toBe('$0,10');
    expect(formatearImporte('0.20')).toBe('$0,20');
    // 17 dígitos: más precisión de la que un `double` puede representar. Con `Number` en el medio,
    // este valor se redondearía y el test sería rojo.
    expect(formatearImporte('12345678901234567.89')).toBe('$12.345.678.901.234.567,89');
  });

  it('tolera un valor sin decimales en vez de inventarle un ,00', () => {
    // Agregar decimales que el backend no mandó sería afirmar una precisión que no se recibió.
    expect(formatearImporte('45000')).toBe('$45.000');
  });

  it('🔴 UN decimal se completa a dos — `1500.0` y `1500.00` son el mismo número', () => {
    // Vino de device: /afip/comprobantes devuelve "100.0" y la lista mostraba `$100,0` al lado de una
    // actividad que mostraba `$1.500,00`. El cero de relleno no afirma precisión que no se recibió:
    // termina de escribir los centavos que el backend ya empezó a escribir.
    expect(formatearImporte('1500.0')).toBe('$1.500,00');
    expect(formatearImporte('100.0')).toBe('$100,00');
    expect(formatearImporte('-8.5')).toBe('-$8,50');
  });

  it('acepta más de dos decimales sin truncar', () => {
    expect(formatearImporte('1.2345')).toBe('$1,2345');
  });

  it('formatea negativos con el signo antes del símbolo', () => {
    expect(formatearImporte('-1500.00')).toBe('-$1.500,00');
  });

  it('permite cambiar el símbolo', () => {
    expect(formatearImporte('45000.00', 'US$')).toBe('US$45.000,00');
  });

  it('devuelve tal cual lo que no es un número, sin enmascararlo con $0,00', () => {
    // Un `$0,00` sobre un backend que mandó basura sería una mentira sobre plata.
    expect(formatearImporte('')).toBe('');
    expect(formatearImporte('N/D')).toBe('N/D');
    expect(formatearImporte('45.000,00')).toBe('45.000,00');
  });
});

describe('formatearFecha', () => {
  it('corta: día y mes', () => {
    expect(formatearFechaCorta('2026-07-21T22:14:03.120Z')).toMatch(/2[12] jul/);
  });

  it('larga: día, mes y año', () => {
    expect(formatearFechaLarga('2026-07-21T22:14:03.120Z')).toMatch(/2[12] jul 2026/);
  });

  it('una fecha ilegible no muestra "Invalid Date"', () => {
    // Mejor no mostrar fecha que mostrar una palabra que el emprendedor no puede interpretar.
    expect(formatearFechaCorta('no-es-fecha')).toBe('');
    expect(formatearFechaLarga('')).toBe('');
  });
});
