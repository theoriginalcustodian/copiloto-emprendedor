/**
 * `PantallaMiDia` — el tablero del detector proactivo: 3 solapas, tarjetas con `texto` redactado,
 * tap-para-expandir.
 *
 * **`leerTablero()` mockeado** (endpoint vivo en device, no en jsdom). Se fija: (1) «todavía no está» ≠
 * «tablero vacío», (2) las 3 solapas están y arranca en "Para hoy" con `id` real (`hecha`, singular),
 * (3) cambiar de solapa muestra SU lista, (4) tap expande/contrae, (5) una solapa sin tarjetas se ve
 * vacía sin romper. El swipe-para-mutar NO se prueba acá: no está construido (el gesto es el próximo
 * incremento) y es de todos modos gesto de device.
 *
 * ⚠️ Todo `fireEvent` va con `await` — ver el docstring de `jest.config.js`.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, leerTablero: jest.fn() };
});

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return { ...actual, useFocusEffect: (cb: () => void | (() => void)) => require('react').useEffect(cb, []) };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { leerTablero } from '@copiloto/core';

import { PantallaMiDia } from './PantallaMiDia';
import { ThemeProvider } from '../../theme/ThemeProvider';

const leerMock = leerTablero as jest.MockedFunction<typeof leerTablero>;

const TABLERO = {
  solapas: [
    {
      id: 'para_hoy' as const,
      titulo: 'Para hoy',
      tarjetas: [
        {
          id: 't1',
          texto: 'El trabajo de la panadería te dejó $8.000 en contra.',
          regla: 'trabajo_con_margen_negativo',
          entidadTipo: 'trabajo',
          entidadId: 'trab-1',
          estado: 'pendiente',
          cliente: 'Panadería del barrio',
          monto: '-8000.00',
          fecha: '2026-07-22',
        },
      ],
    },
    { id: 'haciendo' as const, titulo: 'Haciendo', tarjetas: [] },
    {
      id: 'hecha' as const,
      titulo: 'Hechas',
      tarjetas: [
        {
          id: 't2',
          texto: 'Ya facturaste el presupuesto de Kiosco.',
          regla: null,
          entidadTipo: null,
          entidadId: null,
          estado: 'hecha',
          cliente: null,
          monto: null,
          fecha: null,
        },
      ],
    },
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

describe('PantallaMiDia — las 3 solapas', () => {
  it('arranca en "Para hoy" y pinta su tarjeta', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());
    expect(screen.getByText('El trabajo de la panadería te dejó $8.000 en contra.')).toBeTruthy();
    expect(screen.queryByTestId('midia-tarjeta-t2')).toBeNull();
  });

  it('tocar la solapa "hecha" (id singular) muestra SU lista, no la anterior', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('midia-solapa-hecha'));

    expect(screen.getByTestId('midia-tarjeta-t2')).toBeTruthy();
    expect(screen.queryByTestId('midia-tarjeta-t1')).toBeNull();
  });

  it('una solapa sin tarjetas ("Haciendo") se ve vacía, no rota', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('midia-solapa-haciendo'));

    expect(screen.getByTestId('midia-vacio')).toBeTruthy();
    expect(screen.queryByTestId('midia-tarjeta-t1')).toBeNull();
  });
});

describe('PantallaMiDia — expandir', () => {
  it('🔴 tocar la tarjeta muestra el detalle (cliente/monto/fecha); tocar de nuevo lo contrae', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());

    expect(screen.queryByTestId('midia-tarjeta-t1-detalle')).toBeNull();

    await fireEvent.press(screen.getByTestId('midia-tarjeta-t1'));
    expect(screen.getByTestId('midia-tarjeta-t1-detalle')).toBeTruthy();
    expect(screen.getByText(/Panadería del barrio/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('midia-tarjeta-t1'));
    expect(screen.queryByTestId('midia-tarjeta-t1-detalle')).toBeNull();
  });
});

describe('PantallaMiDia — lo que NO inventa', () => {
  it('🔴 sin endpoint desplegado lo DICE, y no dibuja lista', async () => {
    leerMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('midia-lista')).toBeNull();
  });

  it('🔴 tablero REAL sin ninguna tarjeta dice «nada pendiente» — NO se confunde con no_disponible', async () => {
    leerMock.mockResolvedValue({
      status: 'ok',
      tablero: { solapas: TABLERO.solapas.map((s) => ({ ...s, tarjetas: [] })) },
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-vacio')).toBeTruthy());
    expect(screen.queryByTestId('midia-no-disponible')).toBeNull();
  });

  it('🔴 CONTROL — encuentra una tarjeta presente y NO una ausente', async () => {
    await montar();

    await waitFor(() => expect(screen.getByText('El trabajo de la panadería te dejó $8.000 en contra.')).toBeTruthy());
    expect(screen.queryByText('Tarjeta Que No Existe')).toBeNull();
  });
});
