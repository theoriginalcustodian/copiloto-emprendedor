import { describe, expect, it } from 'vitest';

import { faseRefresco, TEXTO_REFRESCO, UMBRAL_SOLTAR_PX } from './textosRefresco';

describe('faseRefresco (BL-W6)', () => {
  it('reposo → tirar', () => {
    expect(faseRefresco({ actualizando: false, alDia: false, arrastrePx: 0 })).toBe('tirar');
  });
  it('pasado el umbral → soltar', () => {
    expect(faseRefresco({ actualizando: false, alDia: false, arrastrePx: UMBRAL_SOLTAR_PX })).toBe('soltar');
    expect(faseRefresco({ actualizando: false, alDia: false, arrastrePx: UMBRAL_SOLTAR_PX - 1 })).toBe('tirar');
  });
  it('actualizando manda sobre todo, aldia manda sobre el arrastre', () => {
    expect(faseRefresco({ actualizando: true, alDia: true, arrastrePx: 200 })).toBe('actualizando');
    expect(faseRefresco({ actualizando: false, alDia: true, arrastrePx: 200 })).toBe('aldia');
  });
  it('los cuatro textos son los del prototipo', () => {
    expect(Object.values(TEXTO_REFRESCO)).toEqual([
      'Tirá para actualizar',
      'Soltá para actualizar',
      'Actualizando…',
      'Al día · recién',
    ]);
  });
});
