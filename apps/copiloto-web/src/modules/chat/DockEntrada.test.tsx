import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import { DockEntrada } from './DockEntrada';

const { transcribirMock } = vi.hoisted(() => ({ transcribirMock: vi.fn() }));
vi.mock('@copiloto/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@copiloto/core')>()),
  transcribir: transcribirMock,
}));

// jsdom no trae PointerEvent ni MediaRecorder: mismo mínimo que `MicButton.test.tsx`.
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
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

let ahora = 0;
const PLACEHOLDER = 'Escribí, o hablá…';

function montar(onEnviar = vi.fn()) {
  render(<DockEntrada testId="dock" placeholder={PLACEHOLDER} ocupado={false} onEnviar={onEnviar} />);
  return onEnviar;
}

async function mantener(ms: number, deslizarX = 0) {
  await act(async () => {
    fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientX: 300, clientY: 300 });
  });
  ahora += ms;
  if (deslizarX) {
    await act(async () => {
      fireEvent.pointerMove(document, { clientX: 300 - deslizarX, clientY: 300 });
    });
  }
  await act(async () => {
    fireEvent.pointerUp(document);
  });
}

describe('DockEntrada — el dictado PEGA en el campo, no envía (SM-P8 b)', () => {
  beforeEach(() => {
    ahora = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => ahora);
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
      configurable: true,
    });
    transcribirMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('dictar deja el transcript en el campo, editable, y NO manda nada', async () => {
    transcribirMock.mockResolvedValue({ transcript: 'cobré tres mil a Juan' });
    const onEnviar = montar();
    await mantener(500);

    await waitFor(() => expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('cobré tres mil a Juan'));
    expect(transcribirMock).toHaveBeenCalledTimes(1);
    expect(onEnviar).not.toHaveBeenCalled();
    // Editable y recién ahí se envía.
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'cobré dos mil a Juan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(onEnviar).toHaveBeenCalledWith('cobré dos mil a Juan');
  });

  it('un dictado sobre texto ya escrito lo agrega al final, no lo pisa', async () => {
    transcribirMock.mockResolvedValue({ transcript: 'y mandale la factura' });
    montar();
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Hola Juan' } });
    await mantener(500);
    await waitFor(() => expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('Hola Juan y mandale la factura'));
  });

  it('descarte 1: cancelar la grabación (deslizar) no llega al backend ni al hilo', async () => {
    const onEnviar = montar();
    await mantener(500, 81);

    expect(transcribirMock).not.toHaveBeenCalled();
    expect(onEnviar).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('');
  });

  it('descarte 2: ya transcripto, borrar el texto deja el envío deshabilitado y no sale nada', async () => {
    transcribirMock.mockResolvedValue({ transcript: 'texto que no quiero' });
    const onEnviar = montar();
    await mantener(500);
    await waitFor(() => expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('texto que no quiero'));

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it('transcript vacío o error: avisa en español, no toca el campo ni envía', async () => {
    transcribirMock.mockResolvedValueOnce({ transcript: '   ' });
    const onEnviar = montar();
    await mantener(500);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se entendió el audio. Probá de nuevo.');
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('');

    transcribirMock.mockRejectedValueOnce(new Error('red caída'));
    await mantener(500);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos transcribir el audio. Probá de nuevo.');
    expect(onEnviar).not.toHaveBeenCalled();
  });
});
