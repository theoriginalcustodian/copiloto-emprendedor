import { act, fireEvent, render, screen } from '@testing-library/react';
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

  it('soltar SIN deslizar (unlocked) envía el blob grabado — contrato resuelto de EXTRACT §5 #8', async () => {
    const onSendAudio = vi.fn();
    render(<MicButton onSendAudio={onSendAudio} />);

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    await act(async () => {
      fireEvent.pointerUp(document);
    });

    expect(onSendAudio).toHaveBeenCalledTimes(1);
    expect(onSendAudio.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(screen.queryByTestId('recording-overlay')).not.toBeInTheDocument();
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
});
