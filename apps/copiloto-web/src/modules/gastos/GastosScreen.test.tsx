import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red — mismo arnés que `ClientesScreen.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    listarGastos: vi.fn(),
    obtenerResumenGastos: vi.fn(),
    crearGasto: vi.fn(),
    transcribir: vi.fn(),
  };
});

import { crearGasto, listarGastos, obtenerResumenGastos, transcribir } from '@copiloto/core';

import { GastosScreen } from './GastosScreen';

const mockListar = vi.mocked(listarGastos);
const mockResumen = vi.mocked(obtenerResumenGastos);
const mockCrear = vi.mocked(crearGasto);
const mockTranscribir = vi.mocked(transcribir);

// BL-J7/K-10: mismo polyfill/mock que `modules/voz/MicFuncion.test.tsx`, ejercitado MONTADO dentro
// de la pantalla (costura real mic → alta con `descripcion` prellenada), no aislado.
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

describe('GastosScreen — BL-J7/K-10 (mic en la fila del rótulo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListar.mockResolvedValue({ status: 'ok', gastos: [], total: 0 });
    mockResumen.mockResolvedValue({
      status: 'ok',
      resumen: { periodo: '2026-09', total: '0.00', porCategoria: [], mesAnterior: null },
    });
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

  it('dictado → abre el alta con `descripcion` prellenada, y NO guarda nada solo (DoD FE2 §4)', async () => {
    const clock = mockClock();
    mockTranscribir.mockResolvedValue({ transcript: 'cuarenta litros de nafta' });

    render(<GastosScreen />);
    await screen.findByTestId('gastos-nuevo');

    await dictar(clock);

    expect(await screen.findByTestId('gasto-descripcion')).toHaveValue('cuarenta litros de nafta');
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('transcripción vacía NO abre el alta — se queda en el listado con el error del mic', async () => {
    const clock = mockClock();
    mockTranscribir.mockResolvedValue({ transcript: '   ' });

    render(<GastosScreen />);
    await screen.findByTestId('gastos-nuevo');

    await dictar(clock);

    expect(await screen.findByTestId('gastos-mic-error')).toHaveTextContent('No se entendió el audio. Probá de nuevo.');
    expect(screen.queryByTestId('gasto-descripcion')).not.toBeInTheDocument();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('«Nuevo gasto» sigue abriendo el alta EN BLANCO — el mic no le pisa el flujo manual', async () => {
    render(<GastosScreen />);
    await screen.findByTestId('gastos-nuevo');

    fireEvent.click(screen.getByTestId('gastos-nuevo'));

    expect(await screen.findByTestId('gasto-descripcion')).toHaveValue('');
    expect(mockTranscribir).not.toHaveBeenCalled();
  });
});
