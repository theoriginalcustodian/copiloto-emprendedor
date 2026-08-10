import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, getReply: vi.fn() },
    sendSoporteChat: vi.fn(),
  };
});

import { api, sendSoporteChat } from '../../lib/api';
import { useChatSoporte } from './useChatSoporte';

describe('useChatSoporte (SOP5, web) — hermano de useChat, otro transporte', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.getReply).mockReset();
    vi.mocked(sendSoporteChat).mockReset();
  });

  it('el session_id lleva prefijo sop: y su clave de storage es DISTINTA de la del chat de negocio', async () => {
    vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });

    // Sembramos la clave de NEGOCIO (mismo clienteId) a mano — si soporte reusara esa clave, la
    // leería/pisaría acá. `useChat` de negocio en web NO scopea por clienteId; `useChatSoporte` sí,
    // así que ni el nombre de la clave puede coincidir.
    window.localStorage.setItem('copiloto-chat-session-id', 'sesion-de-negocio');

    const { unmount } = renderHook(() => useChatSoporte('cli-1'));
    await waitFor(() => expect(api.getReply).toHaveBeenCalled());

    const clavesSoporte = Object.keys(window.localStorage).filter((k) => k.startsWith('copiloto-soporte-session-id'));
    expect(clavesSoporte).toHaveLength(1);
    const idGuardado = window.localStorage.getItem(clavesSoporte[0]!);
    expect(idGuardado?.startsWith('sop:')).toBe(true);
    expect(window.localStorage.getItem('copiloto-chat-session-id')).toBe('sesion-de-negocio'); // intacta
    unmount();
  });

  it('send llama a sendSoporteChat (POST /soporte/chat) — NUNCA a api.sendChat', async () => {
    vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    vi.mocked(sendSoporteChat).mockResolvedValue({ wf_id: 'wf-1', accepted: true });

    const { result, unmount } = renderHook(() => useChatSoporte('cli-1'));
    await waitFor(() => expect(api.getReply).toHaveBeenCalled());

    await act(async () => {
      await result.current.send('no puedo emitir la factura');
    });

    expect(sendSoporteChat).toHaveBeenCalledTimes(1);
    expect(sendSoporteChat).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'no puedo emitir la factura', kind: 'text' }),
    );
    unmount();
  });

  it('el mensaje del usuario aparece OPTIMISTA antes de que la red responda', async () => {
    vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    vi.mocked(sendSoporteChat).mockReturnValue(new Promise(() => {})); // nunca resuelve

    const { result, unmount } = renderHook(() => useChatSoporte('cli-1'));
    await waitFor(() => expect(api.getReply).toHaveBeenCalled());

    await act(async () => {
      void result.current.send('hola soporte');
    });

    expect(result.current.messages.some((m) => m.text === 'hola soporte')).toBe(true);
    unmount();
  });

  it('la respuesta del agente llega por polling de GET /reply — mismo endpoint que negocio', async () => {
    vi.mocked(api.getReply)
      .mockResolvedValueOnce({ replies: [], next_id: 0 }) // poll de rehidratación al montar
      .mockResolvedValueOnce({
        replies: [{ id: 1, text: 'Te abro un ticket', choices: undefined, card: undefined }],
        next_id: 1,
      });
    vi.mocked(sendSoporteChat).mockResolvedValue({ wf_id: 'wf-1', accepted: true });

    const { result, unmount } = renderHook(() => useChatSoporte('cli-1'));
    await waitFor(() => expect(api.getReply).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.send('tengo un problema');
    });

    await waitFor(() =>
      expect(result.current.messages.some((m) => m.text === 'Te abro un ticket')).toBe(true),
    );
    expect(result.current.sendStatus).toBe('idle');
    unmount();
  });
});
