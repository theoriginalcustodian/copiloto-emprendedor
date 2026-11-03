import { describe, expect, it } from 'vitest';

import { posicionLineaAhora } from './agenda';

const ev = (inicio: string | null, diaCompleto = false) => ({ inicioCrudo: inicio, diaCompleto });
const AHORA = new Date('2026-11-03T15:00:00Z');

describe('posicionLineaAhora (SM-N34)', () => {
  it('cae antes del primer evento con hora que todavía no empezó', () => {
    const r = posicionLineaAhora([ev('2026-11-03T13:00:00Z'), ev('2026-11-03T17:00:00Z'), ev('2026-11-03T18:00:00Z')], AHORA);
    expect(r).toBe(1);
  });

  it('si todos ya empezaron, cae al final', () => {
    expect(posicionLineaAhora([ev('2026-11-03T10:00:00Z'), ev('2026-11-03T12:00:00Z')], AHORA)).toBe(2);
  });

  it('si ninguno empezó, cae al principio', () => {
    expect(posicionLineaAhora([ev('2026-11-03T16:00:00Z')], AHORA)).toBe(0);
  });

  it('sin hora legible (día completo / ilegible / vacío) NO hay línea: ausente ≠ inventada', () => {
    expect(posicionLineaAhora([], AHORA)).toBeNull();
    expect(posicionLineaAhora([ev('2026-11-03', true), ev(null), ev('basura')], AHORA)).toBeNull();
  });

  it('un evento de día completo no mueve el ancla de los que tienen hora', () => {
    expect(posicionLineaAhora([ev('2026-11-03', true), ev('2026-11-03T17:00:00Z')], AHORA)).toBe(1);
  });
});
