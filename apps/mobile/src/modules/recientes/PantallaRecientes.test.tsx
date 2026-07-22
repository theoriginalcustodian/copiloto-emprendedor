import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/** Partial mock: sólo la red. `formatearImporte` REAL — la fila muestra plata. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, listarActividad: jest.fn() };
});

import { listarActividad, type ActividadItem } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaRecientes } from './PantallaRecientes';

const mockListar = listarActividad as jest.MockedFunction<typeof listarActividad>;

/** Forma medida contra el vivo el 2026-07-22 (`avance_backend..._actividad-hito1`). */
function item(over: Partial<ActividadItem> = {}): ActividadItem {
  return {
    id: 'factura:42',
    tipo: 'factura',
    fecha: '2026-07-22T14:30:00Z',
    titulo: 'Factura B 0001-00000042',
    detalle: 'Panadería Los Tilos',
    monto: '136000.00',
    signo: 'entra',
    ...over,
  };
}

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaRecientes />
    </ThemeProvider>,
  );
}

describe('PantallaRecientes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListar.mockResolvedValue({ status: 'ok', items: [item()], cursor: null });
  });

  it('pinta el título y el detalle que arma el BACKEND, sin recomponerlos', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('actividad-factura:42-titulo')).toBeTruthy());
    expect(screen.getByTestId('actividad-factura:42-titulo')).toHaveTextContent('Factura B 0001-00000042');
    expect(screen.getByTestId('actividad-factura:42-detalle')).toHaveTextContent('Panadería Los Tilos');
    expect(screen.getByTestId('actividad-factura:42-monto')).toHaveTextContent('$136.000,00');
  });

  it('un `sale` lleva el signo menos', async () => {
    mockListar.mockResolvedValue({
      status: 'ok',
      items: [item({ id: 'gasto:7', tipo: 'gasto', signo: 'sale', monto: '8500.00' })],
      cursor: null,
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('actividad-gasto:7-monto')).toBeTruthy());
    expect(screen.getByTestId('actividad-gasto:7-monto')).toHaveTextContent('−$8.500,00');
  });

  it('un tipo SIN monto no dibuja un importe en cero', async () => {
    // Un cliente nuevo no mueve plata. Pintar `$0,00` afirmaría que la operación valió cero.
    mockListar.mockResolvedValue({
      status: 'ok',
      items: [item({ id: 'cliente:3', tipo: 'cliente', monto: null, signo: 'neutro' })],
      cursor: null,
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('actividad-cliente:3-titulo')).toBeTruthy());
    expect(screen.queryByTestId('actividad-cliente:3-monto')).toBeNull();
  });

  it('sin actividad muestra el vacío honesto, nunca datos de nadie', async () => {
    mockListar.mockResolvedValue({ status: 'ok', items: [], cursor: null });

    await montar();

    await waitFor(() => expect(screen.getByTestId('recientes-vacio')).toBeTruthy());
  });

  it('el endpoint no desplegado avisa, no explota', async () => {
    mockListar.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('recientes-no-disponible')).toBeTruthy());
  });

  describe('scroll infinito', () => {
    it('🔴 manda el cursor TAL CUAL vino, sin tocarlo', async () => {
      // Es un token opaco del servidor. Parsearlo, recortarlo o re-serializarlo rompe una paginación
      // que después falla de formas que no se reproducen.
      const cursorDelServidor = '2026-07-22T14:30:00Z|factura:42';
      mockListar.mockResolvedValueOnce({ status: 'ok', items: [item()], cursor: cursorDelServidor });
      mockListar.mockResolvedValueOnce({ status: 'ok', items: [item({ id: 'gasto:9' })], cursor: null });

      await montar();
      await waitFor(() => expect(screen.getByTestId('recientes-lista')).toBeTruthy());

      await act(async () => {
        fireEvent(screen.getByTestId('recientes-lista'), 'onEndReached');
      });

      expect(mockListar).toHaveBeenLastCalledWith({ limit: 20, cursor: cursorDelServidor });
      await waitFor(() => expect(screen.getByTestId('actividad-gasto:9-titulo')).toBeTruthy());
      // La página anterior sigue: se concatena, no se reemplaza.
      expect(screen.getByTestId('actividad-factura:42-titulo')).toBeTruthy();
    });

    it('con `cursor: null` NO pide más — el final lo dice el cursor, no el largo de la página', async () => {
      mockListar.mockResolvedValue({ status: 'ok', items: [item()], cursor: null });

      await montar();
      await waitFor(() => expect(screen.getByTestId('recientes-lista')).toBeTruthy());

      await act(async () => {
        fireEvent(screen.getByTestId('recientes-lista'), 'onEndReached');
      });

      expect(mockListar).toHaveBeenCalledTimes(1);
    });
  });

  it('el tirón recarga desde CERO, no pide la página siguiente', async () => {
    // Es el único disparador que cubre lo que cambió afuera. Si pidiera la siguiente, lo nuevo de
    // arriba —que es justo lo que el usuario busca al tirar— no aparecería nunca.
    mockListar.mockResolvedValue({ status: 'ok', items: [item()], cursor: 'c1' });
    await montar();
    await waitFor(() => expect(screen.getByTestId('recientes-lista')).toBeTruthy());

    await act(async () => {
      // El `RefreshControl` no se monta como nodo consultable dentro de una `FlatList` bajo el
      // test-renderer; se alcanza por la prop, que además es exactamente lo que RN invoca al tirar.
      screen.getByTestId('recientes-lista').props.refreshControl.props.onRefresh();
    });

    expect(mockListar).toHaveBeenLastCalledWith({ limit: 20 });
  });
});
