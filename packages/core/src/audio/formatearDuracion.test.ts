import { describe, expect, it } from 'vitest';

import { formatearDuracion } from './formatearDuracion';

describe('formatearDuracion', () => {
  it.each([
    [0, '0:00'],
    [7, '0:07'],
    [59, '0:59'],
    [60, '1:00'],
    [75, '1:15'],
    [600, '10:00'],
  ])('%i s → %s', (seg, esperado) => {
    expect(formatearDuracion(seg)).toBe(esperado);
  });

  it('un valor negativo o no finito cae a 0:00, no a «-1:-5» ni NaN', () => {
    expect(formatearDuracion(-5)).toBe('0:00');
    expect(formatearDuracion(Number.NaN)).toBe('0:00');
    expect(formatearDuracion(Number.POSITIVE_INFINITY)).toBe('0:00');
  });

  it('trunca los decimales en vez de redondear hacia arriba', () => {
    expect(formatearDuracion(7.9)).toBe('0:07');
  });
});
