import { describe, expect, it } from 'vitest';

import { leerRecibo } from './reciboCard';

describe('leerRecibo', () => {
  it('lee la forma real que emite el backend', () => {
    expect(
      leerRecibo({
        recibo: { titulo: 'Mandado a lucia@x.com', meta: '15:41', accion: null },
        confirmed_tool: { name: 'gmail_send', confirmed: true, status: 'ok' },
      }),
    ).toEqual({ titulo: 'Mandado a lucia@x.com', meta: '15:41' });
  });

  it('`meta: null` (sin reloj) es válido: el recibo sale sin hora, no se inventa', () => {
    expect(leerRecibo({ recibo: { titulo: 'Mandado a lucia@x.com', meta: null } })).toEqual({
      titulo: 'Mandado a lucia@x.com',
      meta: null,
    });
  });

  // 🔴 La presencia de `card.recibo` es LA señal. El control negativo es el caso que el contrato nombra:
  // `confirmed_tool` dice `ok`, pero no hay `recibo` → no se pinta «Mandado a…».
  it('🔴 `confirmed_tool.status === "ok"` SIN `recibo` no produce recibo', () => {
    expect(
      leerRecibo({ confirmed_tool: { name: 'gmail_send', confirmed: true, status: 'ok' } }),
    ).toBeNull();
  });

  it('un recibo sin título legible es null (no dice qué pasó)', () => {
    expect(leerRecibo({ recibo: { titulo: '', meta: '15:41' } })).toBeNull();
    expect(leerRecibo({ recibo: { meta: '15:41' } })).toBeNull();
    expect(leerRecibo({ recibo: 'Mandado' })).toBeNull();
    expect(leerRecibo({ recibo: null })).toBeNull();
  });

  it('sin card: null', () => {
    expect(leerRecibo(undefined)).toBeNull();
    expect(leerRecibo(null)).toBeNull();
  });
});
