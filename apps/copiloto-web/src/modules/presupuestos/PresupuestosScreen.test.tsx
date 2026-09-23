import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red — mismo arnés que `ClientesScreen.test.tsx`/`GastosScreen.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    listarPresupuestos: vi.fn(),
    crearPresupuesto: vi.fn(),
    transcribir: vi.fn(),
  };
});

import { crearPresupuesto, listarPresupuestos, transcribir } from '@copiloto/core';

import { PresupuestosScreen } from './PresupuestosScreen';

const mockListar = vi.mocked(listarPresupuestos);
const mockCrear = vi.mocked(crearPresupuesto);
const mockTranscribir = vi.mocked(transcribir);

// BL-J7/K-10: mismo polyfill/mock que `modules/voz/MicFuncion.test.tsx`, ejercitado MONTADO dentro
// de la pantalla (costura real mic → alta con `concepto` prellenado), no aislado.
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

/** Graba y suelta — el reloj avanza ENTRE los dos: `MicButton` descarta como tap-corto lo que
 * suelta antes de `MIN_HOLD_MS` (350ms). */
async function dictar(clock: { advance: (ms: number) => void }) {
  await act(async () => {
    fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
  });
  clock.advance(400);
  await act(async () => {
    fireEvent.pointerUp(document);
  });
}

describe('PresupuestosScreen — BL-J7/K-10 (mic en la fila del rótulo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListar.mockResolvedValue({ status: 'ok', presupuestos: [] });
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream()) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('dictado → abre el alta con `concepto` prellenado, y NO guarda nada solo (DoD FE2 §4)', async () => {
    const clock = mockClock();
    mockTranscribir.mockResolvedValue({ transcript: 'reforma del local' });

    render(<PresupuestosScreen onFacturar={vi.fn()} />);
    await screen.findByTestId('presupuestos-nuevo');

    await dictar(clock);

    expect(await screen.findByTestId('presupuesto-concepto')).toHaveValue('reforma del local');
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('transcripción vacía NO abre el alta — se queda en el listado con el error del mic', async () => {
    const clock = mockClock();
    mockTranscribir.mockResolvedValue({ transcript: '   ' });

    render(<PresupuestosScreen onFacturar={vi.fn()} />);
    await screen.findByTestId('presupuestos-nuevo');

    await dictar(clock);

    expect(await screen.findByTestId('presupuestos-mic-error')).toHaveTextContent('No se entendió el audio. Probá de nuevo.');
    expect(screen.queryByTestId('presupuesto-concepto')).not.toBeInTheDocument();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('«Nuevo presupuesto» sigue abriendo el alta EN BLANCO, nunca una corrección — el mic no le pisa el flujo manual', async () => {
    render(<PresupuestosScreen onFacturar={vi.fn()} />);
    await screen.findByTestId('presupuestos-nuevo');

    fireEvent.click(screen.getByTestId('presupuestos-nuevo'));

    expect(await screen.findByTestId('presupuesto-concepto')).toHaveValue('');
    expect(screen.queryByTestId('presupuesto-aviso-correccion')).not.toBeInTheDocument();
    expect(mockTranscribir).not.toHaveBeenCalled();
  });
});
