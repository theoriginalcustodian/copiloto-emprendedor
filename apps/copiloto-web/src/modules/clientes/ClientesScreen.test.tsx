import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red — mismo arnés que `TarjetaClientePropuesto.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    listarClientes: vi.fn(),
    obtenerCliente: vi.fn(),
    crearCliente: vi.fn(),
  };
});

import { crearCliente, listarClientes, obtenerCliente, tomarPendiente, type Cliente } from '@copiloto/core';

import { ClientesScreen } from './ClientesScreen';

const mockListar = vi.mocked(listarClientes);
const mockObtener = vi.mocked(obtenerCliente);
const mockCrear = vi.mocked(crearCliente);

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

describe('ClientesScreen — SM-P7 (dock del pie: la acción corre en el chat, no en el alta)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tomarPendiente();
    mockListar.mockResolvedValue({ status: 'ok', clientes: [cliente()], total: 1, agregadosEsteMes: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enviar texto desde el dock deja el pendiente y abre el chat — NO abre el alta ni guarda nada', async () => {
    const onAbrirChat = vi.fn();
    render(<ClientesScreen onAbrirChat={onAbrirChat} />);
    await screen.findByTestId('clientes-nuevo');

    const campo = screen.getByPlaceholderText('Contale un cliente al copiloto…');
    fireEvent.change(campo, { target: { value: 'Panadería La Esquina' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(onAbrirChat).toHaveBeenCalledTimes(1);
    expect(tomarPendiente()).toBe('Panadería La Esquina');
    expect(mockCrear).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cliente-nombre')).not.toBeInTheDocument();
  });

  it('el campo del dock se puede escribir: no está deshabilitado y tocarlo NO redirige', async () => {
    const onAbrirChat = vi.fn();
    render(<ClientesScreen onAbrirChat={onAbrirChat} />);
    await screen.findByTestId('clientes-nuevo');

    const campo = screen.getByPlaceholderText('Contale un cliente al copiloto…');
    expect(campo).not.toBeDisabled();
    fireEvent.focus(campo);
    fireEvent.click(campo);

    expect(onAbrirChat).not.toHaveBeenCalled();
  });

  it('sin `onAbrirChat` no se monta el dock (no hay adónde llevar el texto)', async () => {
    render(<ClientesScreen />);
    await screen.findByTestId('clientes-nuevo');

    expect(screen.queryByTestId('dock-funcion')).not.toBeInTheDocument();
  });

  it('«Nuevo cliente» sigue abriendo el alta EN BLANCO — el dock no le pisa el flujo manual', async () => {
    render(<ClientesScreen onAbrirChat={vi.fn()} />);
    await screen.findByTestId('clientes-nuevo');

    fireEvent.click(screen.getByTestId('clientes-nuevo'));

    expect(await screen.findByTestId('cliente-nombre')).toHaveValue('');
  });
});