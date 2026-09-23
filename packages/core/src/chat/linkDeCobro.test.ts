import { describe, expect, it } from 'vitest';

import { leerLinkDeCobro } from './linkDeCobro';

const card = (data: unknown, kind = 'payment_link') => ({ kind, data }) as never;

describe('leerLinkDeCobro', () => {
  it('lee url, monto y concepto', () => {
    expect(leerLinkDeCobro(card({ url: 'https://mpago.la/x', amount: 15000, concept: 'Diseño' }))).toEqual({
      url: 'https://mpago.la/x',
      monto: '15000',
      concepto: 'Diseño',
    });
  });
  it('acepta el monto como string y tolera concepto ausente', () => {
    expect(leerLinkDeCobro(card({ url: 'https://mpago.la/x', amount: '2500.50' }))).toEqual({
      url: 'https://mpago.la/x',
      monto: '2500.50',
      concepto: null,
    });
  });
  it('null si no es payment_link, si falta la url o si no hay card', () => {
    expect(leerLinkDeCobro(card({ url: 'https://x' }, 'doc'))).toBeNull();
    expect(leerLinkDeCobro(card({ amount: 1 }))).toBeNull();
    expect(leerLinkDeCobro(card(null))).toBeNull();
    expect(leerLinkDeCobro(undefined)).toBeNull();
  });
});
