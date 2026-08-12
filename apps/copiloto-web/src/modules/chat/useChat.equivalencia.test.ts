import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: {
      login: vi.fn(),
      me: vi.fn(),
      catalog: vi.fn(),
      sendChat: vi.fn(),
      sendAudio: vi.fn(),
      getReply: vi.fn(),
      warm: vi.fn(),
    },
  };
});

import { hidratarEstado, MAX_MENSAJES_HISTORIAL, reducirChat, type EstadoChat } from '@copiloto/core';
import { api } from '../../lib/api';
import { useChat } from './useChat';

/**
 * D8 (deuda, `docs/copiloto-emprendedor/Auditorias/2026-08-12-DEUDA-diferidos-con-dueno-y-fecha.md`):
 * `useChat.ts` (web) reimplementa `chatMachine.ts` (core) en vez de consumirlo, porque converger 348
 * líneas del hook de chat de producción sin revisor en vivo pesa más que la duplicación en sí — ver
 * la nota de planificación en el `dato_` de C6(b). Lo que SÍ compra casi la misma seguridad, más
 * barato: correr la MISMA secuencia de eventos contra el reducer real de `@copiloto/core`
 * (`reducirChat`/`hidratarEstado`) y contra el hook real `useChat`, y afirmar que terminan en el
 * mismo estado observable. Si una copia cambia su poda/dedupe sin la otra, este test rompe — que es
 * exactamente lo que la convergencia compraría, sin tocar sesión/polling/envío/audio de producción.
 */

const SESSION = 'sess-equivalencia';

function textosCore(estado: EstadoChat): Array<{ role: string; text: string }> {
  return estado.messages.map((m) => ({ role: m.role, text: m.text }));
}

describe('equivalencia core <-> web (D8)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.mocked(api.sendChat).mockReset();
    vi.mocked(api.getReply).mockReset();
    vi.mocked(api.warm).mockReset();
    vi.mocked(api.warm).mockResolvedValue({ warmed: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mensajes de usuario más allá de la cota: mismo `messages` final en core y en web', async () => {
    const total = MAX_MENSAJES_HISTORIAL + 25;
    const textos = Array.from({ length: total }, (_, i) => `msg ${i + 1}`);

    // Lado core: la MISMA secuencia de eventos contra el reducer real.
    let estadoCore = hidratarEstado(SESSION);
    for (const text of textos) {
      estadoCore = reducirChat(estadoCore, {
        tipo: 'mensaje_usuario_agregado',
        mensaje: { id: `user-${text}`, role: 'user', text },
      });
    }

    // Lado web: la MISMA secuencia de textos contra el hook real (sin respuestas del agente de por
    // medio -- getReply siempre vacío, así `messages` sólo crece por el lado del usuario).
    vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    vi.mocked(api.sendChat).mockResolvedValue({ wf_id: 'wf-equiv', accepted: true });

    const { result } = renderHook(() => useChat());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // deja resolver el poll de montaje
    });
    for (const text of textos) {
      // eslint-disable-next-line no-await-in-loop -- secuencial a propósito, igual que un usuario tipeando.
      await act(async () => {
        await result.current.send(text);
      });
    }

    expect(result.current.messages).toHaveLength(MAX_MENSAJES_HISTORIAL);
    expect(estadoCore.messages).toHaveLength(MAX_MENSAJES_HISTORIAL);
    expect(result.current.messages.map((m) => ({ role: m.role, text: m.text }))).toEqual(
      textosCore(estadoCore),
    );
  });

  it('rehidratar un historial más largo que la cota + un poll con un id repetido + uno nuevo: mismo dedupe/poda en core y en web', async () => {
    const total = MAX_MENSAJES_HISTORIAL + 30;
    const persistidos = Array.from({ length: total }, (_, i) => ({
      id: `assistant-${i + 1}`,
      role: 'assistant' as const,
      text: `histórico ${i + 1}`,
    }));
    // El servidor reenvía el último id ya visto (carrera de polling) + uno genuinamente nuevo.
    const repliesDelPoll = [
      { id: total, text: `histórico ${total}` },
      { id: total + 1, text: `histórico ${total + 1}` },
    ];

    // Lado core: hidratar con el historial completo y aplicar el mismo batch de `respuestas_recibidas`.
    const rehidratadoCore = hidratarEstado(SESSION, persistidos);
    const estadoCore = reducirChat(rehidratadoCore, {
      tipo: 'respuestas_recibidas',
      nextId: total + 1,
      replies: repliesDelPoll,
    });

    // Lado web: mismo historial en localStorage, mismo batch como respuesta del poll de montaje.
    const SESSION_ID = 'sess-equivalencia-rehidratacion';
    window.localStorage.setItem('copiloto-chat-session-id', SESSION_ID);
    window.localStorage.setItem(`copiloto-chat-msgs:${SESSION_ID}`, JSON.stringify(persistidos));
    vi.mocked(api.getReply).mockResolvedValueOnce({ replies: repliesDelPoll, next_id: total + 1 });

    const { result } = renderHook(() => useChat());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.messages).toHaveLength(MAX_MENSAJES_HISTORIAL);
    expect(estadoCore.messages).toHaveLength(MAX_MENSAJES_HISTORIAL);
    // El repetido (id=total) no se duplicó y el nuevo (id=total+1) sí entró, igual en las dos copias.
    expect(result.current.messages.map((m) => ({ role: m.role, text: m.text }))).toEqual(
      textosCore(estadoCore),
    );
    expect(estadoCore.messages.at(-1)!.text).toBe(`histórico ${total + 1}`);
  });
});
