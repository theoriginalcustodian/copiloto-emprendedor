import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@copiloto/core';

/** Partial mock: sólo la red — mismo arnés que `ClientesScreen.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    dictarPorChat: vi.fn(),
    listarGastos: vi.fn(),
    obtenerResumenGastos: vi.fn(),
    crearGasto: vi.fn(),
    leerFotoGasto: vi.fn(),
  };
});

import { crearGasto, leerFotoGasto, listarGastos, obtenerResumenGastos, dictarPorChat, tomarPendiente } from '@copiloto/core';

import { GastosScreen } from './GastosScreen';

const mockListar = vi.mocked(listarGastos);
const mockResumen = vi.mocked(obtenerResumenGastos);
const mockCrear = vi.mocked(crearGasto);
const mockLeerFoto = vi.mocked(leerFotoGasto);

describe('GastosScreen — SM-P19 mitad A (dock del pie: el dictado prellena la función, sin chat)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tomarPendiente();
    mockListar.mockResolvedValue({ status: 'ok', gastos: [], total: 0 });
    mockResumen.mockResolvedValue({
      status: 'ok',
      resumen: { periodo: '2026-09', total: '0.00', porCategoria: [], mesAnterior: null },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('escribir en el dock prellena el alta EN la función (dictado) — sin chat, sin onAbrirChat, sin guardar nada', async () => {
    vi.mocked(dictarPorChat).mockResolvedValue({ status: 'ok', resultado: { destino: 'gasto', propuesta: { monto: '40000.00', categoria: 'transporte', proveedor: null, medioPago: null, descripcion: 'cuarenta litros de nafta', montoSugerido: null, fecha: '' } } } as never);
    render(<GastosScreen />);
    await screen.findByTestId('gastos-nuevo');

    const campo = screen.getByPlaceholderText('Contale un gasto al copiloto…');
    fireEvent.change(campo, { target: { value: 'cuarenta litros de nafta' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(await screen.findByTestId('gasto-descripcion')).toHaveValue('cuarenta litros de nafta');
    expect(dictarPorChat).toHaveBeenCalledWith(expect.objectContaining({ destino: 'gasto', texto: 'cuarenta litros de nafta' }), expect.anything());
    expect(tomarPendiente()).toBeFalsy();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('el dictado NO depende del chat: sin onAbrirChat (chat sin hidratar) el dock está montado y no aparece CHAT_NO_LISTO', async () => {
    render(<GastosScreen />);
    await screen.findByTestId('gastos-nuevo');

    expect(screen.getByTestId('dock-funcion')).toBeInTheDocument();
    expect(screen.queryByText(/chat todavía no está listo/i)).not.toBeInTheDocument();
  });

  it('dictado sin card (respuesta sin sentido): avisa en el dock y NO abre un alta vacía', async () => {
    vi.mocked(dictarPorChat).mockResolvedValue({ status: 'sin_propuesta', motivo: 'respuesta_sin_card' } as never);
    render(<GastosScreen />);
    await screen.findByTestId('gastos-nuevo');

    const campo = screen.getByPlaceholderText('Contale un gasto al copiloto…');
    fireEvent.change(campo, { target: { value: 'mmm' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(await screen.findByText(/No alcancé a armar/)).toBeInTheDocument();
    expect(screen.queryByTestId('gasto-descripcion')).not.toBeInTheDocument();
  });
  it('el campo del dock se puede escribir: no está deshabilitado y tocarlo NO redirige', async () => {
    const onAbrirChat = vi.fn();
    render(<GastosScreen onAbrirChat={onAbrirChat} />);
    await screen.findByTestId('gastos-nuevo');

    const campo = screen.getByPlaceholderText('Contale un gasto al copiloto…');
    expect(campo).not.toBeDisabled();
    fireEvent.focus(campo);
    fireEvent.click(campo);

    expect(onAbrirChat).not.toHaveBeenCalled();
  });

  it('«Nuevo gasto» sigue abriendo el alta EN BLANCO — el dock no le pisa el flujo manual', async () => {
    render(<GastosScreen onAbrirChat={vi.fn()} />);
    await screen.findByTestId('gastos-nuevo');

    fireEvent.click(screen.getByTestId('gastos-nuevo'));

    expect(await screen.findByTestId('gasto-descripcion')).toHaveValue('');
  });
});

/** BL-J7 3er ítem del DoD — `POST /gastos/leer-foto`: forma EXACTA del contrato §2 (snake_case). */
function dataFotoGasto(over: Record<string, unknown> = {}) {
  return {
    monto: '',
    monto_sugerido: '4590.00',
    fecha: '2026-09-22',
    categoria: 'mercaderia',
    proveedor: 'Kiosco Once',
    medio_pago: null,
    descripcion: null,
    origen: 'foto',
    ...over,
  };
}

async function elegirFoto(nombre = 'ticket.jpg', mime = 'image/jpeg') {
  const archivo = new File(['bytes'], nombre, { type: mime });
  const input = screen.getByTestId('foto-funcion-input');
  await act(async () => {
    fireEvent.change(input, { target: { files: [archivo] } });
  });
}

describe('GastosScreen — BL-J7 3er ítem del DoD (foto del ticket sin chat, contrato §2/§3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListar.mockResolvedValue({ status: 'ok', gastos: [], total: 0 });
    mockResumen.mockResolvedValue({
      status: 'ok',
      resumen: { periodo: '2026-09', total: '0.00', porCategoria: [], mesAnterior: null },
    });
  });

  it('200 → abre el alta con la propuesta del OCR: `monto` vacío, `montoSugerido` como sugerencia tocable, origen "foto"', async () => {
    mockLeerFoto.mockResolvedValue({ gasto: dataFotoGasto() });

    render(<GastosScreen />);
    await screen.findByTestId('gastos-nuevo');

    await elegirFoto();

    expect(await screen.findByTestId('gasto-monto')).toHaveValue('');
    expect(screen.getByTestId('gasto-monto-sugerido')).toHaveTextContent('4590.00');
    expect(screen.getByTestId('gasto-origen')).toHaveAttribute('data-origen', 'foto');
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('422 → mensaje del mic-error de foto Y el alta se abre igual, en blanco (nunca bloquea la carga manual)', async () => {
    mockLeerFoto.mockRejectedValue(new ApiError(422, 'no se reconoció un ticket en la imagen'));

    render(<GastosScreen />);
    await screen.findByTestId('gastos-nuevo');

    await elegirFoto();

    expect(await screen.findByTestId('gastos-foto-error')).toHaveTextContent(
      'No pude leer el ticket. Probá con otra foto o cargalo a mano.',
    );
    expect(await screen.findByTestId('gasto-monto')).toHaveValue('');
    expect(screen.getByTestId('gasto-origen')).toHaveAttribute('data-origen', 'manual');
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('413 → usa el `detail` que manda el backend, no un texto genérico', async () => {
    mockLeerFoto.mockRejectedValue(new ApiError(413, 'imagen demasiado grande (máx 10 MB)', 'imagen demasiado grande (máx 10 MB)'));

    render(<GastosScreen />);
    await screen.findByTestId('gastos-nuevo');

    await elegirFoto();

    expect(await screen.findByTestId('gastos-foto-error')).toHaveTextContent('imagen demasiado grande (máx 10 MB)');
  });

  it('«Nuevo gasto» manual NO llama a `leerFotoGasto`', async () => {
    render(<GastosScreen />);
    await screen.findByTestId('gastos-nuevo');

    fireEvent.click(screen.getByTestId('gastos-nuevo'));

    await screen.findByTestId('gasto-descripcion');
    expect(mockLeerFoto).not.toHaveBeenCalled();
  });
});
