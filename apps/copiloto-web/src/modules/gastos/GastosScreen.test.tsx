import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@copiloto/core';

/** Partial mock: sólo la red — mismo arnés que `ClientesScreen.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    listarGastos: vi.fn(),
    obtenerResumenGastos: vi.fn(),
    crearGasto: vi.fn(),
    leerFotoGasto: vi.fn(),
  };
});

import { crearGasto, leerFotoGasto, listarGastos, obtenerResumenGastos, tomarPendiente } from '@copiloto/core';

import { GastosScreen } from './GastosScreen';

const mockListar = vi.mocked(listarGastos);
const mockResumen = vi.mocked(obtenerResumenGastos);
const mockCrear = vi.mocked(crearGasto);
const mockLeerFoto = vi.mocked(leerFotoGasto);

describe('GastosScreen — SM-P7 (dock del pie: la acción corre en el chat, no en el alta)', () => {
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

  it('enviar texto desde el dock deja el pendiente y abre el chat — NO abre el alta ni guarda nada', async () => {
    const onAbrirChat = vi.fn();
    render(<GastosScreen onAbrirChat={onAbrirChat} />);
    await screen.findByTestId('gastos-nuevo');

    const campo = screen.getByPlaceholderText('Contale un gasto al copiloto…');
    fireEvent.change(campo, { target: { value: 'cuarenta litros de nafta' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(onAbrirChat).toHaveBeenCalledTimes(1);
    expect(tomarPendiente()).toBe('cuarenta litros de nafta');
    expect(mockCrear).not.toHaveBeenCalled();
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

  it('sin `onAbrirChat` no se monta el dock (no hay adónde llevar el texto)', async () => {
    render(<GastosScreen />);
    await screen.findByTestId('gastos-nuevo');

    expect(screen.queryByTestId('dock-funcion')).not.toBeInTheDocument();
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
