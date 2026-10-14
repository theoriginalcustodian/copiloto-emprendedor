import { describe, expect, it } from 'vitest';

import { formatearHoraDeMensaje, idMensajeSinConfirmar } from './horaMensaje';

describe('formatearHoraDeMensaje', () => {
  it('hora sin cero a la izquierda, minutos con dos dígitos (reloj local del dispositivo)', () => {
    expect(formatearHoraDeMensaje(new Date(2026, 9, 13, 9, 5).getTime())).toBe('9:05');
    expect(formatearHoraDeMensaje(new Date(2026, 9, 13, 21, 40).getTime())).toBe('21:40');
    expect(formatearHoraDeMensaje(new Date(2026, 9, 13, 0, 0).getTime())).toBe('0:00');
  });

  it('🔴 sin instante (historial viejo) o inválido → null: no se inventa una hora', () => {
    expect(formatearHoraDeMensaje(undefined)).toBeNull();
    expect(formatearHoraDeMensaje(null)).toBeNull();
    expect(formatearHoraDeMensaje(Number.NaN)).toBeNull();
    expect(formatearHoraDeMensaje(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('idMensajeSinConfirmar — «recibido» sólo después de que el servidor aceptó el envío', () => {
  const hilo = [
    { id: 'u1', role: 'user' as const },
    { id: 'a1', role: 'assistant' as const },
    { id: 'u2', role: 'user' as const },
  ];

  it('🔴 mientras el envío está en vuelo o falló, el último mensaje PROPIO no está confirmado', () => {
    expect(idMensajeSinConfirmar(hilo, 'sending')).toBe('u2');
    expect(idMensajeSinConfirmar(hilo, 'error')).toBe('u2');
  });

  it('con el envío aceptado (waiting/timeout) o sin envío (idle) todos están recibidos', () => {
    for (const s of ['idle', 'waiting', 'timeout', undefined] as const) {
      expect(idMensajeSinConfirmar(hilo, s)).toBeNull();
    }
  });

  it('salta los mensajes del asistente: el último que cuenta es el último del USUARIO', () => {
    const conRespuestaAlFinal = [...hilo, { id: 'a2', role: 'assistant' as const }];
    expect(idMensajeSinConfirmar(conRespuestaAlFinal, 'sending')).toBe('u2');
  });

  it('sin mensajes propios no hay nada sin confirmar', () => {
    expect(idMensajeSinConfirmar([{ id: 'a1', role: 'assistant' }], 'error')).toBeNull();
    expect(idMensajeSinConfirmar([], 'sending')).toBeNull();
  });
});
