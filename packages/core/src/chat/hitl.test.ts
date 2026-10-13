import { describe, expect, it } from 'vitest';

import { mapearGate } from './hitl';
import type { ChatMessage } from './chatMachine';

/**
 * `mapearGate` es la lógica COMPARTIDA que consume el mobile (`ListaMensajes.tsx` ->
 * `TarjetaConfirmacion`, ver `gate.amount`) para construir el gate HITL. El equivalente web
 * (`hitlMapping.ts`) reimplementa el mismo parseo localmente (hallazgo H-2, auditoría previa) — este
 * archivo sólo cubre el lado `@copiloto/core`/mobile.
 */

function msg(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    text: '',
    choices: [
      { label: 'Cobrar', value: 'confirm' },
      { label: 'Cancelar', value: 'cancel' },
    ],
    ...overrides,
  };
}

describe('mapearGate — monto (H-A4-12, auditoría 2026-09-22)', () => {
  // El backend manda el monto CRUDO dentro del texto, sin separador de miles
  // (`f"...por ${amount}..."`, ver `dispatcher_emprendedor.py`). Control positivo de esa forma real +
  // control negativo explícito: con el código viejo (`amount: markdown.match(AMOUNT_RE)?.[1]` sin
  // pasar por `formatearImporte`) esto daba `'80000'`, no `'80.000'`.
  it('formatea el monto crudo de MercadoPago con separador de miles', () => {
    const gate = mapearGate(
      msg({
        text: 'Voy a generar un link de cobro de MercadoPago por $80000 (Diseño de logo). ¿Confirmás?',
        card: { kind: 'confirm', service: 'mercadopago', label: 'Mercado Pago' },
      }),
    );

    expect(gate?.amount).toBe('80.000');
    expect(gate?.amount).not.toBe('80000');
  });

  it('un servicio sin `showAmount` (ej. Google Docs) no expone monto', () => {
    const gate = mapearGate(
      msg({
        text: 'Voy a crear el documento «Presupuesto» en Docs. ¿Confirmás?',
        card: { kind: 'confirm', service: 'googledocs', label: 'Google Docs' },
      }),
    );

    expect(gate?.amount).toBeUndefined();
  });
});

describe('mapearGate — `card.detalle` (C-D3, contrato 2026-10-13)', () => {
  // La forma REAL que emite `apps/copiloto/hitl_card.py` (Gmail, el piloto).
  const detalleGmail = {
    titulo: 'Mail a lucia@x.com',
    filas: [
      { k: 'Para', v: 'lucia@x.com', sub: null, editable: false },
      { k: 'Asunto', v: 'Recordatorio', sub: null, editable: false },
    ],
    cita: 'Te recuerdo la reunión del lunes.',
    nota: 'Se manda desde tu Gmail.',
  };

  // 🔴 El test del contrato («el detalle GANA sobre AMOUNT_RE»). Gmail no tiene `showAmount`, así que NO
  // se puede escribir con el piloto real: se escribe sobre el MECANISMO con Mercado Pago sintético. Rojo
  // antes del fix (el core ni leía `card.detalle`): el monto pintado era el $999 del texto.
  it('🔴 con `detalle`, el importe sale de la fila «Importe» y NO de la regex del texto', () => {
    const gate = mapearGate(
      msg({
        text: 'Voy a generar un link de cobro de MercadoPago por $999 (anticipo). ¿Confirmás?',
        card: {
          kind: 'confirm',
          service: 'mercadopago',
          label: 'Mercado Pago',
          detalle: {
            titulo: 'Link de cobro',
            filas: [{ k: 'Importe', v: '200000.00', sub: null, editable: false }],
            cita: null,
            nota: null,
          },
        },
      }),
    );

    // El Decimal del wire (`200000.00`) conserva sus centavos: es la convención de `formatearImporte`.
    expect(gate?.amount).toBe('200.000,00');
    expect(gate?.amount).not.toBe('999');
    expect(gate?.detalle?.titulo).toBe('Link de cobro');
  });

  // Fallback: historial viejo rehidratado y todo servicio que el backend no migró. Es el único camino de
  // MP hasta que migre a `detalle`: tiene que seguir andando EXACTAMENTE como hoy.
  it('sin `detalle`, `AMOUNT_RE` sigue funcionando como antes (fallback legado)', () => {
    const gate = mapearGate(
      msg({
        text: 'Voy a generar un link de cobro de MercadoPago por $80000 (Diseño de logo). ¿Confirmás?',
        card: { kind: 'confirm', service: 'mercadopago', label: 'Mercado Pago' },
      }),
    );

    expect(gate?.amount).toBe('80.000');
    expect(gate?.detalle).toBeUndefined();
  });

  it('un `detalle` ilegible no rompe el gate: cae a la regex y al markdown', () => {
    const gate = mapearGate(
      msg({
        text: 'Link de cobro por $80000. ¿Confirmás?',
        card: {
          kind: 'confirm',
          service: 'mercadopago',
          label: 'Mercado Pago',
          detalle: { titulo: '', filas: 'no-es-array' },
        },
      }),
    );

    expect(gate?.amount).toBe('80.000');
    expect(gate?.detalle).toBeUndefined();
  });

  it('Gmail (sin `showAmount`): el detalle viaja, `Para` es el email y NO hay monto', () => {
    const gate = mapearGate(
      msg({
        text: 'Voy a mandar un mail a **Lucía**. ¿Confirmás?',
        card: { kind: 'confirm', service: 'gmail', label: 'Gmail', detalle: detalleGmail },
      }),
    );

    expect(gate?.detalle?.filas.map((f) => f.clave)).toEqual(['Para', 'Asunto']);
    expect(gate?.detalle?.cita).toBe('Te recuerdo la reunión del lunes.');
    // `Para` sale de los arguments (el email que se va a usar), no de la negrita del texto.
    expect(gate?.name).toBe('lucia@x.com');
    expect(gate?.amount).toBeUndefined();
  });

  it('sin fila «Para», el nombre sigue saliendo de la negrita del texto (fallback)', () => {
    const gate = mapearGate(
      msg({
        text: 'Voy a mandar un mail a **Lucía**. ¿Confirmás?',
        card: { kind: 'confirm', service: 'gmail', label: 'Gmail' },
      }),
    );

    expect(gate?.name).toBe('Lucía');
  });
});
