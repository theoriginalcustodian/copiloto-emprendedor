/**
 * `PantallaMiDia` — el tablero Kanban del día.
 *
 * **[CONNECT] — endpoint no vivo; `leerTablero()` mockeado.** Se fija: (1) «todavía no está» ≠
 * «tablero vacío», (2) el board pinta las columnas en orden con sus tarjetas, (3) una columna vacía se
 * ve vacía sin romper. El DRAG no se prueba acá: no está construido (su tool no está contratada) y es
 * gesto de device.
 *
 * ⚠️ Todo `fireEvent` va con `await` — ver el docstring de `jest.config.js`.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, leerTablero: jest.fn() };
});

import { render, screen, waitFor } from '@testing-library/react-native';

import { leerTablero } from '@copiloto/core';

import { PantallaMiDia } from './PantallaMiDia';
import { ThemeProvider } from '../../theme/ThemeProvider';

const leerMock = leerTablero as jest.MockedFunction<typeof leerTablero>;

const TABLERO = {
  columnas: [
    {
      id: 'presupuesto' as const,
      titulo: 'Presupuestos',
      tarjetas: [{ id: 'p1', titulo: 'Pintura del local', cliente: 'Kiosco', monto: '80000.00', fecha: '2026-07-20', estado: 'borrador' as const }],
    },
    { id: 'facturado' as const, titulo: 'Facturado', tarjetas: [] },
    { id: 'por_cobrar' as const, titulo: 'Por cobrar', tarjetas: [] },
    { id: 'cobrado' as const, titulo: 'Cobrado', tarjetas: [] },
  ],
};

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaMiDia />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  leerMock.mockResolvedValue({ status: 'ok', tablero: TABLERO });
});

describe('PantallaMiDia — el board', () => {
  it('pinta las cuatro columnas en orden, con la tarjeta en la suya', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-columna-presupuesto')).toBeTruthy());
    expect(screen.getByTestId('midia-columna-cobrado')).toBeTruthy();
    expect(screen.getByTestId('midia-tarjeta-p1')).toBeTruthy();
    expect(screen.getByText('Pintura del local')).toBeTruthy();
  });

  it('una columna sin tarjetas se ve vacía, no rota', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-columna-facturado-vacia')).toBeTruthy());
  });
});

describe('PantallaMiDia — lo que NO inventa', () => {
  it('🔴 sin endpoint desplegado lo DICE, y no dibuja board', async () => {
    leerMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('midia-board')).toBeNull();
  });

  it('🔴 tablero REAL sin ninguna tarjeta dice «nada pendiente» — NO se confunde con no_disponible', async () => {
    leerMock.mockResolvedValue({
      status: 'ok',
      tablero: { columnas: TABLERO.columnas.map((c) => ({ ...c, tarjetas: [] })) },
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-vacio')).toBeTruthy());
    expect(screen.queryByTestId('midia-no-disponible')).toBeNull();
  });

  it('🔴 CONTROL — encuentra una tarjeta presente y NO una ausente', async () => {
    await montar();

    await waitFor(() => expect(screen.getByText('Pintura del local')).toBeTruthy());
    expect(screen.queryByText('Tarjeta Que No Existe')).toBeNull();
  });
});
