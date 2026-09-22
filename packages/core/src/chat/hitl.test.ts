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
