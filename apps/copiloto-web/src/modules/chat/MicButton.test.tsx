import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import { MicButton } from './MicButton';

/**
 * jsdom (entorno de test) NO implementa `PointerEvent` nativamente (validado empíricamente:
 * `typeof window.PointerEvent === 'undefined'` en esta versión) — sin esto, `fireEvent.pointerDown
 * /Move/Up` de testing-library cae a `window.Event` genérico (ver
 * `@testing-library/dom/dist/events.js`: `window[EventType] || window.Event`), que ignora
 * `clientY`, y el gesto de `MicButton` (que lee `event.clientY` para calcular el umbral de "fijado")
 * queda ciego. Polyfill mínimo: `MouseEvent` ya soporta `clientX`/`clientY` — alcanza para el
 * gesto, no hace falta la superficie completa de `PointerEvent` (pressure/pointerType/etc, que
 * `MicButton` no usa).
 */
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {}
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

/**
 * jsdom no implementa `MediaRecorder`/`getUserMedia` (son APIs del browser real) — se mockean acá
 * con el mínimo contrato que `MicButton` consume: `start()`/`stop()`, `ondataavailable`, `onstop`,
 * `MediaRecorder.isTypeSupported` (usado por `pickSupportedMimeType`). `stop()` dispara
 * `ondataavailable` + `onstop` sincrónicamente (igual que el browser real hace asincrónicamente,
 * pero sin necesidad de fake timers para el test).
 */
class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(
    public stream: MediaStream,
    public options?: MediaRecorderOptions,
  ) {}

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

function mockStream(): MediaStream {
  return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
}

/**
 * `MicButton` usa `Date.now()` (no fake timers) para decidir hold-time (`MIN_HOLD_MS`, 350ms) en
 * `handlePointerUp`. Mockear `Date.now()` deja el cálculo determinístico sin esperar wall-clock
 * real: `advance(ms)` simula que pasó ese tiempo entre pointerdown y pointerup. Se restaura con
 * `vi.restoreAllMocks()` del `afterEach` global (no hace falta un `afterEach` propio).
 */
function mockClock() {
  let current = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => current);
  return { advance: (ms: number) => { current += ms; } };
}

describe('MicButton — gesto tipo WhatsApp (Task 19)', () => {
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    getUserMedia = vi.fn().mockResolvedValue(mockStream());
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('pointerdown pide permiso de mic y arranca el overlay de grabación', async () => {
    render(<MicButton onSendAudio={vi.fn()} />);

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(screen.getByTestId('recording-overlay')).toBeInTheDocument();
  });

  it('soltar SIN deslizar tras mantener ≥350ms (unlocked) envía el blob grabado — contrato resuelto de EXTRACT §5 #8', async () => {
    const onSendAudio = vi.fn();
    const clock = mockClock();
    render(<MicButton onSendAudio={onSendAudio} />);

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    clock.advance(400); // supera MIN_HOLD_MS (350ms) -> soltar cuenta como intención de grabar
    await act(async () => {
      fireEvent.pointerUp(document);
    });

    expect(onSendAudio).toHaveBeenCalledTimes(1);
    expect(onSendAudio.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(screen.queryByTestId('recording-overlay')).not.toBeInTheDocument();
  });

  it('tap corto (held < 350ms) NO envía y muestra el hint "Mantené presionado para grabar"', async () => {
    const onSendAudio = vi.fn();
    const clock = mockClock();
    render(<MicButton onSendAudio={onSendAudio} />);

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    clock.advance(50); // tap corto: muy por debajo de MIN_HOLD_MS (350ms)
    await act(async () => {
      fireEvent.pointerUp(document);
    });

    expect(onSendAudio).not.toHaveBeenCalled();
    expect(screen.queryByTestId('recording-overlay')).not.toBeInTheDocument();
    expect(await screen.findByText('Mantené presionado para grabar')).toBeInTheDocument();
  });

  it('release antes de que el recorder esté listo (race defecto 1): no deja overlay huérfano ni envía', async () => {
    const onSendAudio = vi.fn();
    const stopTrackSpy = vi.fn();
    let resolveGetUserMedia!: (stream: MediaStream) => void;
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveGetUserMedia = resolve;
        }),
    );
    render(<MicButton onSendAudio={onSendAudio} />);

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    // getUserMedia todavía no resolvió -> mediaRecorderRef sigue null en este punto.
    await act(async () => {
      fireEvent.pointerUp(document);
    });
    expect(screen.queryByTestId('recording-overlay')).not.toBeInTheDocument();

    // El permiso resuelve DESPUÉS de que el gesto ya terminó -> no debe arrancar nada.
    await act(async () => {
      resolveGetUserMedia({ getTracks: () => [{ stop: stopTrackSpy }] } as unknown as MediaStream);
    });

    expect(screen.queryByTestId('recording-overlay')).not.toBeInTheDocument();
    expect(onSendAudio).not.toHaveBeenCalled();
    expect(stopTrackSpy).toHaveBeenCalledTimes(1); // el stream tardío se libera, no queda colgado
  });

  it('deslizar >46px hacia arriba fija (locked): el pointerup solo ya NO envía', async () => {
    const onSendAudio = vi.fn();
    render(<MicButton onSendAudio={onSendAudio} />);

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    await act(async () => {
      fireEvent.pointerMove(document, { clientY: 300 - 50 }); // delta 50px > 46px
    });

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar audio' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.pointerUp(document);
    });

    expect(onSendAudio).not.toHaveBeenCalled();
    expect(screen.getByTestId('recording-overlay')).toBeInTheDocument(); // sigue grabando, fijado
  });

  it('fijado + botón "Enviar audio" del overlay envía el blob', async () => {
    const onSendAudio = vi.fn();
    render(<MicButton onSendAudio={onSendAudio} />);

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    await act(async () => {
      fireEvent.pointerMove(document, { clientY: 200 });
    });
    await act(async () => {
      fireEvent.pointerUp(document);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar audio' }));
    });

    expect(onSendAudio).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('recording-overlay')).not.toBeInTheDocument();
  });

  it('fijado + "Cancelar" descarta el audio — NUNCA llama onSendAudio', async () => {
    const onSendAudio = vi.fn();
    render(<MicButton onSendAudio={onSendAudio} />);

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    await act(async () => {
      fireEvent.pointerMove(document, { clientY: 200 });
    });
    await act(async () => {
      fireEvent.pointerUp(document);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    });

    expect(onSendAudio).not.toHaveBeenCalled();
    expect(screen.queryByTestId('recording-overlay')).not.toBeInTheDocument();
  });

  it('permiso denegado: muestra aviso es-AR, no crashea, no llama onSendAudio', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
    const onSendAudio = vi.fn();
    render(<MicButton onSendAudio={onSendAudio} />);

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos acceder al micrófono. Revisá los permisos del navegador.',
    );
    expect(screen.queryByTestId('recording-overlay')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.pointerUp(document);
    });
    expect(onSendAudio).not.toHaveBeenCalled();
  });

  it('disabled=true: pointerdown no pide permiso ni arranca overlay', async () => {
    render(<MicButton onSendAudio={vi.fn()} disabled />);
    expect(screen.getByTestId('mic-button')).toBeDisabled();

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.queryByTestId('recording-overlay')).not.toBeInTheDocument();
  });

  /**
   * Finding de review adversarial: `MicButton` no tenía NINGÚN cleanup de desmontaje. Fijar la
   * grabación (hands-free) y después navegar a otro tab (o cruzar el breakpoint 900px) desmonta
   * `ChatScreen`→`Composer`→`MicButton` sin liberar el track del mic (problema de privacidad — el
   * indicador de grabación del browser queda prendido) ni el timer (`setInterval` vivo). `Host`
   * monta/desmonta `MicButton` de verdad (no basta con desmontar `render()` — necesitamos togglear
   * el árbol para ejercitar el cleanup del `useEffect`, no el de `afterEach`/`cleanup()` de RTL).
   */
  describe('cleanup de desmontaje (finding de review adversarial)', () => {
    function Host() {
      const [mounted, setMounted] = useState(true);
      return (
        <>
          {mounted && <MicButton onSendAudio={vi.fn()} />}
          <button type="button" onClick={() => setMounted(false)}>
            desmontar
          </button>
        </>
      );
    }

    it('desmontar mientras está fijado (hands-free): libera el track del mic, para el MediaRecorder, limpia el timer y quita los listeners de document', async () => {
      const stopTrackSpy = vi.fn();
      getUserMedia.mockResolvedValueOnce({ getTracks: () => [{ stop: stopTrackSpy }] } as unknown as MediaStream);
      const recorderStopSpy = vi.spyOn(MockMediaRecorder.prototype, 'stop');
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      render(<Host />);

      await act(async () => {
        fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
      });
      await act(async () => {
        fireEvent.pointerMove(document, { clientY: 200 }); // fija (hands-free) — sin pointerup
      });
      expect(screen.getByTestId('recording-overlay')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('desmontar'));
      });

      expect(stopTrackSpy).toHaveBeenCalledTimes(1); // el mic se libera -> apaga el indicador del browser
      expect(recorderStopSpy).toHaveBeenCalledTimes(1); // el MediaRecorder se detiene
      expect(clearIntervalSpy).toHaveBeenCalled(); // el timer (100ms) del overlay se limpia
      // los listeners globales del gesto (pointermove/pointerup) no quedan colgados apuntando a
      // closures de un componente ya desmontado.
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerup', expect.any(Function));
    });

    it('desmontar grabando SIN fijar (antes del pointerup): igual libera el mic y para el MediaRecorder', async () => {
      const stopTrackSpy = vi.fn();
      getUserMedia.mockResolvedValueOnce({ getTracks: () => [{ stop: stopTrackSpy }] } as unknown as MediaStream);
      const recorderStopSpy = vi.spyOn(MockMediaRecorder.prototype, 'stop');

      render(<Host />);

      await act(async () => {
        fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
      });
      expect(screen.getByTestId('recording-overlay')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('desmontar'));
      });

      expect(stopTrackSpy).toHaveBeenCalledTimes(1);
      expect(recorderStopSpy).toHaveBeenCalledTimes(1);
    });

    it('desmontar sin haber empezado a grabar: no crashea ni llama stop de nada', async () => {
      render(<Host />);

      await expect(
        act(async () => {
          fireEvent.click(screen.getByText('desmontar'));
        }),
      ).resolves.not.toThrow();
    });
  });
});
