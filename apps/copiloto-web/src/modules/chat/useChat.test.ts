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

import { api } from '../../lib/api';
import { useChat } from './useChat';

const POLL_INTERVAL_MS = 1500;
const WARM_THROTTLE_MS = 5 * 60_000;

describe('useChat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.mocked(api.sendChat).mockReset();
    vi.mocked(api.sendAudio).mockReset();
    vi.mocked(api.getReply).mockReset();
    vi.mocked(api.warm).mockReset();
    vi.mocked(api.warm).mockResolvedValue({ warmed: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('send agrega el msg del usuario ya mismo y la respuesta del assistant llega por polling', async () => {
    vi.mocked(api.sendChat).mockResolvedValueOnce({ wf_id: 'wf-1', accepted: true });
    vi.mocked(api.getReply)
      // poll de rehidratación al montar (Task 19/review): sesión nueva, sin historial -> after_id=0.
      .mockResolvedValueOnce({ replies: [], next_id: 0 })
      // 1er poll (inmediato, disparado por send): todavía nada — el agente durable sigue procesando.
      .mockResolvedValueOnce({ replies: [], next_id: 0 })
      // 2do poll (disparado por el intervalo): llega la respuesta.
      .mockResolvedValueOnce({ replies: [{ id: 1, text: 'Hola, en qué te ayudo?' }], next_id: 1 });

    const { result } = renderHook(() => useChat());

    // Deja resolver el poll de rehidratación disparado al montar antes de enviar (aísla el flujo).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.getReply).toHaveBeenCalledTimes(1);
    expect(api.getReply).toHaveBeenNthCalledWith(1, expect.any(String), 0);
    expect(result.current.messages).toHaveLength(0);

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
    expect(api.getReply).toHaveBeenCalledTimes(2);

    // Avanza el intervalo de polling -> dispara el 3er getReply, que sí trae la respuesta.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(api.getReply).toHaveBeenCalledTimes(3);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant', text: 'Hola, en qué te ayudo?' });
    expect(result.current.sendStatus).toBe('idle');

    // El polling se detuvo (llegó la respuesta) — avanzar más no debería generar más llamadas.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });
    expect(api.getReply).toHaveBeenCalledTimes(3);
  });

  it('ignora texto vacío/solo-espacios sin llamar a la API', async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.send('   ');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(api.sendChat).not.toHaveBeenCalled();
  });

  it('si sendChat falla, marca sendStatus=error y no arranca el polling (más allá del poll de rehidratación al montar)', async () => {
    vi.mocked(api.getReply).mockResolvedValueOnce({ replies: [], next_id: 0 }); // poll de rehidratación al montar
    vi.mocked(api.sendChat).mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useChat());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // deja resolver el poll de montaje antes de enviar
    });
    expect(api.getReply).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.send('Hola');
    });

    expect(result.current.sendStatus).toBe('error');
    expect(api.getReply).toHaveBeenCalledTimes(1); // el fallo de sendChat no agrega llamadas nuevas
  });

  describe('sendAudio (Task 19)', () => {
    it('sube el blob, agrega el transcript como msg de usuario (recién con la respuesta) y pollea /reply', async () => {
      vi.mocked(api.sendAudio).mockResolvedValueOnce({
        wf_id: 'wf-audio-1',
        accepted: true,
        transcript: 'Mandale un mail a Juan',
      });
      vi.mocked(api.getReply)
        .mockResolvedValueOnce({ replies: [], next_id: 0 }) // poll de rehidratación al montar
        .mockResolvedValueOnce({ replies: [], next_id: 0 }) // 1er poll (inmediato, disparado por sendAudio)
        .mockResolvedValueOnce({ replies: [{ id: 1, text: 'Dale, se lo mando.' }], next_id: 1 }); // por el intervalo

      const { result } = renderHook(() => useChat());
      const blob = new Blob(['fake-audio-bytes'], { type: 'audio/webm' });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0); // deja resolver el poll de montaje
      });
      expect(api.getReply).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.sendAudio(blob);
      });

      expect(api.sendAudio).toHaveBeenCalledWith(expect.any(String), blob);
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toMatchObject({ role: 'user', text: 'Mandale un mail a Juan' });
      expect(result.current.sendStatus).toBe('waiting');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(api.getReply).toHaveBeenCalledTimes(2);
      expect(result.current.messages).toHaveLength(1); // todavía sin respuesta del agente

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      });
      expect(api.getReply).toHaveBeenCalledTimes(3);
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1]).toMatchObject({ role: 'assistant', text: 'Dale, se lo mando.' });
      expect(result.current.sendStatus).toBe('idle');
    });

    it('si sendAudio falla (ej. STT/red), marca sendStatus=error y no arranca el polling ni agrega mensaje', async () => {
      vi.mocked(api.getReply).mockResolvedValueOnce({ replies: [], next_id: 0 }); // poll de rehidratación al montar
      vi.mocked(api.sendAudio).mockRejectedValueOnce(new Error('network down'));

      const { result } = renderHook(() => useChat());
      const blob = new Blob(['x'], { type: 'audio/webm' });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0); // deja resolver el poll de montaje
      });
      expect(api.getReply).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.sendAudio(blob);
      });

      expect(result.current.sendStatus).toBe('error');
      expect(result.current.messages).toHaveLength(0);
      expect(api.getReply).toHaveBeenCalledTimes(1); // el fallo de sendAudio no agrega llamadas nuevas
    });
  });

  describe('rehidratación + poll-on-mount (durabilidad — fix de review adversarial)', () => {
    const SESSION_ID = 'sess-rehidratacion-test';
    const MESSAGES_KEY = `copiloto-chat-msgs:${SESSION_ID}`;

    beforeEach(() => {
      window.localStorage.setItem('copiloto-chat-session-id', SESSION_ID);
    });

    it('al montar, rehidrata los messages persistidos en localStorage', async () => {
      const persisted = [
        { id: 'user-1', role: 'user', text: 'Mandale un mail a Juan' },
        { id: 'assistant-3', role: 'assistant', text: 'Dale, ya lo hice.' },
      ];
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));
      vi.mocked(api.getReply).mockResolvedValueOnce({ replies: [], next_id: 3 });

      const { result } = renderHook(() => useChat());

      // Rehidratado YA en el primer render — no hace falta esperar ningún poll para verlo.
      expect(result.current.messages).toEqual(persisted);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    });

    it('al montar, dispara un poll con after_id = mayor id de assistant ya visto, y agrega replies que llegaron mientras estaba desmontado', async () => {
      const persisted = [
        { id: 'user-1', role: 'user', text: 'Mandale un mail a Juan' },
        { id: 'assistant-3', role: 'assistant', text: 'Dale, ya lo hice.' },
      ];
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(persisted));
      vi.mocked(api.getReply).mockResolvedValueOnce({
        replies: [{ id: 4, text: 'Además, le mandé el recordatorio (esto llegó mientras no mirabas).' }],
        next_id: 4,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.getReply).toHaveBeenCalledWith(SESSION_ID, 3); // after_id derivado del rehidratado, NO 0
      expect(result.current.messages).toHaveLength(3);
      expect(result.current.messages[2]).toMatchObject({
        role: 'assistant',
        text: 'Además, le mandé el recordatorio (esto llegó mientras no mirabas).',
      });
    });

    it('sin messages persistidos, el poll de montaje usa after_id=0', async () => {
      vi.mocked(api.getReply).mockResolvedValueOnce({ replies: [], next_id: 0 });

      renderHook(() => useChat());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.getReply).toHaveBeenCalledWith(SESSION_ID, 0);
    });

    it('persiste messages en localStorage tras un send', async () => {
      vi.mocked(api.getReply).mockResolvedValueOnce({ replies: [], next_id: 0 }); // poll de montaje
      vi.mocked(api.sendChat).mockResolvedValueOnce({ wf_id: 'wf-2', accepted: true });

      const { result } = renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        await result.current.send('Hola de nuevo');
      });

      const stored: unknown = JSON.parse(window.localStorage.getItem(MESSAGES_KEY) ?? '[]');
      expect(stored).toHaveLength(1);
      expect(stored).toMatchObject([{ role: 'user', text: 'Hola de nuevo' }]);
    });
  });

  describe('warm de memoria (perceived latency)', () => {
    // Session id único por test → el throttle a nivel de módulo (lastWarmAtBySession) no filtra entre
    // tests: cada uno arranca sin entrada previa y el 1er warm siempre dispara.
    let warmSeq = 0;
    function freshSession(): string {
      const sid = `warm-sess-${++warmSeq}`;
      window.localStorage.setItem('copiloto-chat-session-id', sid);
      return sid;
    }

    beforeEach(() => {
      vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 }); // poll-on-mount inocuo
    });

    it('al montar (entrar al chat / abrir la app) precalienta la memoria una vez', async () => {
      freshSession();
      renderHook(() => useChat());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.warm).toHaveBeenCalledTimes(1);
    });

    it('re-warmea al volver la pestaña a visible una vez pasado el throttle', async () => {
      freshSession();
      renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(api.warm).toHaveBeenCalledTimes(1); // warm del montaje

      // Pasa el throttle y la pestaña vuelve a visible (jsdom: visibilityState='visible' por default).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(WARM_THROTTLE_MS + 1);
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.warm).toHaveBeenCalledTimes(2);
    });

    it('no re-warmea en un remonte inmediato (throttle absorbe cruzar el breakpoint mobile/desktop)', async () => {
      freshSession();
      const { unmount } = renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(api.warm).toHaveBeenCalledTimes(1);

      // Remonte inmediato con la MISMA sesión, sin avanzar el reloj → throttle bloquea el 2do warm.
      unmount();
      renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.warm).toHaveBeenCalledTimes(1);
    });

    it('un fallo del warm no rompe el chat (best-effort, fire-and-forget)', async () => {
      freshSession();
      vi.mocked(api.warm).mockRejectedValueOnce(new Error('graphity down'));

      const { result } = renderHook(() => useChat());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // El warm falló pero el hook sigue operativo: el estado inicial es sano y se puede seguir.
      expect(api.warm).toHaveBeenCalledTimes(1);
      expect(result.current.sendStatus).toBe('idle');
      expect(result.current.messages).toHaveLength(0);
    });
  });
});
