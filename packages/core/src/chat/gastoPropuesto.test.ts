import { describe, expect, it } from 'vitest';

import { leerGastoPropuesto } from './gastoPropuesto';

/** La forma EXACTA que manda el motor (`avance_backend..._gastos-hito-4`, verificada por su E2E). */
function card(over: Record<string, unknown> = {}) {
  return {
    kind: 'gasto_propuesto',
    data: {
      monto: '15000.00',
      fecha: '2026-07-21',
      categoria: 'mercaderia',
      proveedor: 'Distribuidora Sur',
      medio_pago: null,
      descripcion: 'pagué 15 mil de mercadería',
      origen: 'voz',
      ...over,
    },
  };
}

describe('leerGastoPropuesto', () => {
  it('traduce la card a los valores del formulario', () => {
    const p = leerGastoPropuesto(card());

    expect(p).not.toBeNull();
    expect(p?.monto).toBe('15000.00');
    expect(typeof p?.monto).toBe('string');
    expect(p?.fecha).toBe('2026-07-21');
    expect(p?.categoria).toBe('mercaderia');
    expect(p?.proveedor).toBe('Distribuidora Sur');
    expect(p?.medioPago).toBeNull();
    expect(p?.origen).toBe('voz');
  });

  it('ignora cualquier card que no sea `gasto_propuesto`', () => {
    expect(leerGastoPropuesto({ kind: 'confirm', service: '', label: '' })).toBeNull();
    expect(leerGastoPropuesto(undefined)).toBeNull();
  });

  it('sin monto NO devuelve propuesta — no se pinta un formulario vacío', () => {
    // El monto es el único obligatorio y el único que el copiloto repregunta. Pintar la card sin él
    // sería pedirle al emprendedor que tipee justo lo que acaba de dictar.
    expect(leerGastoPropuesto(card({ monto: null }))).toBeNull();
    expect(leerGastoPropuesto(card({ monto: '' }))).toBeNull();
  });

  it('una categoría inventada por el LLM cae en "otros" en vez de fallar en el POST', () => {
    // Sin esto el emprendedor ve FALLAR algo que el copiloto le ofreció: parece que la app está rota
    // cuando el que se equivocó fue el que escribió dos listas de categorías.
    expect(leerGastoPropuesto(card({ categoria: 'stock' }))?.categoria).toBe('otros');
  });

  it('una card sin `data` no rompe', () => {
    expect(leerGastoPropuesto({ kind: 'gasto_propuesto' })).toBeNull();
    expect(leerGastoPropuesto({ kind: 'gasto_propuesto', data: 'no soy un objeto' })).toBeNull();
  });

  it('los strings vacíos del LLM se leen como ausentes, no como dato', () => {
    const p = leerGastoPropuesto(card({ proveedor: '   ', descripcion: '' }));

    expect(p?.proveedor).toBeNull();
    expect(p?.descripcion).toBeNull();
  });

  it('sin fecha devuelve "" para que el formulario OMITA la clave y el backend ponga su default', () => {
    // Calcular "hoy" en el teléfono reintroduce el bug de zona horaria: el que sabe qué día es hoy
    // para este negocio es el backend (Argentina), no el dispositivo.
    expect(leerGastoPropuesto(card({ fecha: null }))?.fecha).toBe('');
  });
});
