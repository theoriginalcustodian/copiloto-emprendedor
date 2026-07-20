import { act, renderHook, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

/** Almacén en memoria para aislar estos tests de `AsyncStorage` real. */
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
    apiReal: {
      ...actual.apiReal,
      sendChat: jest.fn(),
      getReply: jest.fn(),
    },
  };
});

import { apiReal as api } from '@copiloto/core';

import { useChat } from './useChat';

describe('useChat (hook de efectos, fork mobile de DocuMed sin voz/cliente activo)', () => {
  beforeEach(() => {
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.getReply).mockReset();
  });

  it('hidrata y termina con un EstadoChat de historial vacío tras el 1er poll', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });

    // `renderHook`/`render` de esta versión de @testing-library/react-native son `async`.
    const { result, unmount } = await renderHook(() => useChat());

    await waitFor(() => expect(result.current.estado).not.toBeNull());
    expect(result.current.estado?.messages).toEqual([]);
    unmount();
  });

  it('send agrega el mensaje del usuario de forma OPTIMISTA (antes de que la red responda)', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    // La red nunca resuelve durante este test -- si el mensaje sólo apareciera DESPUÉS del POST, esta
    // promesa colgada lo dejaría afuera para siempre.
    jest.mocked(api.sendChat).mockReturnValue(new Promise(() => {}));

    const { result, unmount } = await renderHook(() => useChat());
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      void result.current.send('hola copiloto');
    });

    await waitFor(() =>
      expect(result.current.estado?.messages).toEqual([
        expect.objectContaining({ role: 'user', text: 'hola copiloto' }),
      ]),
    );
    expect(result.current.estado?.sendStatus).toBe('sending');
    unmount();
  });

  it('no manda cliente_id/alcance/modo -- ningún selector de cliente activo existe todavía en el shell', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(api.sendChat).mockResolvedValue({ wf_id: 'wf-1', accepted: true });

    const { result, unmount } = await renderHook(() => useChat());
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.send('hola copiloto');
    });

    expect(api.sendChat).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'hola copiloto', kind: 'text', payload: null }),
    );
    const llamada = jest.mocked(api.sendChat).mock.calls.at(-1)?.[0];
    expect(llamada).not.toHaveProperty('cliente_id');
    expect(llamada).not.toHaveProperty('alcance');
    expect(llamada).not.toHaveProperty('modo');
    unmount();
  });

  it('el confirm/cancel de un gate (kind:"callback") viaja con el payload tal cual', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(api.sendChat).mockResolvedValue({ wf_id: 'wf-1', accepted: true });

    const { result, unmount } = await renderHook(() => useChat());
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.send('confirm', { kind: 'callback', payload: { foo: 'bar' } });
    });

    expect(api.sendChat).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'callback', payload: { foo: 'bar' } }),
    );
    unmount();
  });

  it('no se puede enviar vacío o sólo espacios', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });

    const { result, unmount } = await renderHook(() => useChat());
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.send('   ');
    });

    expect(api.sendChat).not.toHaveBeenCalled();
    expect(result.current.estado?.messages).toEqual([]);
    unmount();
  });

  it('el polling no duplica un reply ya visto (cursor stale / carrera de red)', async () => {
    jest.mocked(api.getReply).mockResolvedValueOnce({
      replies: [{ id: 5, text: 'primera respuesta' }],
      next_id: 5,
    });
    jest.mocked(api.sendChat).mockResolvedValue({ wf_id: 'wf-x', accepted: true });

    const { result, unmount } = await renderHook(() => useChat());
    await waitFor(() => expect(result.current.estado?.messages).toHaveLength(1));

    // El envío dispara un 2do poll inmediato -- lo mockeamos para que devuelva EL MISMO reply id=5
    // (simula un after_id viejo o una carrera de polling): el reducer debe descartarlo por dedupe.
    jest.mocked(api.getReply).mockResolvedValueOnce({
      replies: [{ id: 5, text: 'primera respuesta' }],
      next_id: 5,
    });

    await act(async () => {
      await result.current.send('otro mensaje');
    });

    await waitFor(() => expect(api.getReply).toHaveBeenCalledTimes(2));
    // 1 mensaje de usuario + 1 de asistente -- el duplicado NO se agrega de nuevo.
    expect(result.current.estado?.messages).toHaveLength(2);
    unmount();
  });

  it('un fallo de red en el POST deja sendStatus en error, sin perder el mensaje optimista', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(api.sendChat).mockRejectedValueOnce(new Error('network down'));

    const { result, unmount } = await renderHook(() => useChat());
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.send('se va a perder la respuesta');
    });

    expect(result.current.estado?.sendStatus).toBe('error');
    expect(result.current.estado?.motivoFallo).toBe('red');
    expect(result.current.estado?.messages).toHaveLength(1);
    unmount();
  });

  it('un 401 al enviar queda como sesión vencida, no como fallo genérico', async () => {
    const { UnauthorizedError } = jest.requireActual('@copiloto/core');
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(api.sendChat).mockRejectedValueOnce(new UnauthorizedError('token vencido'));

    const { result, unmount } = await renderHook(() => useChat());
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.send('hola');
    });

    expect(result.current.estado?.sendStatus).toBe('error');
    expect(result.current.estado?.motivoFallo).toBe('sesion_vencida');
    unmount();
  });
});

/**
 * 🔴 La regresión más cara del origen DocuMed: tras 60s el cliente dejaba de preguntar **para
 * siempre**. Una respuesta que llegaba al segundo 61 quedaba en el servidor y la pantalla no se
 * enteraba jamás. El backend de este producto es igual de durable (Temporal) -- misma invariante.
 */
describe('useChat -- el polling NO abandona tras el timeout', () => {
  beforeEach(() => {
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.getReply).mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('🔴 sigue pidiendo /reply DESPUÉS de los 60s, y levanta la respuesta tardía', async () => {
    jest.mocked(api.sendChat).mockResolvedValue({ wf_id: 'w1', accepted: true });
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });

    const { result, unmount } = await renderHook(() => useChat());
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.send('hola');
    });

    // Cruzamos el timeout: la máquina marca 'timeout' pero el polling TIENE que seguir vivo.
    await act(async () => {
      jest.advanceTimersByTime(61_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.estado?.sendStatus).toBe('timeout');

    const llamadasAlVencer = jest.mocked(api.getReply).mock.calls.length;

    // La respuesta llega tarde -- exactamente el caso que antes se perdía.
    jest.mocked(api.getReply).mockResolvedValue({
      replies: [{ id: 1, text: 'respuesta tardía' }],
      next_id: 1,
    });

    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });

    expect(jest.mocked(api.getReply).mock.calls.length).toBeGreaterThan(llamadasAlVencer);
    await waitFor(() =>
      expect(result.current.estado?.messages.some((m) => m.text === 'respuesta tardía')).toBe(true),
    );

    unmount();
  });
});
