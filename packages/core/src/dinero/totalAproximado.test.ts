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

  /**
   * Punto 2 del pedido ACTID-mas-dos-defectos (2026-09-28): antes daba `'0.00'` acá, y
   * `FormularioPresupuesto` lo mostraba como "Total aproximado: $0,00" en un formulario recién
   * abierto — dato faltante mostrado como cero, viola `cero-que-no-se-puede-afirmar`.
   */
  it('sin filas (o todas en blanco) da null -- no hay dato, no es "$0,00"', () => {
    expect(calcularTotalAproximado([])).toBeNull();
    expect(
      calcularTotalAproximado([{ descripcion: '', cantidad: '1', precioUnitario: '' }]),
    ).toBeNull();
  });

  it('un ítem real con precio "0" SÍ da 0.00 -- cero cargado no es lo mismo que nada cargado', () => {
    expect(
      calcularTotalAproximado([{ descripcion: 'Cortesía', cantidad: '1', precioUnitario: '0' }]),
    ).toBe('0.00');
  });
});
