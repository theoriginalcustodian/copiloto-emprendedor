import { act, renderHook, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

/** Mismo molde que `modules/chat/useChat.test.ts` — stub simple, sin estado propio entre tests.
 *  (Un almacén STATEFUL con closure propio se probó primero y produjo fallos intermitentes de
 *  `almacenClave` undefined en tests que disparan `send()` — un `setInterval`/poll en vuelo que
 *  sobrevive al `unmount()` corre contra un cierre que Jest ya movió; el stub simple, que es el que
 *  usa el 100% del resto de esta suite, no tiene ese problema.) La aserción de "clave distinta" se
 *  hace sobre los ARGUMENTOS de la llamada al mock, no sobre un Map compartido. */
jest.mock('../../adapters/almacen', () => ({
  almacenClave: {
    leer: jest.fn().mockResolvedValue(null),
    guardar: jest.fn().mockResolvedValue(undefined),
    borrar: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    sendSoporteChat: jest.fn(),
    sendSoporteAudio: jest.fn(),
    apiReal: { ...actual.apiReal, getReply: jest.fn() },
  };
});

/** `deleteAsync` -- el borrado de `enviarAudio` es best-effort, así que los tests lo espían para
 *  verificar que se INTENTA, no para que el resultado del envío dependa de él. Mismo molde que
 *  `modules/chat/useChat.test.ts`. */
jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

import { apiReal as api, sendSoporteAudio, sendSoporteChat } from '@copiloto/core';
import { deleteAsync } from 'expo-file-system/legacy';

import { almacenClave } from '../../adapters/almacen';
import { leerOCrearSessionIdSoporte, useChatSoporte } from './useChatSoporte';

const FUNCION = 'soporte_tecnico' as const;

describe('useChatSoporte (SOP5, mobile) — shape corregido 2026-08-10 (funcion + session_id del servidor)', () => {
  beforeEach(() => {
    jest.mocked(almacenClave.leer).mockReset().mockResolvedValue(null);
    jest.mocked(almacenClave.guardar).mockReset().mockResolvedValue(undefined);
    jest.mocked(sendSoporteChat).mockReset();
    jest.mocked(api.getReply).mockReset();
  });

  it('el session_id local de arranque lleva el prefijo sop:', async () => {
    const id = await leerOCrearSessionIdSoporte('cli-1', FUNCION);
    expect(id.startsWith('sop:')).toBe(true);
  });

  it('la clave de storage está scoped por función — soporte_tecnico y como_uso_la_app son DOS hilos', async () => {
    // Control diferencial: si `useChatSoporte` no scopeara por `funcion`, "soporte técnico" y "cómo
    // uso la app" del mismo usuario compartirían storage y se pisarían entre sí.
    await leerOCrearSessionIdSoporte('cli-1', 'soporte_tecnico');
    const [claveTecnico] = jest.mocked(almacenClave.guardar).mock.calls[0]!;

    jest.mocked(almacenClave.guardar).mockClear();
    await leerOCrearSessionIdSoporte('cli-1', 'como_uso_la_app');
    const [claveComoUso] = jest.mocked(almacenClave.guardar).mock.calls[0]!;

    expect(claveTecnico).not.toBe(claveComoUso);
    expect(claveTecnico).not.toContain('copiloto-chat-session-id'); // la clave de NEGOCIO, nunca esta
  });

  it('hidrata y termina con historial vacío tras el 1er poll', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test', FUNCION));

    await waitFor(() => expect(result.current.estado).not.toBeNull());
    expect(result.current.estado?.messages).toEqual([]);
    unmount();
  });

  it('send manda funcion en el body — el 400 real del backend es justamente por su ausencia', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(sendSoporteChat).mockResolvedValue({
      wf_id: 'wf-1', accepted: true, session_id: 'soporte:soporte_tecnico:sop:abc',
    });

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test', FUNCION));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.send('no me deja facturar');
    });

    expect(sendSoporteChat).toHaveBeenCalledTimes(1);
    expect(sendSoporteChat).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'no me deja facturar', funcion: 'soporte_tecnico', kind: 'text' }),
    );
    await waitFor(() => expect(api.getReply).toHaveBeenCalled());
    unmount();
  });

  it('tras el 1er envío, el polling usa el session_id que devolvió el SERVIDOR, no el local', async () => {
    // Control diferencial del bug real: si `send` no migrara `sessionId`, este assert falla porque
    // `getReply` se sigue llamando con el `sop:<uuid>` local -- el chat quedaría mudo para siempre.
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(sendSoporteChat).mockResolvedValue({
      wf_id: 'wf-1', accepted: true, session_id: 'soporte:soporte_tecnico:sop:DEL-SERVIDOR',
    });

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test', FUNCION));
    await waitFor(() => expect(result.current.estado).not.toBeNull());
    const sessionIdLocal = result.current.estado!.sessionId;

    await act(async () => {
      await result.current.send('hola');
    });

    expect(result.current.estado?.sessionId).toBe('soporte:soporte_tecnico:sop:DEL-SERVIDOR');
    expect(result.current.estado?.sessionId).not.toBe(sessionIdLocal);
    await waitFor(() =>
      expect(api.getReply).toHaveBeenCalledWith('soporte:soporte_tecnico:sop:DEL-SERVIDOR', expect.any(Number)),
    );
    unmount();
  });

  it('el mensaje del usuario aparece OPTIMISTA, antes de que la red responda', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(sendSoporteChat).mockReturnValue(new Promise(() => {})); // nunca resuelve

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test', FUNCION));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      void result.current.send('hola soporte');
    });

    await waitFor(() =>
      expect(result.current.estado?.messages.some((m) => m.text === 'hola soporte')).toBe(true),
    );
    unmount();
  });

  it('un fallo SIN status HTTP (sin ApiError) se clasifica como "red" — motivoDeError real, no un stub', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(sendSoporteChat).mockRejectedValue(new Error('boom'));

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test', FUNCION));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.send('x');
    });

    expect(result.current.estado?.sendStatus).toBe('error');
    expect(result.current.estado?.motivoFallo).toBe('red');
    unmount();
  });
});

const ARCHIVO_VOZ = { nombre: 'voz.m4a', mime: 'audio/mp4', datos: 'file:///cache/voz.m4a' };

describe('useChatSoporte -- enviarAudio (ODOBI8 §C2, voz en el chat de soporte)', () => {
  beforeEach(() => {
    jest.mocked(almacenClave.leer).mockReset().mockResolvedValue(null);
    jest.mocked(almacenClave.guardar).mockReset().mockResolvedValue(undefined);
    jest.mocked(sendSoporteAudio).mockReset();
    jest.mocked(api.getReply).mockReset().mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(deleteAsync).mockClear();
  });

  it('transcript OK: manda (sessionId, archivo, funcion) a sendSoporteAudio -- NO /chat/audio', async () => {
    jest.mocked(sendSoporteAudio).mockResolvedValue({
      wf_id: 'wf-a1', accepted: true, session_id: 'soporte:soporte_tecnico:sop:abc', transcript: 'no me deja facturar',
    });

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test', FUNCION));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarAudio(ARCHIVO_VOZ);
    });

    expect(result.current.estado?.messages).toEqual([
      expect.objectContaining({ role: 'user', text: 'no me deja facturar' }),
    ]);
    expect(result.current.estado?.sendStatus).toBe('waiting');
    expect(sendSoporteAudio).toHaveBeenCalledWith(expect.any(String), ARCHIVO_VOZ, 'soporte_tecnico');
    unmount();
  });

  it('adopta el session_id que devuelve el SERVIDOR, mismo cuidado que send() -- si no, /reply pega mudo', async () => {
    jest.mocked(sendSoporteAudio).mockResolvedValue({
      wf_id: 'wf-a2', accepted: true, session_id: 'soporte:soporte_tecnico:sop:DEL-SERVIDOR', transcript: 'hola',
    });

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test', FUNCION));
    await waitFor(() => expect(result.current.estado).not.toBeNull());
    const sessionIdLocal = result.current.estado!.sessionId;

    await act(async () => {
      await result.current.enviarAudio(ARCHIVO_VOZ);
    });

    expect(result.current.estado?.sessionId).toBe('soporte:soporte_tecnico:sop:DEL-SERVIDOR');
    expect(result.current.estado?.sessionId).not.toBe(sessionIdLocal);
    await waitFor(() =>
      expect(api.getReply).toHaveBeenCalledWith('soporte:soporte_tecnico:sop:DEL-SERVIDOR', expect.any(Number)),
    );
    unmount();
  });

  it('CERO retención: borra el archivo local tras un envío exitoso', async () => {
    jest.mocked(sendSoporteAudio).mockResolvedValue({
      wf_id: 'wf-a3', accepted: true, session_id: 'soporte:soporte_tecnico:sop:abc', transcript: 'listo',
    });

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test', FUNCION));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarAudio(ARCHIVO_VOZ);
    });

    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/voz.m4a', { idempotent: true });
    unmount();
  });

  it('CERO retención: borra el archivo local incluso si el upload falla', async () => {
    jest.mocked(sendSoporteAudio).mockRejectedValue(new Error('network down'));

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test', FUNCION));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarAudio(ARCHIVO_VOZ);
    });

    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/voz.m4a', { idempotent: true });
    expect(result.current.estado?.sendStatus).toBe('error');
    expect(result.current.estado?.motivoFallo).toBe('red');
    unmount();
  });

  it('transcript vacío (STT no entendió): el envío SALIÓ BIEN, motivo audio_no_entendido, sin mensaje fantasma', async () => {
    jest.mocked(sendSoporteAudio).mockResolvedValue({
      wf_id: 'wf-a4', accepted: true, session_id: 'soporte:soporte_tecnico:sop:abc', transcript: '   ',
    });

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test', FUNCION));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarAudio(ARCHIVO_VOZ);
    });

    expect(result.current.estado?.sendStatus).toBe('error');
    expect(result.current.estado?.motivoFallo).toBe('audio_no_entendido');
    expect(result.current.estado?.messages).toEqual([]);
    unmount();
  });
});
