import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red — mismo arnés que `TarjetaClientePropuesto.test.tsx`. `transcribir` se
 * suma acá (BL-J7/K-10) para el bloque del mic, de abajo. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    listarClientes: vi.fn(),
    obtenerCliente: vi.fn(),
    crearCliente: vi.fn(),
    transcribir: vi.fn(),
  };
});

import { crearCliente, listarClientes, obtenerCliente, transcribir, type Cliente } from '@copiloto/core';

import { ClientesScreen } from './ClientesScreen';

const mockListar = vi.mocked(listarClientes);
const mockObtener = vi.mocked(obtenerCliente);
const mockCrear = vi.mocked(crearCliente);
const mockTranscribir = vi.mocked(transcribir);

// BL-J7/K-10: mismo polyfill/mock que `modules/voz/MicFuncion.test.tsx` — acá se ejercita MONTADO
// dentro de la pantalla, no aislado, para probar la costura real (mic → abre el alta → `nombre`
// prellenado), no sólo el componente.
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

/** Graba y suelta — mismo gesto Pointer Events que `MicFuncion.test.tsx` (pointerdown en el botón,
 * pointerup en `document`: el arrastre puede salir del propio botón). El reloj avanza ENTRE los dos
 * — `MicButton` descarta como tap-corto todo lo que suelta antes de `MIN_HOLD_MS` (350ms). */
async function dictar(clock: { advance: (ms: number) => void }) {
  await act(async () => {
    fireEvent.pointerDown(screen.getByTestId('mic-button'), { clientY: 300 });
  });
  clock.advance(400);
  await act(async () => {
    fireEvent.pointerUp(document);
  });
}

function cliente(over: Partial<Cliente> = {}): Cliente {
  return {
    id: 42,
    nombre: 'Panadería La Esquina',
    docTipo: null,
    docNro: null,
    condicionIva: null,
    domicilio: null,
    email: null,
    telefono: null,
    notas: null,
    origen: 'derivado',
    creadoEn: '2026-08-01T00:00:00Z',
    ...over,
  };
}

describe('ClientesScreen — D14 (clienteIdInicial)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListar.mockResolvedValue({ status: 'ok', clientes: [], total: 0, agregadosEsteMes: 0 });
  });

  it('sin clienteIdInicial: no llama a obtenerCliente ni abre ninguna ficha', async () => {
    render(<ClientesScreen />);

    await waitFor(() => expect(screen.getByTestId('clientes-vacio')).toBeInTheDocument());
    expect(mockObtener).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ficha-cliente')).not.toBeInTheDocument();
  });

  it('con clienteIdInicial: el id llega a la capa de datos (obtenerCliente) y abre la ficha correcta', async () => {
    mockObtener.mockResolvedValue({
      status: 'ok',
      ficha: { cliente: cliente({ id: 42, nombre: 'Panadería La Esquina' }), presupuestos: [], facturas: [] },
    });

    render(<ClientesScreen clienteIdInicial={42} />);

    // `FichaCliente` pide su propia ficha completa al montar (presupuestos/facturas) -- son DOS
    // llamadas legítimas a `obtenerCliente(42)`, no una regresión: `abrirDueno` (acá) resuelve el
    // `Cliente` para poder montar `<FichaCliente>`, que a su vez repite el fetch por su cuenta.
    await waitFor(() => expect(mockObtener).toHaveBeenCalledWith(42));
    expect(mockObtener.mock.calls.every(([id]) => id === 42)).toBe(true);
    expect(await screen.findByTestId('ficha-cliente')).toBeInTheDocument();
    expect(screen.getByTestId('ficha-cliente-nombre')).toHaveTextContent('Panadería La Esquina');
  });

  it('clienteIdInicial de OTRO cliente abre la ficha de ESE id, no una fija', async () => {
    mockObtener.mockResolvedValue({
      status: 'ok',
      ficha: { cliente: cliente({ id: 7, nombre: 'Kiosco Norte' }), presupuestos: [], facturas: [] },
    });

    render(<ClientesScreen clienteIdInicial={7} />);

    await waitFor(() => expect(mockObtener).toHaveBeenCalledWith(7));
    expect(screen.getByTestId('ficha-cliente-nombre')).toHaveTextContent('Kiosco Norte');
  });
});

describe('ClientesScreen — BL-J6 (chip de cartera independiente de la paginación)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('el chip sale del agregado del backend, no de contar la página (cartera paginada)', async () => {
    mockListar.mockResolvedValue({
      status: 'ok',
      clientes: [cliente({ origen: 'manual' })],
      total: 42,
      agregadosEsteMes: 5,
    });

    render(<ClientesScreen />);

    expect(await screen.findByTestId('clientes-resumen-chip')).toHaveTextContent('5 se agregaron solos este mes');
    expect(screen.getByTestId('clientes-resumen-cifra')).toHaveTextContent('42');
  });

  it('sin agregado del backend (null) no hay chip — nunca «0 se agregaron»', async () => {
    mockListar.mockResolvedValue({ status: 'ok', clientes: [cliente()], total: 1, agregadosEsteMes: null });

    render(<ClientesScreen />);

    expect(await screen.findByTestId('clientes-resumen-cifra')).toBeInTheDocument();
    expect(screen.queryByTestId('clientes-resumen-chip')).not.toBeInTheDocument();
  });
});

describe('ClientesScreen — BL-J7/K-10 (mic en la fila del rótulo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListar.mockResolvedValue({ status: 'ok', clientes: [cliente()], total: 1, agregadosEsteMes: 1 });
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

  it('dictado → abre el alta con `nombre` prellenado, y NO guarda nada solo (DoD FE2 §4)', async () => {
    const clock = mockClock();
    mockTranscribir.mockResolvedValue({ transcript: 'Panadería La Esquina' });

    render(<ClientesScreen />);
    await screen.findByTestId('clientes-nuevo');

    await dictar(clock);

    expect(await screen.findByTestId('cliente-nombre')).toHaveValue('Panadería La Esquina');
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('transcripción vacía NO abre el alta — se queda en el listado con el error del mic', async () => {
    const clock = mockClock();
    mockTranscribir.mockResolvedValue({ transcript: '   ' });

    render(<ClientesScreen />);
    await screen.findByTestId('clientes-nuevo');

    await dictar(clock);

    expect(await screen.findByTestId('clientes-mic-error')).toHaveTextContent('No se entendió el audio. Probá de nuevo.');
    expect(screen.queryByTestId('cliente-nombre')).not.toBeInTheDocument();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('«Nuevo cliente» sigue abriendo el alta EN BLANCO — el mic no le pisa el flujo manual', async () => {
    render(<ClientesScreen />);
    await screen.findByTestId('clientes-nuevo');

    fireEvent.click(screen.getByTestId('clientes-nuevo'));

    expect(await screen.findByTestId('cliente-nombre')).toHaveValue('');
    expect(mockTranscribir).not.toHaveBeenCalled();
  });
});
