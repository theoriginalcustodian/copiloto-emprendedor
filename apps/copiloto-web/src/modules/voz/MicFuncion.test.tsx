import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import { MicFuncion } from './MicFuncion';

// Mismo polyfill que `MicButton.test.tsx`: jsdom no implementa `PointerEvent`.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {}
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: MediaStream) {}
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

function mockClock() {
  let current = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => current);
  return { advance: (ms: number) => { current += ms; } };
}

const transcribirMock = vi.hoisted(() => vi.fn());
vi.mock('@copiloto/core', async (orig) => ({
  ...(await orig<typeof import('@copiloto/core')>()),
  transcribir: transcribirMock,
}));

describe('MicFuncion (web)', () => {
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    getUserMedia = vi.fn().mockResolvedValue(mockStream());
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    transcribirMock.mockReset();
  });

  it('montado FUERA del chat, en un contenedor cualquiera, el overlay se posiciona bien (control positivo del desacople)', async () => {
    render(
      <div style={{ padding: 40 }}>
        <MicFuncion onTranscripcion={vi.fn()} contexto="gasto" />
      </div>,
    );
    expect(screen.getByTestId('mic-funcion')).toBeInTheDocument();
    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    // El overlay vive DENTRO de `.mic-funcion` (el wrapper propio, no `.composer__row` del chat).
    expect(screen.getByTestId('mic-funcion').contains(screen.getByTestId('recording-overlay'))).toBe(true);
  });

  it('un dictado llama onTranscripcion UNA sola vez con el texto', async () => {
    const clock = mockClock();
    transcribirMock.mockResolvedValue({ transcript: 'compré cuarenta litros de nafta' });
    const onTranscripcion = vi.fn();
    render(<MicFuncion onTranscripcion={onTranscripcion} contexto="gasto" />);

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    clock.advance(400);
    await grabarYSoltarUp();

    expect(onTranscripcion).toHaveBeenCalledTimes(1);
    expect(onTranscripcion).toHaveBeenCalledWith('compré cuarenta litros de nafta');
    expect(transcribirMock).toHaveBeenCalledWith(
      expect.objectContaining({ mime: 'audio/webm;codecs=opus', nombre: 'voz.webm' }),
      'gasto',
    );

    async function grabarYSoltarUp() {
      await act(async () => {
        fireEvent.pointerUp(document);
      });
    }
  });

  it('tras un dictado exitoso muestra el chip «Por voz · Ns» con la duración (DoD FE1 #5)', async () => {
    const clock = mockClock();
    transcribirMock.mockResolvedValue({ transcript: 'compré cuarenta litros de nafta' });
    render(<MicFuncion onTranscripcion={vi.fn()} contexto="gasto" />);

    expect(screen.queryByTestId('mic-funcion-chip')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    clock.advance(3200); // ~3s de dictado
    await act(async () => {
      fireEvent.pointerUp(document);
    });

    expect(screen.getByTestId('mic-funcion-chip')).toHaveTextContent('Por voz · 3s');
  });

  it('un nuevo dictado limpia el chip anterior mientras transcribe', async () => {
    const clock = mockClock();
    transcribirMock.mockResolvedValue({ transcript: 'primero' });
    render(<MicFuncion onTranscripcion={vi.fn()} contexto="gasto" />);

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    clock.advance(1200);
    await act(async () => {
      fireEvent.pointerUp(document);
    });
    expect(screen.getByTestId('mic-funcion-chip')).toHaveTextContent('Por voz · 1s');

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    expect(screen.queryByTestId('mic-funcion-chip')).not.toBeInTheDocument();
  });

  it('transcripción vacía avisa por onError y NO llama onTranscripcion', async () => {
    const clock = mockClock();
    transcribirMock.mockResolvedValue({ transcript: '   ' });
    const onTranscripcion = vi.fn();
    const onError = vi.fn();
    render(<MicFuncion onTranscripcion={onTranscripcion} contexto="gasto" onError={onError} />);
    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    clock.advance(400);
    await act(async () => {
      fireEvent.pointerUp(document);
    });
    expect(onTranscripcion).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('No se entendió el audio. Probá de nuevo.');
  });

  it('un 422 del backend llega a onError en español, sin código crudo', async () => {
    const clock = mockClock();
    const { ApiError } = await import('@copiloto/core');
    transcribirMock.mockRejectedValue(new ApiError(422, 'unprocessable', 'audio_mudo'));
    const onError = vi.fn();
    render(<MicFuncion onTranscripcion={vi.fn()} contexto="gasto" onError={onError} />);
    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
    });
    clock.advance(400);
    await act(async () => {
      fireEvent.pointerUp(document);
    });
    expect(onError).toHaveBeenCalledWith('No se entendió el audio. Probá de nuevo.');
  });
});
