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
    apiReal: { ...actual.apiReal, getReply: jest.fn() },
  };
});

import { apiReal as api, sendSoporteChat } from '@copiloto/core';

import { almacenClave } from '../../adapters/almacen';
import { leerOCrearSessionIdSoporte, useChatSoporte } from './useChatSoporte';

describe('useChatSoporte (SOP5, mobile) — mismo patrón que useChat, otro transporte', () => {
  beforeEach(() => {
    jest.mocked(almacenClave.leer).mockReset().mockResolvedValue(null);
    jest.mocked(almacenClave.guardar).mockReset().mockResolvedValue(undefined);
    jest.mocked(sendSoporteChat).mockReset();
    jest.mocked(api.getReply).mockReset();
  });

  it('el session_id lleva el prefijo sop: — pide el contrato SOP5', async () => {
    const id = await leerOCrearSessionIdSoporte('cli-1');
    expect(id.startsWith('sop:')).toBe(true);
  });

  it('la clave que guarda el session_id es la de SOPORTE, no la de negocio, aun con el mismo clienteId', async () => {
    // Control diferencial: si `useChatSoporte` reusara el prefijo de storage de `useChat` (mismo
    // clienteId), el historial de soporte y el de negocio se pisarían entre sí en el mismo device.
    await leerOCrearSessionIdSoporte('cli-1');
    expect(almacenClave.guardar).toHaveBeenCalledWith(
      expect.stringContaining('copiloto-soporte-session-id'),
      expect.any(String),
    );
    const [clave] = jest.mocked(almacenClave.guardar).mock.calls[0]!;
    expect(clave).not.toContain('copiloto-chat-session-id'); // la clave de NEGOCIO, nunca esta
  });

  it('hidrata y termina con historial vacío tras el 1er poll', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test'));

    await waitFor(() => expect(result.current.estado).not.toBeNull());
    expect(result.current.estado?.messages).toEqual([]);
    unmount();
  });

  it('send llama a sendSoporteChat (POST /soporte/chat), NUNCA a sendChat', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(sendSoporteChat).mockResolvedValue({ wf_id: 'wf-1', accepted: true });

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test'));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.send('no me deja facturar');
    });

    expect(sendSoporteChat).toHaveBeenCalledTimes(1);
    expect(sendSoporteChat).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'no me deja facturar', kind: 'text' }),
    );
    // Drena el poll inmediato que dispara `iniciarEsperaDeRespuesta` antes de desmontar -- si no,
    // esa promesa en vuelo sigue corriendo tras el unmount y puede pisar el siguiente test.
    await waitFor(() => expect(api.getReply).toHaveBeenCalled());
    unmount();
  });

  it('el mensaje del usuario aparece OPTIMISTA, antes de que la red responda', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(sendSoporteChat).mockReturnValue(new Promise(() => {})); // nunca resuelve

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test'));
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

    const { result, unmount } = await renderHook(() => useChatSoporte('cli-test'));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.send('x');
    });

    expect(result.current.estado?.sendStatus).toBe('error');
    expect(result.current.estado?.motivoFallo).toBe('red');
    unmount();
  });
});
