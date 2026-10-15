import { describe, expect, it } from 'vitest';

import { ofrecerAceptarLegal } from './legal';

/**
 * SM-C4 — `ofrecerAceptarLegal` decide si se muestra el botón «Aceptar» en Mi cuenta. Es una OFERTA
 * (INFORMA, no bloquea): la tabla de abajo es el contrato, y el cuarto estado (campo ausente) es el
 * que NO se puede leer como «nunca aceptó».
 */
describe('ofrecerAceptarLegal', () => {
  it.each([
    ['aceptó la vigente', { legal_aceptado: true, legal_version_aceptada: '2026-09-22' }, false],
    ['aceptó una versión vieja', { legal_aceptado: false, legal_version_aceptada: '2026-06-01' }, true],
    ['nunca aceptó', { legal_aceptado: false, legal_version_aceptada: null }, true],
    ['campo ausente (backend viejo)', { legal_aceptado: true }, false],
    ['sin /me todavía', null, false],
    ['/me indefinido', undefined, false],
  ] as const)('%s → %s', (_caso, me, esperado) => {
    expect(ofrecerAceptarLegal(me as never)).toBe(esperado);
  });

  it('un /me sin NINGÚN campo legal no ofrece (no se sabe si hace falta)', () => {
    expect(ofrecerAceptarLegal({})).toBe(false);
  });
});
