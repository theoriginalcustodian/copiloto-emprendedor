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
      getReply: vi.fn(),
    },
  };
});

import { api } from '../../lib/api';
import { useChat } from './useChat';

const POLL_INTERVAL_MS = 1500;

describe('useChat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.mocked(api.sendChat).mockReset();
    vi.mocked(api.getReply).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('send agrega el msg del usuario ya mismo y la respuesta del assistant llega por polling', async () => {
    vi.mocked(api.sendChat).mockResolvedValueOnce({ wf_id: 'wf-1', accepted: true });
    vi.mocked(api.getReply)
      // 1er poll (inmediato, disparado por send): todavía nada — el agente durable sigue procesando.
      .mockResolvedValueOnce({ replies: [], next_id: 0 })
      // 2do poll (disparado por el intervalo): llega la respuesta.
      .mockResolvedValueOnce({ replies: [{ id: 1, text: 'Hola, en qué te ayudo?' }], next_id: 1 });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.send('Hola');
    });

    // El mensaje del usuario aparece de inmediato, sin esperar al agente.
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({ role: 'user', text: 'Hola' });
    expect(result.current.sendStatus).toBe('waiting');

    // Deja resolver el 1er poll inmediato (sin timers de por medio).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.messages).toHaveLength(1); // todavía sin respuesta
    expect(api.getReply).toHaveBeenCalledTimes(1);

    // Avanza el intervalo de polling -> dispara el 2do getReply, que sí trae la respuesta.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(api.getReply).toHaveBeenCalledTimes(2);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant', text: 'Hola, en qué te ayudo?' });
    expect(result.current.sendStatus).toBe('idle');

    // El polling se detuvo (llegó la respuesta) — avanzar más no debería generar más llamadas.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });
    expect(api.getReply).toHaveBeenCalledTimes(2);
  });

  it('ignora texto vacío/solo-espacios sin llamar a la API', async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.send('   ');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(api.sendChat).not.toHaveBeenCalled();
  });

  it('si sendChat falla, marca sendStatus=error y no arranca el polling', async () => {
    vi.mocked(api.sendChat).mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.send('Hola');
    });

    expect(result.current.sendStatus).toBe('error');
    expect(api.getReply).not.toHaveBeenCalled();
  });
});
