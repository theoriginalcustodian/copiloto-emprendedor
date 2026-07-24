import { describe, expect, it } from 'vitest';

import { leerIngresoPropuesto } from './ingresoPropuesto';

/** [ASSUMED_PENDING_VERIFY] — forma RAZONADA (misma convención que `gasto_propuesto`: `data` es el
 *  body de `POST /ingresos`), no medida todavía contra el `/reply` real. Ver el docstring del módulo. */
function card(over: Record<string, unknown> = {}) {
  return {
    kind: 'ingreso_propuesto',
    data: {
      monto: '85000.00',
      medio: 'efectivo',
      cliente_nombre: 'Panadería La Esquina',
      concepto: 'pintura del local',
      fecha: '2026-07-23',
      ...over,
    },
  };
}

describe('leerIngresoPropuesto', () => {
  it('traduce la card a los valores del formulario', () => {
    const p = leerIngresoPropuesto(card());

    expect(p).not.toBeNull();
    expect(p?.monto).toBe('85000.00');
    expect(typeof p?.monto).toBe('string');
    expect(p?.medio).toBe('efectivo');
    expect(p?.clienteNombre).toBe('Panadería La Esquina');
    expect(p?.concepto).toBe('pintura del local');
    expect(p?.fecha).toBe('2026-07-23');
  });

  it('ignora cualquier card que no sea `ingreso_propuesto`', () => {
    expect(leerIngresoPropuesto({ kind: 'gasto_propuesto', data: { monto: '1' } })).toBeNull();
    expect(leerIngresoPropuesto(undefined)).toBeNull();
  });

  it('sin monto NO devuelve propuesta — no se pinta un formulario vacío', () => {
    expect(leerIngresoPropuesto(card({ monto: null }))).toBeNull();
    expect(leerIngresoPropuesto(card({ monto: '' }))).toBeNull();
  });

  it('una card sin `data` no rompe', () => {
    expect(leerIngresoPropuesto({ kind: 'ingreso_propuesto' })).toBeNull();
    expect(leerIngresoPropuesto({ kind: 'ingreso_propuesto', data: 'no soy un objeto' })).toBeNull();
  });

  it('los strings vacíos del LLM se leen como ausentes, no como dato', () => {
    const p = leerIngresoPropuesto(card({ medio: '   ', concepto: '' }));

    expect(p?.medio).toBeNull();
    expect(p?.concepto).toBeNull();
  });

  it('sin fecha devuelve "" para que el formulario OMITA la clave y el backend ponga su default', () => {
    expect(leerIngresoPropuesto(card({ fecha: null }))?.fecha).toBe('');
  });
});
