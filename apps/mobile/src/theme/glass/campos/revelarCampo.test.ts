/**
 * Tests de `calcularDesplazamiento` — la única parte con lógica del revelado de campos.
 *
 * Se testea la función y no el componente a propósito: `measureInWindow` nunca resuelve fuera de un
 * device, así que un test de render pasaría en verde **sin ejercitar nada** — el gate que confirma en
 * vez de verificar. Acá los números son el sujeto.
 *
 * Escenario base: un área visible que arranca en y=100 y mide 400 de alto (el teclado ya se la comió,
 * eso lo hace el `KeyboardAvoidingView`). Con el margen de 16, el borde útil de abajo queda en 484.
 */
import { describe, expect, it } from '@jest/globals';

import { MARGEN_REVELADO, calcularDesplazamiento } from './revelarCampo';

const AREA = { areaY: 100, areaAlto: 400 } as const;

describe('calcularDesplazamiento', () => {
  it('no scrollea si el campo ya se ve entero', () => {
    expect(
      calcularDesplazamiento({ ...AREA, campoY: 200, campoAlto: 80, offsetActual: 0 })
    ).toBeNull();
  });

  it('baja lo justo para despegar del borde cuando el campo queda tapado por abajo', () => {
    // El campo termina en 520; el borde útil está en 500 - 16 = 484. Faltan 36.
    expect(
      calcularDesplazamiento({ ...AREA, campoY: 440, campoAlto: 80, offsetActual: 0 })
    ).toBe(36);
  });

  it('acumula sobre el desplazamiento actual, no lo pisa', () => {
    // Mismo caso, pero el usuario ya venía scrolleado 250. El destino es relativo al contenido.
    expect(
      calcularDesplazamiento({ ...AREA, campoY: 440, campoAlto: 80, offsetActual: 250 })
    ).toBe(286);
  });

  it('respeta el margen: un campo justo en el borde igual se despega', () => {
    // Termina exactamente en 500 (el borde del área, sin margen). Debe moverse los 16 del margen.
    expect(
      calcularDesplazamiento({ ...AREA, campoY: 420, campoAlto: 80, offsetActual: 0 })
    ).toBe(MARGEN_REVELADO);
  });

  it('prioriza el borde SUPERIOR de un campo más alto que el área visible', () => {
    // Campo de 600 en un área de 400: no entra entero. Se lo lleva a ras del tope (100+16=116), no
    // más, para no dejar el comienzo del campo -- donde está el cursor -- fuera de pantalla.
    expect(
      calcularDesplazamiento({ ...AREA, campoY: 300, campoAlto: 600, offsetActual: 0 })
    ).toBe(300 - 116);
  });

  it('sube cuando el campo quedó tapado por arriba', () => {
    // Campo en y=40, el tope útil es 116. Hay que retroceder 76.
    expect(
      calcularDesplazamiento({ ...AREA, campoY: 40, campoAlto: 60, offsetActual: 500 })
    ).toBe(424);
  });

  it('nunca devuelve un desplazamiento negativo', () => {
    // Un campo por encima del tope con el scroll casi en cero: el destino se corta en 0 y no rebota.
    expect(
      calcularDesplazamiento({ ...AREA, campoY: 40, campoAlto: 60, offsetActual: 10 })
    ).toBe(0);
  });
});
