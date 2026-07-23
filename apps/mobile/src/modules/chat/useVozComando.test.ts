// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import { act, renderHook, waitFor } from '@testing-library/react-native';

/**
 * Mock LOCAL de `expo-audio` que pisa el global de `jest.setup.js` (documentado ahí mismo: "los
 * tests que necesitan controlar el grabador declaran su propio jest.mock"). El global no alcanza
 * acá porque le falta `getStatus`/`pause`, que `useVozComando` sí llama.
 *
 * 🔴 Los nombres tienen que EMPEZAR con `mock` -- `babel-plugin-jest-hoist` sólo deja referenciar,
 * desde dentro del factory de `jest.mock` (que se hoistea por encima de TODOS los imports, incluido
 * el de `./useVozComando` de abajo), variables externas cuyo nombre matchea `/^mock/i`. Cualquier
 * otro nombre revienta en runtime con "The module factory ... is not allowed to reference any
 * out-of-scope variables".
 */
const mockGrabador = {
  prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
  record: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn(() => ({ durationMillis: 0, metering: -60 })),
  uri: null as string | null,
};

const mockRequestRecordingPermissionsAsync = jest.fn();

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => mockGrabador,
  requestRecordingPermissionsAsync: (...args: unknown[]) => mockRequestRecordingPermissionsAsync(...args),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

import { capturaViva, useVozComando, type FaseVoz } from './useVozComando';

/**
 * `capturaViva` es la ÚNICA decisión de esta máquina que no toca nada nativo -- se prueba aparte
 * porque mockear el grabador para probarla probaría el mock, no la decisión (misma lección que
 * documed dejó en su propio `useVozComando.test.ts`). Equivocarla en un sentido dejaría salir de
 * una pantalla con el micrófono abierto sin aviso.
 */
describe('capturaViva -- ¿hay micrófono abierto ahora mismo?', () => {
  it('grabando es la ÚNICA fase viva', () => {
    expect(capturaViva('grabando')).toBe(true);
  });

  it('pausado NO es viva: el micrófono está cerrado y el audio guardado', () => {
    expect(capturaViva('pausado')).toBe(false);
  });

  it('listo NO es viva: ya se cortó, sólo falta decidir qué hacer con el audio', () => {
    expect(capturaViva('listo')).toBe(false);
  });

  it('inactivo NO es viva', () => {
    expect(capturaViva('inactivo')).toBe(false);
  });

  it('cubre TODAS las fases del tipo -- una fase nueva sin clasificar rompe acá', () => {
    const todas: Record<FaseVoz, boolean> = {
      inactivo: false,
      grabando: true,
      pausado: false,
      listo: false,
    };
    for (const [fase, esperado] of Object.entries(todas)) {
      expect(capturaViva(fase as FaseVoz)).toBe(esperado);
    }
  });
});

describe('useVozComando -- máquina de fases sobre el grabador nativo (mock local)', () => {
  beforeEach(() => {
    mockRequestRecordingPermissionsAsync.mockReset();
    mockGrabador.prepareToRecordAsync.mockClear();
    mockGrabador.record.mockClear();
    mockGrabador.pause.mockClear();
    mockGrabador.stop.mockClear();
    mockGrabador.uri = null;
  });

  it('permiso denegado: iniciar() devuelve false y la fase queda en inactivo -- sin crash', async () => {
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: false });

    const { result, unmount } = await renderHook(() => useVozComando());
    expect(result.current.fase).toBe('inactivo');

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.iniciar();
    });

    expect(ok).toBe(false);
    expect(result.current.fase).toBe('inactivo');
    // El permiso denegado corta ANTES de tocar el grabador -- ni prepara ni arranca nada.
    expect(mockGrabador.prepareToRecordAsync).not.toHaveBeenCalled();
    expect(mockGrabador.record).not.toHaveBeenCalled();
    unmount();
  });

  it('permiso concedido: iniciar() arranca el grabador y pasa a grabando', async () => {
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: true });

    const { result, unmount } = await renderHook(() => useVozComando());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.iniciar();
    });

    expect(ok).toBe(true);
    expect(result.current.fase).toBe('grabando');
    expect(mockGrabador.prepareToRecordAsync).toHaveBeenCalledTimes(1);
    expect(mockGrabador.record).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('detener() sin archivo (uri null) vuelve a inactivo -- nunca ofrece un Enviar vacío', async () => {
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    mockGrabador.uri = null;

    const { result, unmount } = await renderHook(() => useVozComando());
    await act(async () => {
      await result.current.iniciar();
    });

    await act(async () => {
      await result.current.detener();
    });

    expect(result.current.fase).toBe('inactivo');
    expect(result.current.tomar()).toBeNull();
    unmount();
  });

  it('detener() con archivo pasa a listo y tomar() entrega el ArchivoSubida', async () => {
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    mockGrabador.uri = 'file:///cache/voz.m4a';

    const { result, unmount } = await renderHook(() => useVozComando());
    await act(async () => {
      await result.current.iniciar();
    });
    await act(async () => {
      await result.current.detener();
    });

    await waitFor(() => expect(result.current.fase).toBe('listo'));

    let archivo: ReturnType<typeof result.current.tomar> = null;
    await act(async () => {
      archivo = result.current.tomar();
    });
    expect(archivo).toEqual({ nombre: 'voz.m4a', mime: 'audio/mp4', datos: 'file:///cache/voz.m4a' });
    // `tomar()` consume el archivo: vuelve a inactivo y una segunda llamada no entrega nada.
    expect(result.current.fase).toBe('inactivo');
    unmount();
  });

  it('🔴 la SEGUNDA grabación consecutiva no revienta con "already been prepared" (bug de device, 2/2)', async () => {
    // Repro exacta que backend midió en el SM-A217M: el re-prepare en background de `detener()`
    // puede caer en la ventana donde el `reset()` nativo (Android, `AudioRecorder.kt`) todavía no
    // terminó de correr tras el `stop()` -- `prepareToRecordAsync` tira
    // `AudioRecorderAlreadyPreparedException` una vez. El reintento corto de `precalentar()` la
    // absorbe: acá se simula rechazando la SEGUNDA llamada a `prepareToRecordAsync` (la del
    // re-prepare tras la primera grabación), que es justo donde backend lo vio explotar.
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    mockGrabador.uri = 'file:///cache/voz.m4a';
    let llamada = 0;
    mockGrabador.prepareToRecordAsync.mockImplementation(() => {
      llamada += 1;
      if (llamada === 2) {
        const err = new Error(
          "Call to function 'AudioRecorder.prepareToRecordAsync' has been rejected.",
        );
        (err as any).cause = new Error(
          'AudioRecorder has already been prepared. Stop or release the current session before preparing again.',
        );
        return Promise.reject(err);
      }
      return Promise.resolve(undefined);
    });

    const { result, unmount } = await renderHook(() => useVozComando());

    // Primera grabación: mount ya pre-calentó (llamada 1) -> iniciar() no vuelve a preparar.
    await act(async () => {
      await result.current.iniciar();
    });
    await act(async () => {
      await result.current.detener();
    });
    // El re-prepare de `detener()` (llamada 2) rechaza una vez con "already prepared" y se reintenta
    // internamente -- correr un microtask/timer extra para que el `setTimeout(150)` del reintento
    // se resuelva antes de la próxima aserción.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    // Segunda grabación: si el reintento no hubiera absorbido el rechazo, `preparadoRef` seguiría
    // en `false` y esto forzaría un tercer `prepareToRecordAsync` (llamada 3, que sí resuelve) --
    // de cualquier manera `iniciar()` tiene que devolver `true` sin ninguna excepción sin capturar.
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.iniciar();
    });

    expect(ok).toBe(true);
    expect(result.current.fase).toBe('grabando');
    unmount();
  });

  it('descartar() corta el grabador vivo y no deja archivo para tomar', async () => {
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    mockGrabador.uri = 'file:///cache/voz.m4a';

    const { result, unmount } = await renderHook(() => useVozComando());
    await act(async () => {
      await result.current.iniciar();
    });

    await act(async () => {
      await result.current.descartar();
    });

    expect(mockGrabador.stop).toHaveBeenCalledTimes(1);
    expect(result.current.fase).toBe('inactivo');
    expect(result.current.tomar()).toBeNull();
    unmount();
  });
});
