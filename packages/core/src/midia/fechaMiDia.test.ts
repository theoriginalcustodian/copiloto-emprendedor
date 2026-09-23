import { describe, expect, it } from 'vitest';

import { fechaDeHoyMidia } from './fechaMiDia';

describe('fechaDeHoyMidia (BL-W11 fila 4a)', () => {
  it('día de la semana capitalizado + día + mes, sin hora ni año', () => {
    // 2026-09-22 es martes.
    expect(fechaDeHoyMidia(new Date(2026, 8, 22))).toBe('Martes 22 de septiembre');
  });

  it('domingo y diciembre: los índices 0 no se pisan entre sí', () => {
    // 2026-12-06 es domingo.
    expect(fechaDeHoyMidia(new Date(2026, 11, 6))).toBe('Domingo 6 de diciembre');
  });

  it('enero, día de un dígito', () => {
    // 2026-01-01 es jueves.
    expect(fechaDeHoyMidia(new Date(2026, 0, 1))).toBe('Jueves 1 de enero');
  });
});
