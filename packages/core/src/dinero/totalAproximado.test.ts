import { describe, expect, it } from 'vitest';

import { calcularTotalAproximado } from './totalAproximado';

describe('calcularTotalAproximado', () => {
  /**
   * BL-D5: la card del presupuesto mostraba "Total aproximado: $30.000,0000" — multiplicar
   * "1.00" × "30000.00" suma sus 2+2 decimales (matemáticamente correcto), pero nadie redondeaba
   * antes de mostrar. Este test es el caso exacto reportado.
   */
  it('"1.00" × "30000.00" da $30.000,00 (redondeado a 2 decimales, no 4)', () => {
    expect(
      calcularTotalAproximado([{ descripcion: 'Servicio', cantidad: '1.00', precioUnitario: '30000.00' }]),
    ).toBe('30000.00');
  });

  /**
   * Caso de redondeo mitad-arriba con un resultado que el float binario redondea MAL
   * (`Math.round(1.005 * 100) / 100 === 1`, no `1.01`) — confirma que esto nunca pasa por `Number`.
   */
  it('"3" × "0.335" redondea 1.005 a 1.01 (mitad arriba, sin float)', () => {
    expect(
      calcularTotalAproximado([{ descripcion: 'Ítem', cantidad: '3', precioUnitario: '0.335' }]),
    ).toBe('1.01');
  });

  it('suma varias filas y saltea la fila en blanco final', () => {
    expect(
      calcularTotalAproximado([
        { descripcion: 'A', cantidad: '2', precioUnitario: '100.50' },
        { descripcion: 'B', cantidad: '1', precioUnitario: '49.50' },
        { descripcion: '', cantidad: '1', precioUnitario: '' },
      ]),
    ).toBe('250.50');
  });

  it('devuelve null si alguna fila con datos no es un decimal válido', () => {
    expect(
      calcularTotalAproximado([{ descripcion: 'A', cantidad: 'x', precioUnitario: '100' }]),
    ).toBeNull();
  });

  it('sin filas (o todas en blanco) da 0.00', () => {
    expect(calcularTotalAproximado([])).toBe('0.00');
  });
});
