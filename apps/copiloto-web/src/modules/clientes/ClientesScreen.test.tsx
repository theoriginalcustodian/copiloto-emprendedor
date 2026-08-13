import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red — mismo arnés que `TarjetaClientePropuesto.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    listarClientes: vi.fn(),
    obtenerCliente: vi.fn(),
  };
});

import { listarClientes, obtenerCliente, type Cliente } from '@copiloto/core';

import { ClientesScreen } from './ClientesScreen';

const mockListar = vi.mocked(listarClientes);
const mockObtener = vi.mocked(obtenerCliente);

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
    mockListar.mockResolvedValue({ status: 'ok', clientes: [], total: 0 });
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
