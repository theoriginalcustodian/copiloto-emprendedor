import { describe, expect, it } from 'vitest';

import { chipDeCaja, formatearFechaCorte, formatearVariacion } from './caja';

describe('formatearFechaCorte', () => {
  it('«2026-08-19» → «Al 19 de agosto» sin correr el día por la zona horaria', () => {
    expect(formatearFechaCorte('2026-08-19')).toBe('Al 19 de agosto');
    expect(formatearFechaCorte('2026-01-01')).toBe('Al 1 de enero');
    expect(formatearFechaCorte('2026-12-31')).toBe('Al 31 de diciembre');
  });

  it('null o basura → null (se omite la etiqueta, no se inventa)', () => {
    expect(formatearFechaCorte(null)).toBeNull();
    expect(formatearFechaCorte('ayer')).toBeNull();
    expect(formatearFechaCorte('2026-13-01')).toBeNull();
  });
});

describe('formatearVariacion', () => {
  it('signo correcto, menos tipográfico y coma es-AR', () => {
    expect(formatearVariacion('-18.0')).toBe('−18% vs mes anterior');
    expect(formatearVariacion('5.3')).toBe('+5,3% vs mes anterior');
    expect(formatearVariacion('12')).toBe('+12% vs mes anterior');
  });

  it('cero no lleva signo', () => {
    expect(formatearVariacion('0.0')).toBe('0% vs mes anterior');
  });

  it('null o no numérico → null: el chip se omite entero, nunca «0%» ni «—»', () => {
    expect(formatearVariacion(null)).toBeNull();
    expect(formatearVariacion('n/a')).toBeNull();
  });
});

describe('chipDeCaja', () => {
  it('junta fecha y variación', () => {
    expect(chipDeCaja({ fechaCorte: '2026-08-19', variacionPct: '-18.0' })).toBe(
      'Al 19 de agosto · −18% vs mes anterior',
    );
  });
  it('omite la variación cuando es null (un solo mes de historia): sólo la fecha', () => {
    expect(chipDeCaja({ fechaCorte: '2026-08-19', variacionPct: null })).toBe('Al 19 de agosto');
  });
  it('sin ninguna de las dos → null (no hay chip)', () => {
    expect(chipDeCaja({ fechaCorte: null, variacionPct: null })).toBeNull();
  });
});
