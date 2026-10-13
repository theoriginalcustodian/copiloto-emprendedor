import { describe, expect, it } from 'vitest';

import { leerDetalleGate } from './detalleGate';

const GMAIL = {
  titulo: 'Mail a lucia@x.com',
  filas: [
    { k: 'Para', v: 'lucia@x.com', sub: null, editable: false },
    { k: 'Asunto', v: 'Recordatorio', sub: null, editable: false },
  ],
  cita: 'Te recuerdo la reunión del lunes.',
  nota: 'Se manda desde tu Gmail.',
};

describe('leerDetalleGate', () => {
  it('lee la forma real que emite el backend', () => {
    expect(leerDetalleGate({ kind: 'confirm', detalle: GMAIL })).toEqual({
      titulo: 'Mail a lucia@x.com',
      filas: [
        { clave: 'Para', valor: 'lucia@x.com', sub: null, editable: false },
        { clave: 'Asunto', valor: 'Recordatorio', sub: null, editable: false },
      ],
      cita: 'Te recuerdo la reunión del lunes.',
      nota: 'Se manda desde tu Gmail.',
    });
  });

  it('🔴 la `cita` se conserva ENTERA: sin recortar y con sus saltos de línea', () => {
    const cuerpo = `Hola Lucía,\n\n${'línea larga '.repeat(80)}\n\nSaludos`;
    const d = leerDetalleGate({ detalle: { ...GMAIL, cita: cuerpo } });

    expect(d?.cita).toBe(cuerpo);
    expect(d?.cita).toContain('\n\n');
  });

  it('una fila con clave o valor ilegible se descarta, las demás quedan', () => {
    const d = leerDetalleGate({
      detalle: {
        ...GMAIL,
        filas: [{ k: 'Para', v: 'lucia@x.com' }, { k: '', v: 'x' }, { k: 'Asunto', v: 42 }, 'basura', null],
      },
    });

    expect(d?.filas).toEqual([{ clave: 'Para', valor: 'lucia@x.com', sub: null, editable: false }]);
  });

  it('`editable` es estricto: sólo `true` booleano', () => {
    const d = leerDetalleGate({
      detalle: {
        titulo: 't',
        filas: [
          { k: 'a', v: '1', editable: true },
          { k: 'b', v: '2', editable: 'true' },
          { k: 'c', v: '3', editable: 1 },
        ],
      },
    });

    expect(d?.filas.map((f) => f.editable)).toEqual([true, false, false]);
  });

  it('sin filas pero con cita: sirve (hay qué mostrar)', () => {
    const d = leerDetalleGate({ detalle: { titulo: 't', filas: [], cita: 'cuerpo' } });

    expect(d?.cita).toBe('cuerpo');
    expect(d?.filas).toEqual([]);
  });

  it('control negativo: un título solo, sin filas ni cita, es null (no dice qué se aprueba)', () => {
    expect(leerDetalleGate({ detalle: { titulo: 't', filas: [], cita: null } })).toBeNull();
    expect(leerDetalleGate({ detalle: { titulo: 't' } })).toBeNull();
  });

  it('sin título legible, null', () => {
    expect(leerDetalleGate({ detalle: { ...GMAIL, titulo: '' } })).toBeNull();
    expect(leerDetalleGate({ detalle: { ...GMAIL, titulo: 7 } })).toBeNull();
  });

  it('sin card, sin detalle o con un detalle que no es objeto: null', () => {
    expect(leerDetalleGate(undefined)).toBeNull();
    expect(leerDetalleGate(null)).toBeNull();
    expect(leerDetalleGate({ kind: 'confirm' })).toBeNull();
    expect(leerDetalleGate({ detalle: 'texto' })).toBeNull();
    expect(leerDetalleGate({ detalle: null })).toBeNull();
  });
});
