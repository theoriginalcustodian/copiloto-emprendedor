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

  describe('origen: "foto" — Gastos Fase 2, addendum de la foto', () => {
    it('🔴 monto vacío SÍ devuelve propuesta cuando origen es "foto" — es el diseño, no un dato roto', () => {
      const p = leerGastoPropuesto(card({ origen: 'foto', monto: '', monto_sugerido: '1076.21' }));
      expect(p).not.toBeNull();
      expect(p?.monto).toBe('');
      expect(p?.origen).toBe('foto');
    });

    it('monto ausente (null) también funciona para "foto" — mismo criterio que vacío', () => {
      expect(leerGastoPropuesto(card({ origen: 'foto', monto: null }))?.monto).toBe('');
    });

    it('lee `monto_sugerido` de la card — antes se perdía, sólo vivía en `GET /gastos`', () => {
      const p = leerGastoPropuesto(card({ origen: 'foto', monto: '', monto_sugerido: '1076.21' }));
      expect(p?.montoSugerido).toBe('1076.21');
    });

    it('sin `monto_sugerido` (el modelo no pudo leer nada) queda `null`, no `undefined` ni `""`', () => {
      const p = leerGastoPropuesto(card({ origen: 'foto', monto: '' }));
      expect(p?.montoSugerido).toBeNull();
    });

    it('`monto_sugerido` en una card de VOZ se ignora silenciosamente — no es el contrato de voz', () => {
      // No debería venir nunca, pero si el LLM lo agrega por las dudas, no tiene que romper nada.
      const p = leerGastoPropuesto(card({ origen: 'voz', monto_sugerido: '999' }));
      expect(p?.montoSugerido).toBeNull();
    });

    it('CONTROL — sigue sin pintar si es "foto" con monto vacío Y sin ningún otro dato usable', () => {
      // No es un test nuevo de comportamiento: confirma que "foto" no relaja la validación de `data`
      // en sí (objeto ausente/roto), sólo la del campo `monto`.
      expect(leerGastoPropuesto({ kind: 'gasto_propuesto', data: 'no soy un objeto' })).toBeNull();
    });
  });
});
