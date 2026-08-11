import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, getReply: vi.fn() },
    sendSoporteChat: vi.fn(),
    sendSoporteAudio: vi.fn(),
  };
});

import { api, sendSoporteAudio, sendSoporteChat } from '../../lib/api';
import { useChatSoporte } from './useChatSoporte';

const FUNCION = 'soporte_tecnico' as const;

describe('useChatSoporte (SOP5, web) — shape corregido 2026-08-10 (funcion + session_id del servidor)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.getReply).mockReset();
    vi.mocked(sendSoporteChat).mockReset();
    vi.mocked(sendSoporteAudio).mockReset();
  });

  it('el session_id lleva prefijo sop: y su clave de storage es DISTINTA de la del chat de negocio', async () => {
    vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });

    // Sembramos la clave de NEGOCIO (mismo clienteId) a mano — si soporte reusara esa clave, la
    // leería/pisaría acá. `useChat` de negocio en web NO scopea por clienteId; `useChatSoporte` sí,
    // así que ni el nombre de la clave puede coincidir.
    window.localStorage.setItem('copiloto-chat-session-id', 'sesion-de-negocio');

    const { unmount } = renderHook(() => useChatSoporte('cli-1', FUNCION));
    await waitFor(() => expect(api.getReply).toHaveBeenCalled());

    const clavesSoporte = Object.keys(window.localStorage).filter((k) => k.startsWith('copiloto-soporte-session-id'));
    expect(clavesSoporte).toHaveLength(1);
    const idGuardado = window.localStorage.getItem(clavesSoporte[0]!);
    expect(idGuardado?.startsWith('sop:')).toBe(true);
    expect(window.localStorage.getItem('copiloto-chat-session-id')).toBe('sesion-de-negocio'); // intacta
    unmount();
  });

  it('la clave de storage está scoped por función — soporte_tecnico y como_uso_la_app son DOS hilos', async () => {
    // Control diferencial: si el hook no scopeara por `funcion`, "soporte técnico" y "cómo uso la
    // app" del mismo usuario compartirían storage y se pisarían entre sí.
    vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });

    const { unmount: unmountTecnico } = renderHook(() => useChatSoporte('cli-1', 'soporte_tecnico'));
    await waitFor(() => expect(api.getReply).toHaveBeenCalled());
    unmountTecnico();

    const { unmount: unmountComoUso } = renderHook(() => useChatSoporte('cli-1', 'como_uso_la_app'));
    await waitFor(() => expect(api.getReply).toHaveBeenCalledTimes(2));
    unmountComoUso();

    const claveTecnico = window.localStorage.getItem('copiloto-soporte-session-id:cli-1:soporte_tecnico');
    const claveComoUso = window.localStorage.getItem('copiloto-soporte-session-id:cli-1:como_uso_la_app');
    expect(claveTecnico).not.toBeNull();
    expect(claveComoUso).not.toBeNull();
    expect(claveTecnico).not.toBe(claveComoUso);
  });

  it('send manda funcion en el body — el 422 real del backend es justamente por su ausencia', async () => {
    vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    vi.mocked(sendSoporteChat).mockResolvedValue({
      wf_id: 'wf-1', accepted: true, session_id: 'soporte:soporte_tecnico:sop:abc',
    });

    const { result, unmount } = renderHook(() => useChatSoporte('cli-1', FUNCION));
    await waitFor(() => expect(api.getReply).toHaveBeenCalled());

    await act(async () => {
      await result.current.send('no puedo emitir la factura');
    });

    expect(sendSoporteChat).toHaveBeenCalledTimes(1);
    expect(sendSoporteChat).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'no puedo emitir la factura', funcion: 'soporte_tecnico', kind: 'text' }),
    );
    unmount();
  });

  it('tras el 1er envío, el polling usa el session_id que devolvió el SERVIDOR, no el local', async () => {
    // Control diferencial del bug real: si `send` no migrara el session_id, este assert falla
    // porque `getReply` se sigue llamando con el `sop:<uuid>` local -- el chat quedaría mudo para
    // siempre sin ningún error que lo delate.
    vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    vi.mocked(sendSoporteChat).mockResolvedValue({
      wf_id: 'wf-1', accepted: true, session_id: 'soporte:soporte_tecnico:sop:DEL-SERVIDOR',
    });

    const { result, unmount } = renderHook(() => useChatSoporte('cli-1', FUNCION));
    await waitFor(() => expect(api.getReply).toHaveBeenCalled());

    await act(async () => {
      await result.current.send('hola');
    });

    await waitFor(() =>
      expect(api.getReply).toHaveBeenCalledWith('soporte:soporte_tecnico:sop:DEL-SERVIDOR', expect.any(Number)),
    );
    const claveSesion = window.localStorage.getItem('copiloto-soporte-session-id:cli-1:soporte_tecnico');
    expect(claveSesion).toBe('soporte:soporte_tecnico:sop:DEL-SERVIDOR');
    unmount();
  });

  it('el mensaje del usuario aparece OPTIMISTA antes de que la red responda', async () => {
    vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    vi.mocked(sendSoporteChat).mockReturnValue(new Promise(() => {})); // nunca resuelve

    const { result, unmount } = renderHook(() => useChatSoporte('cli-1', FUNCION));
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
    vi.mocked(sendSoporteChat).mockResolvedValue({
      wf_id: 'wf-1', accepted: true, session_id: 'soporte:soporte_tecnico:sop:abc',
    });

    const { result, unmount } = renderHook(() => useChatSoporte('cli-1', FUNCION));
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

  describe('sendAudio (ODOBI8 §C3) — espejo de send(), namespaced por funcion', () => {
    const AUDIO_FAKE = new Blob(['fake-audio-bytes'], { type: 'audio/webm' });

    it('manda el blob por sendSoporteAudio con la funcion fija del hook', async () => {
      vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
      vi.mocked(sendSoporteAudio).mockResolvedValue({
        wf_id: 'wf-1', accepted: true, session_id: 'soporte:soporte_tecnico:sop:abc', transcript: 'no me deja facturar',
      });

      const { result, unmount } = renderHook(() => useChatSoporte('cli-1', FUNCION));
      await waitFor(() => expect(api.getReply).toHaveBeenCalled());

      await act(async () => {
        await result.current.sendAudio(AUDIO_FAKE);
      });

      expect(sendSoporteAudio).toHaveBeenCalledWith(expect.any(String), AUDIO_FAKE, 'soporte_tecnico');
      expect(result.current.messages.some((m) => m.text === 'no me deja facturar')).toBe(true);
      unmount();
    });

    it('tras el envío, el polling usa el session_id del SERVIDOR, no el local -- mismo riesgo que send()', async () => {
      vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
      vi.mocked(sendSoporteAudio).mockResolvedValue({
        wf_id: 'wf-1', accepted: true, session_id: 'soporte:soporte_tecnico:sop:DEL-SERVIDOR', transcript: 'hola',
      });

      const { result, unmount } = renderHook(() => useChatSoporte('cli-1', FUNCION));
      await waitFor(() => expect(api.getReply).toHaveBeenCalled());

      await act(async () => {
        await result.current.sendAudio(AUDIO_FAKE);
      });

      await waitFor(() =>
        expect(api.getReply).toHaveBeenCalledWith('soporte:soporte_tecnico:sop:DEL-SERVIDOR', expect.any(Number)),
      );
      const claveSesion = window.localStorage.getItem('copiloto-soporte-session-id:cli-1:soporte_tecnico');
      expect(claveSesion).toBe('soporte:soporte_tecnico:sop:DEL-SERVIDOR');
      unmount();
    });

    it('transcript vacío (STT no entendió) es un envío EXITOSO sin mensaje -- vuelve a idle, no error', async () => {
      vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
      vi.mocked(sendSoporteAudio).mockResolvedValue({
        wf_id: 'wf-1', accepted: true, session_id: 'soporte:soporte_tecnico:sop:abc', transcript: '   ',
      });

      const { result, unmount } = renderHook(() => useChatSoporte('cli-1', FUNCION));
      await waitFor(() => expect(api.getReply).toHaveBeenCalled());
      const mensajesPrevios = result.current.messages.length;

      await act(async () => {
        await result.current.sendAudio(AUDIO_FAKE);
      });

      expect(result.current.messages).toHaveLength(mensajesPrevios);
      expect(result.current.sendStatus).toBe('idle');
      unmount();
    });

    it('un error de red deja sendStatus en error, sin agregar mensaje', async () => {
      vi.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
      vi.mocked(sendSoporteAudio).mockRejectedValue(new Error('network down'));

      const { result, unmount } = renderHook(() => useChatSoporte('cli-1', FUNCION));
      await waitFor(() => expect(api.getReply).toHaveBeenCalled());

      await act(async () => {
        await result.current.sendAudio(AUDIO_FAKE);
      });

      expect(result.current.sendStatus).toBe('error');
      unmount();
    });
  });
});
