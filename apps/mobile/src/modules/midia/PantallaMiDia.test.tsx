/**
 * `PantallaMiDia` — el tablero del detector proactivo: 3 solapas, tarjetas con `texto` redactado,
 * tap-para-expandir, swipe-para-mutar (avanzar/borrar).
 *
 * **`leerTablero()` mockeado** (endpoint vivo en device, no en jsdom). Se fija: (1) «todavía no está» ≠
 * «tablero vacío», (2) las 3 solapas están y arranca en "Para hoy" con `id` real (`hecha`, singular),
 * (3) cambiar de solapa muestra SU lista, (4) tap expande/contrae, (5) una solapa sin tarjetas se ve
 * vacía sin romper, (6) las acciones de swipe llaman la mutación correcta y relean el tablero.
 *
 * 🔴 **`ReanimatedSwipeable` se mockea a un passthrough que revela las acciones SIEMPRE** — mismo
 * criterio que el resto del repo con gestos de RNGH (`gate-jsdom-no-ve-gestos-tactiles`): jsdom no
 * puede ejercitar el drag horizontal real (ni siquiera el `GestureDetector` interno de la librería
 * reconstruye su cadena reanimated↔gesture-handler bajo el stub mínimo de `jest.setup.js` — intentarlo
 * es el "whack-a-mole" que ese mismo archivo advierte). Lo que SÍ se prueba acá, con jsdom, es el
 * WIRING: que tocar el botón revelado llama `cambiarEstadoTarjetaMiDia`/`borrarTarjetaMiDia` con los
 * argumentos correctos y que el tablero se relee después. Que el SWIPE en sí (el gesto físico) revela
 * esas acciones sin romper el panel/scroll es DoD de device (contrato §5), no de este archivo.
 *
 * ⚠️ Todo `fireEvent` va con `await` — ver el docstring de `jest.config.js`.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    leerTablero: jest.fn(),
    cambiarEstadoTarjetaMiDia: jest.fn(),
    borrarTarjetaMiDia: jest.fn(),
    leerCalendario: jest.fn(),
  };
});

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return { ...actual, useFocusEffect: (cb: () => void | (() => void)) => require('react').useEffect(cb, []) };
});

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  const { View } = require('react-native');
  const PassthroughSwipeable = forwardRef((props: any, ref: any) => {
    useImperativeHandle(ref, () => ({ close: () => {}, openLeft: () => {}, openRight: () => {}, reset: () => {} }));
    return (
      <View>
        {props.children}
        {props.renderRightActions?.({ value: 1 }, { value: 0 }, {})}
      </View>
    );
  });
  return { __esModule: true, default: PassthroughSwipeable };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { borrarTarjetaMiDia, cambiarEstadoTarjetaMiDia, leerCalendario, leerTablero } from '@copiloto/core';

import { PantallaMiDia } from './PantallaMiDia';
import { ThemeProvider } from '../../theme/ThemeProvider';

const leerMock = leerTablero as jest.MockedFunction<typeof leerTablero>;
const cambiarEstadoMock = cambiarEstadoTarjetaMiDia as jest.MockedFunction<typeof cambiarEstadoTarjetaMiDia>;
const borrarMock = borrarTarjetaMiDia as jest.MockedFunction<typeof borrarTarjetaMiDia>;
const leerCalendarioMock = leerCalendario as jest.MockedFunction<typeof leerCalendario>;

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
  cambiarEstadoMock.mockResolvedValue({ status: 'ok', tarjeta: TABLERO.solapas[0].tarjetas[0] });
  borrarMock.mockResolvedValue({ status: 'ok' });
  leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: false, eventos: [] } });
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

describe('PantallaMiDia — swipe (wiring, no el gesto físico)', () => {
  it('en "Para hoy" ofrece "Empezar" (→ haciendo) y "Borrar"; "Empezar" llama la mutación y relee', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());

    expect(screen.getByTestId('midia-tarjeta-t1-avanzar')).toBeTruthy();
    expect(screen.getByTestId('midia-tarjeta-t1-borrar')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('midia-tarjeta-t1-avanzar'));

    expect(cambiarEstadoMock).toHaveBeenCalledWith('t1', 'haciendo');
    await waitFor(() => expect(leerMock).toHaveBeenCalledTimes(2));
  });

  it('en "Hechas" (terminal) NO ofrece "avanzar" — sólo "Borrar"', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('midia-solapa-hecha'));
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t2')).toBeTruthy());

    expect(screen.queryByTestId('midia-tarjeta-t2-avanzar')).toBeNull();
    expect(screen.getByTestId('midia-tarjeta-t2-borrar')).toBeTruthy();
  });

  it('"Borrar" llama borrarTarjetaMiDia y relee el tablero', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('midia-tarjeta-t1-borrar'));

    expect(borrarMock).toHaveBeenCalledWith('t1');
    await waitFor(() => expect(leerMock).toHaveBeenCalledTimes(2));
  });

  it('🔴 `estado_invalido` NO se disfraza de éxito — no relee, y el tablero queda como estaba', async () => {
    cambiarEstadoMock.mockResolvedValue({ status: 'estado_invalido', motivo: 'ese estado no existe' });

    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('midia-tarjeta-t1-avanzar'));

    expect(cambiarEstadoMock).toHaveBeenCalled();
    expect(leerMock).toHaveBeenCalledTimes(1);
    // La tarjeta sigue ahí: no se asumió el movimiento sin confirmación del backend.
    expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy();
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

describe('PantallaMiDia — panel de calendario (CAL1 §3, fuera del Kanban)', () => {
  it('sin conectar: invita a conectar, no rompe el resto de la pantalla', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: false, eventos: [] } });

    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-calendario-no-conectado')).toBeTruthy());
    expect(screen.getByText(/Conectá Google Calendar/)).toBeTruthy();
    // El Kanban sigue vivo al lado — el calendario no le pisa el estado.
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());
  });

  it('conectado sin eventos hoy: lo dice, no lista vacía silenciosa', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: true, eventos: [] } });

    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-calendario-vacio')).toBeTruthy());
  });

  it('conectado con eventos: pinta título + hora reconocible; un evento sin hora reconocible igual se ve', async () => {
    leerCalendarioMock.mockResolvedValue({
      status: 'ok',
      calendario: {
        conectado: true,
        eventos: [
          { id: 'ev1', titulo: 'Reunión con proveedor', inicioCrudo: { dateTime: '2026-08-12T15:00:00-03:00' } },
          { id: 'ev2', titulo: 'Cumpleaños (todo el día)', inicioCrudo: { date: '2026-08-12' } },
        ],
      },
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-calendario-evento-ev1')).toBeTruthy());
    expect(screen.getByText('Reunión con proveedor')).toBeTruthy();
    expect(screen.getByText('Cumpleaños (todo el día)')).toBeTruthy();
  });

  it('🔴 calendario `no_disponible` no rompe ni tapa el Kanban — se omite en silencio', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());
    expect(screen.queryByTestId('midia-calendario')).toBeNull();
    expect(screen.queryByTestId('midia-calendario-no-conectado')).toBeNull();
  });
});
