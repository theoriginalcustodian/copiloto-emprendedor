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
      sendAudio: jest.fn(),
      sendFoto: jest.fn(),
      getReply: jest.fn(),
    },
  };
});

/** `deleteAsync` -- el borrado de `enviarAudio` es best-effort, así que los tests lo espían para
 *  verificar que se INTENTA, no para que el resultado del envío dependa de él. */
jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

import { apiReal as api } from '@copiloto/core';
import { deleteAsync } from 'expo-file-system/legacy';

import { almacenClave } from '../../adapters/almacen';
import { useChat } from './useChat';

describe('useChat (hook de efectos, fork mobile de DocuMed sin voz/cliente activo)', () => {
  beforeEach(() => {
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.sendAudio).mockReset();
    jest.mocked(api.getReply).mockReset();
    jest.mocked(deleteAsync).mockClear();
  });

  it('hidrata y termina con un EstadoChat de historial vacío tras el 1er poll', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });

    // `renderHook`/`render` de esta versión de @testing-library/react-native son `async`.
    const { result, unmount } = await renderHook(() => useChat('cli-test'));

    await waitFor(() => expect(result.current.estado).not.toBeNull());
    expect(result.current.estado?.messages).toEqual([]);
    unmount();
  });

  it('send agrega el mensaje del usuario de forma OPTIMISTA (antes de que la red responda)', async () => {
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    // La red nunca resuelve durante este test -- si el mensaje sólo apareciera DESPUÉS del POST, esta
    // promesa colgada lo dejaría afuera para siempre.
    jest.mocked(api.sendChat).mockReturnValue(new Promise(() => {}));

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
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

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
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

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
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

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
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

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
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

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
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

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
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
 * 🔴 Regresión adversarial (hallazgo en device, 2026-07-23): un segundo login en el MISMO device
 * (otro tenant) hidrataba el historial del tenant ANTERIOR — `CLAVE_SESSION` era una clave global sin
 * scope. Este bloque usa un `AlmacenClave` con estado REAL (no mocks estáticos) para probar el caso
 * hostil: tenant A escribe, tenant B lee -- tiene que ver vacío, no la carta ajena.
 */
describe('useChat -- aislamiento por clienteId (no cross-tenant leak)', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    jest.mocked(almacenClave.leer).mockImplementation(async (clave) => store.get(clave) ?? null);
    jest.mocked(almacenClave.guardar).mockImplementation(async (clave, valor) => {
      store.set(clave, valor);
    });
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.getReply).mockReset();
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(api.sendChat).mockResolvedValue({ wf_id: 'wf-leak-test', accepted: true });
  });

  afterEach(() => {
    // Restaurar el mock estático global para no filtrar estado a otros describe de este archivo.
    jest.mocked(almacenClave.leer).mockResolvedValue(null);
    jest.mocked(almacenClave.guardar).mockResolvedValue(undefined);
  });

  it('🔴 CONTROL — el MISMO clienteId sí recupera su propio historial (la persistencia funciona)', async () => {
    const primero = await renderHook(() => useChat('tenant-a'));
    await waitFor(() => expect(primero.result.current.estado).not.toBeNull());
    await act(async () => {
      await primero.result.current.send('nota de tenant A');
    });
    await waitFor(() => expect(primero.result.current.estado?.messages).toHaveLength(1));
    await primero.unmount();

    const segundo = await renderHook(() => useChat('tenant-a'));
    await waitFor(() => expect(segundo.result.current.estado?.messages).toHaveLength(1));
    expect(segundo.result.current.estado?.messages[0]).toEqual(
      expect.objectContaining({ text: 'nota de tenant A' }),
    );
    await segundo.unmount();
  });

  it('🔴 tenant B NO ve lo que tenant A escribió en el mismo device', async () => {
    const deA = await renderHook(() => useChat('tenant-a'));
    await waitFor(() => expect(deA.result.current.estado).not.toBeNull());
    await act(async () => {
      await deA.result.current.send('dato sensible de tenant A');
    });
    await waitFor(() => expect(deA.result.current.estado?.messages).toHaveLength(1));
    const sessionIdDeA = deA.result.current.estado?.sessionId;
    await deA.unmount();

    const deB = await renderHook(() => useChat('tenant-b'));
    await waitFor(() => expect(deB.result.current.estado).not.toBeNull());

    expect(deB.result.current.estado?.messages).toEqual([]);
    expect(deB.result.current.estado?.sessionId).not.toBe(sessionIdDeA);
    await deB.unmount();
  });

  it('🔴 `clienteId` vacío (sesión sin resolver) nunca persiste en una clave compartida', async () => {
    const { result, unmount } = await renderHook(() => useChat(''));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.send('no debería guardarse en ningún lado');
    });
    await waitFor(() => expect(result.current.estado?.messages).toHaveLength(1));

    // Nada se escribió en el almacén -- ni bajo una clave de sesión ni de mensajes.
    expect(store.size).toBe(0);
    await unmount();
  });
});

const ARCHIVO_VOZ = { nombre: 'voz.m4a', mime: 'audio/mp4', datos: 'file:///cache/voz.m4a' };
const ARCHIVO_FOTO = { nombre: 'ticket.jpg', mime: 'image/jpeg', datos: 'file:///cache/ticket.jpg' };

describe('useChat -- enviarAudio (F6, voz-comando corta)', () => {
  beforeEach(() => {
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.sendAudio).mockReset();
    jest.mocked(api.getReply).mockReset();
    jest.mocked(deleteAsync).mockClear();
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
  });

  it('transcript OK: agrega el mensaje del usuario (no optimista, recién con el texto real) y arranca el polling', async () => {
    jest.mocked(api.sendAudio).mockResolvedValue({ wf_id: 'wf-a1', accepted: true, transcript: 'anotá esto' });

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarAudio(ARCHIVO_VOZ);
    });

    expect(result.current.estado?.messages).toEqual([
      expect.objectContaining({ role: 'user', text: 'anotá esto' }),
    ]);
    expect(result.current.estado?.sendStatus).toBe('waiting');
    // `cliente_id` viaja SIEMPRE, vacío -- ver el docstring del módulo.
    expect(api.sendAudio).toHaveBeenCalledWith(expect.any(String), ARCHIVO_VOZ, '');
    unmount();
  });

  it('CERO retención: borra el archivo local tras un envío exitoso', async () => {
    jest.mocked(api.sendAudio).mockResolvedValue({ wf_id: 'wf-a2', accepted: true, transcript: 'listo' });

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarAudio(ARCHIVO_VOZ);
    });

    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/voz.m4a', { idempotent: true });
    unmount();
  });

  it('CERO retención: borra el archivo local incluso si el upload falla -- el borrado no depende del éxito', async () => {
    jest.mocked(api.sendAudio).mockRejectedValue(new Error('network down'));

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
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
    jest.mocked(api.sendAudio).mockResolvedValue({ wf_id: 'wf-a3', accepted: true, transcript: '   ' });

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarAudio(ARCHIVO_VOZ);
    });

    expect(result.current.estado?.sendStatus).toBe('error');
    expect(result.current.estado?.motivoFallo).toBe('audio_no_entendido');
    expect(result.current.estado?.messages).toEqual([]);
    unmount();
  });

  it('un 413 del servidor mapea a audio_muy_grande, no a un error genérico', async () => {
    const { ApiError } = jest.requireActual('@copiloto/core');
    jest.mocked(api.sendAudio).mockRejectedValue(new ApiError(413, 'payload too large'));

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarAudio(ARCHIVO_VOZ);
    });

    expect(result.current.estado?.motivoFallo).toBe('audio_muy_grande');
    unmount();
  });
});

describe('useChat -- enviarFoto (Gastos Fase 2, OCR de ticket)', () => {
  beforeEach(() => {
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.sendFoto).mockReset();
    jest.mocked(api.getReply).mockReset();
    jest.mocked(deleteAsync).mockClear();
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
  });

  it('upload OK: agrega el mensaje optimista fijo (nunca hay transcript de una foto) y arranca el polling', async () => {
    jest.mocked(api.sendFoto).mockResolvedValue({ wf_id: 'wf-f1', accepted: true });

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarFoto(ARCHIVO_FOTO);
    });

    expect(result.current.estado?.messages).toEqual([
      expect.objectContaining({ role: 'user', text: '📷 Foto del ticket enviada' }),
    ]);
    expect(result.current.estado?.sendStatus).toBe('waiting');
    // `cliente_id` viaja SIEMPRE, vacío -- mismo criterio que `enviarAudio`, ver el docstring del módulo.
    expect(api.sendFoto).toHaveBeenCalledWith(expect.any(String), ARCHIVO_FOTO, '');
    unmount();
  });

  it('CERO retención: borra el archivo local tras un envío exitoso', async () => {
    jest.mocked(api.sendFoto).mockResolvedValue({ wf_id: 'wf-f2', accepted: true });

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarFoto(ARCHIVO_FOTO);
    });

    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/ticket.jpg', { idempotent: true });
    unmount();
  });

  it('CERO retención: borra el archivo local incluso si el upload falla -- el borrado no depende del éxito', async () => {
    jest.mocked(api.sendFoto).mockRejectedValue(new Error('network down'));

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarFoto(ARCHIVO_FOTO);
    });

    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/ticket.jpg', { idempotent: true });
    expect(result.current.estado?.sendStatus).toBe('error');
    expect(result.current.estado?.motivoFallo).toBe('red');
    unmount();
  });

  it('🔴 un 422 mapea a foto_no_legible, NO a audio_no_entendido -- el origen importa', async () => {
    const { ApiError } = jest.requireActual('@copiloto/core');
    jest.mocked(api.sendFoto).mockRejectedValue(new ApiError(422, 'sin ticket reconocible'));

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarFoto(ARCHIVO_FOTO);
    });

    expect(result.current.estado?.motivoFallo).toBe('foto_no_legible');
    expect(result.current.estado?.messages).toEqual([]);
    unmount();
  });

  it('🔴 un 413 mapea a foto_muy_grande, NO a audio_muy_grande -- el origen importa', async () => {
    const { ApiError } = jest.requireActual('@copiloto/core');
    jest.mocked(api.sendFoto).mockRejectedValue(new ApiError(413, 'imagen muy pesada'));

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
    await waitFor(() => expect(result.current.estado).not.toBeNull());

    await act(async () => {
      await result.current.enviarFoto(ARCHIVO_FOTO);
    });

    expect(result.current.estado?.motivoFallo).toBe('foto_muy_grande');
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

    const { result, unmount } = await renderHook(() => useChat('cli-test'));
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
