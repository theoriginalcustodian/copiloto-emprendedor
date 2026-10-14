import { describe, expect, it } from 'vitest';

import { formatearInstanteDeCaida } from './instanteCaida';

// Los instantes se arman con el constructor LOCAL y se serializan a ISO: el test no depende del huso de la
// máquina que lo corre (el formateador lee la hora local del dispositivo, a propósito).
const local = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min);
const AHORA = local(2026, 10, 13, 15, 30);

describe('formatearInstanteDeCaida', () => {
  it('hoy → «Hoy, 9:12» (hora sin cero a la izquierda, minutos con dos dígitos)', () => {
    expect(formatearInstanteDeCaida(local(2026, 10, 13, 9, 12).toISOString(), AHORA)).toBe('Hoy, 9:12');
    expect(formatearInstanteDeCaida(local(2026, 10, 13, 9, 5).toISOString(), AHORA)).toBe('Hoy, 9:05');
  });

  it('ayer → «Ayer, 21:40», por día CALENDARIO: 23:50 de ayer sigue siendo ayer a las 00:10', () => {
    expect(formatearInstanteDeCaida(local(2026, 10, 12, 21, 40).toISOString(), AHORA)).toBe('Ayer, 21:40');
    const pasadaLaMedianoche = local(2026, 10, 13, 0, 10);
    expect(formatearInstanteDeCaida(local(2026, 10, 12, 23, 50).toISOString(), pasadaLaMedianoche)).toBe('Ayer, 23:50');
  });

  it('antes de ayer → fecha larga sin año', () => {
    expect(formatearInstanteDeCaida(local(2026, 10, 9, 8, 0).toISOString(), AHORA)).toBe('9 de octubre, 8:00');
  });

  it('🔴 sin instante real NO hay texto: null, undefined, vacío y basura dan null (nunca una hora inventada)', () => {
    expect(formatearInstanteDeCaida(null, AHORA)).toBeNull();
    expect(formatearInstanteDeCaida(undefined, AHORA)).toBeNull();
    expect(formatearInstanteDeCaida('', AHORA)).toBeNull();
    expect(formatearInstanteDeCaida('   ', AHORA)).toBeNull();
    expect(formatearInstanteDeCaida('ayer a la tarde', AHORA)).toBeNull();
  });
});
