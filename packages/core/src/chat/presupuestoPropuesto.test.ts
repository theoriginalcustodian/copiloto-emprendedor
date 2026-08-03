import { describe, expect, it } from 'vitest';

import { leerPresupuestoPropuesto } from './presupuestoPropuesto';

/** `data` = exactamente el body de `POST /presupuestos`, confirmado por el contrato §2.4 — sólo el
 *  `kind` de esta card es [ASSUMED_PENDING_VERIFY]. Ver el docstring del módulo. */
function card(over: Record<string, unknown> = {}) {
  return {
    kind: 'presupuesto_propuesto',
    data: {
      concepto: 'Instalación eléctrica',
      receptor: { nombre: 'Juan Pérez', doc_tipo: 96, doc_nro: '20123456', contacto: 'juan@mail.com' },
      items: [
        { descripcion: 'Mano de obra', cantidad: '1', precio_unitario: '30000' },
        { descripcion: 'Materiales', cantidad: '1', precio_unitario: '15000' },
      ],
      ...over,
    },
  };
}

describe('leerPresupuestoPropuesto', () => {
  it('traduce la card a los valores del formulario', () => {
    const p = leerPresupuestoPropuesto(card());

    expect(p).not.toBeNull();
    expect(p?.concepto).toBe('Instalación eléctrica');
    expect(p?.receptor.nombre).toBe('Juan Pérez');
    expect(p?.receptor.docTipo).toBe(96);
    expect(p?.receptor.docNro).toBe('20123456');
    expect(p?.items).toHaveLength(2);
    expect(p?.items[0]).toEqual({ descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '30000' });
  });

  it('ignora cualquier card que no sea `presupuesto_propuesto`', () => {
    expect(leerPresupuestoPropuesto({ kind: 'ingreso_propuesto', data: { monto: '1' } })).toBeNull();
    expect(leerPresupuestoPropuesto(undefined)).toBeNull();
  });

  it('sin `concepto` NO devuelve propuesta', () => {
    expect(leerPresupuestoPropuesto(card({ concepto: null }))).toBeNull();
    expect(leerPresupuestoPropuesto(card({ concepto: '' }))).toBeNull();
  });

  it('sin `receptor.nombre` NO devuelve propuesta', () => {
    expect(leerPresupuestoPropuesto(card({ receptor: { nombre: null } }))).toBeNull();
  });

  it('sin ítems NO devuelve propuesta — nada que corregir', () => {
    expect(leerPresupuestoPropuesto(card({ items: [] }))).toBeNull();
  });

  it('🔴 un ítem sin descripción NO se descarta — se muestra con la fila vacía, editable', () => {
    const p = leerPresupuestoPropuesto(card({ items: [{ descripcion: null, cantidad: '1' }] }));

    expect(p).not.toBeNull();
    expect(p?.items).toEqual([{ descripcion: '', cantidad: '1', precioUnitario: '' }]);
  });

  it('un ítem sin cantidad/precio cae en los mismos defaults que el alta manual', () => {
    const p = leerPresupuestoPropuesto(card({ items: [{ descripcion: 'Mano de obra' }] }));

    expect(p?.items[0]).toEqual({ descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '' });
  });

  it('una card sin `data`, o `receptor`/`items` con forma rara, no rompe', () => {
    expect(leerPresupuestoPropuesto({ kind: 'presupuesto_propuesto' })).toBeNull();
    expect(leerPresupuestoPropuesto({ kind: 'presupuesto_propuesto', data: 'no soy un objeto' })).toBeNull();
    expect(leerPresupuestoPropuesto(card({ receptor: 'no soy un objeto' }))).toBeNull();
    expect(leerPresupuestoPropuesto(card({ items: 'no soy un array' }))).toBeNull();
  });
});
