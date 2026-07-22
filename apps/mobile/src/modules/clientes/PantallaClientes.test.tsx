import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/** Partial mock: sólo la red. `formatearImporte` y las clases de error, REALES. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, listarClientes: jest.fn(), obtenerCliente: jest.fn() };
});

import { listarClientes, obtenerCliente, type Cliente, type FichaCliente } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaClientes } from './PantallaClientes';

const mockListar = listarClientes as jest.MockedFunction<typeof listarClientes>;
const mockFicha = obtenerCliente as jest.MockedFunction<typeof obtenerCliente>;

function cliente(over: Partial<Cliente> = {}): Cliente {
  return {
    id: 12,
    nombre: 'Panadería Los Tilos',
    docTipo: 80,
    docNro: '30712345678',
    condicionIva: 1,
    domicilio: null,
    contacto: null,
    notas: null,
    origen: 'derivado',
    creadoEn: '2026-07-22T10:00:00+00:00',
    ...over,
  };
}

function ficha(over: Partial<FichaCliente> = {}): FichaCliente {
  return { cliente: cliente(), presupuestos: [], facturas: [], ...over };
}

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaClientes />
    </ThemeProvider>,
  );
}

describe('PantallaClientes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListar.mockResolvedValue({ status: 'ok', clientes: [cliente()], total: 1 });
    mockFicha.mockResolvedValue({ status: 'ok', ficha: ficha() });
  });

  it('pinta la cartera', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('cliente-12-nombre')).toBeTruthy());
    expect(screen.getByTestId('cliente-12-nombre')).toHaveTextContent('Panadería Los Tilos');
    expect(screen.getByTestId('cliente-12-sub')).toHaveTextContent('CUIT 30712345678');
  });

  it('un cliente sin documento NO muestra ninguna etiqueta de que le falta', async () => {
    // Es el caso NORMAL de esta cartera (se deriva de presupuestos, donde el documento es opcional).
    // Un "sin CUIT" marcaría como incompleta a media cartera.
    mockListar.mockResolvedValue({
      status: 'ok',
      clientes: [cliente({ docNro: null, docTipo: null, contacto: null })],
      total: 1,
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('cliente-12-nombre')).toBeTruthy());
    expect(screen.queryByTestId('cliente-12-sub')).toBeNull();
  });

  it('no marca los derivados y sí los cargados a mano', async () => {
    mockListar.mockResolvedValue({ status: 'ok', clientes: [cliente({ origen: 'voz' })], total: 1 });

    await montar();

    await waitFor(() => expect(screen.getByTestId('cliente-12-origen')).toBeTruthy());
  });

  it('la cartera vacía explica que se arma sola, sin parecer un error', async () => {
    mockListar.mockResolvedValue({ status: 'ok', clientes: [], total: 0 });

    await montar();

    await waitFor(() => expect(screen.getByTestId('clientes-vacio')).toBeTruthy());
    expect(screen.getByTestId('clientes-vacio')).toHaveTextContent(
      'Tu cartera se va a armar sola con lo que factures y presupuestes.',
    );
  });

  it('el endpoint no desplegado avisa, no explota', async () => {
    mockListar.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('clientes-no-disponible')).toBeTruthy());
  });

  describe('búsqueda', () => {
    it('🔴 la resuelve el BACKEND — manda `q`, no filtra la página local', async () => {
      // Con paginación, un filter local sólo miraría la página cargada: buscar "panaderia"
      // devolvería vacío mientras el cliente existe en la página 2.
      jest.useFakeTimers();
      await montar();
      await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(1));

      await act(async () => {
        fireEvent.changeText(screen.getByTestId('clientes-buscar-input'), 'panaderia');
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      await waitFor(() => expect(mockListar).toHaveBeenLastCalledWith({ q: 'panaderia' }));
      jest.useRealTimers();
    });

    it('espera a que se deje de tipear — no una petición por tecla', async () => {
      // Sin el debounce, "pan" son tres peticiones y las respuestas pueden llegar desordenadas:
      // la de "p" llegando después de la de "pan" pisaría el resultado bueno con uno viejo.
      jest.useFakeTimers();
      await montar();
      await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(1));

      await act(async () => {
        fireEvent.changeText(screen.getByTestId('clientes-buscar-input'), 'p');
        fireEvent.changeText(screen.getByTestId('clientes-buscar-input'), 'pa');
        fireEvent.changeText(screen.getByTestId('clientes-buscar-input'), 'pan');
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      // 1 la inicial + 1 la búsqueda. No 4.
      await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(2));
      jest.useRealTimers();
    });
  });

  describe('ficha', () => {
    it('se pide SIEMPRE al abrir, aunque el listado ya tenga el cliente', async () => {
      // El listado no trae el historial: reusar su objeto dejaría una ficha sin operaciones que se
      // ve idéntica a una con cero.
      await montar();
      await waitFor(() => expect(screen.getByTestId('cliente-12')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByTestId('cliente-12'));
      });

      await waitFor(() => expect(mockFicha).toHaveBeenCalledWith(12));
    });

    it('las secciones vacías se DICEN, no se esconden', async () => {
      // Ocultarlas haría que la ficha se vea completa y que el emprendedor concluya que nunca le
      // compró nada. Llegan vacías hasta el hito 3 del backend.
      await montar();
      await waitFor(() => expect(screen.getByTestId('cliente-12')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByTestId('cliente-12'));
      });

      await waitFor(() => expect(screen.getByTestId('ficha-presupuestos-vacio')).toBeTruthy());
      expect(screen.getByTestId('ficha-facturas-vacio')).toBeTruthy();
    });

    it('un 404 dice "no encontramos", no "no disponible"', async () => {
      mockFicha.mockResolvedValue({ status: 'no_encontrado' });
      await montar();
      await waitFor(() => expect(screen.getByTestId('cliente-12')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByTestId('cliente-12'));
      });

      await waitFor(() => expect(screen.getByTestId('ficha-cliente-no-encontrado')).toBeTruthy());
    });
  });
});
