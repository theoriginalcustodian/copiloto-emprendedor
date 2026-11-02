/**
 * `PantallaMiDia` — la base: cabecera + portada, «Ahora · Ver agenda ›» y «Para hoy · N cosas · Ver tablero ›».
 * Resume y no gestiona (SM-I1): lo de gestionar se prueba en `PantallaTuDia.test.tsx`.
 *
 * **`leerTablero()` mockeado** (endpoint vivo en device, no en jsdom).
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
    crearTarjetaMiDia: jest.fn(),
    leerCalendario: jest.fn(),
    listarCatalogo: jest.fn(),
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

import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react-native';

import { Alert } from 'react-native';

import {
  borrarTarjetaMiDia,
  cambiarEstadoTarjetaMiDia,
  crearTarjetaMiDia,
  fechaDeHoyMidia,
  KEY_GOOGLE_CALENDAR,
  leerCalendario,
  leerTablero,
  listarCatalogo,
} from '@copiloto/core';

import { PantallaMiDia } from './PantallaMiDia';
import { ThemeProvider } from '../../theme/ThemeProvider';

const leerMock = leerTablero as jest.MockedFunction<typeof leerTablero>;
const cambiarEstadoMock = cambiarEstadoTarjetaMiDia as jest.MockedFunction<typeof cambiarEstadoTarjetaMiDia>;
const borrarMock = borrarTarjetaMiDia as jest.MockedFunction<typeof borrarTarjetaMiDia>;
const crearMock = crearTarjetaMiDia as jest.MockedFunction<typeof crearTarjetaMiDia>;
const leerCalendarioMock = leerCalendario as jest.MockedFunction<typeof leerCalendario>;
const listarCatalogoMock = listarCatalogo as jest.MockedFunction<typeof listarCatalogo>;

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
          categoria: null,
          criticidad: 'pronto',
          verbo: 'Revisar el trabajo',
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
          categoria: null,
          criticidad: 'sin_plazo',
          verbo: 'Borrar',
        },
      ],
    },
  ],
};

async function montar(props: ComponentProps<typeof PantallaMiDia> = {}) {
  return render(
    <ThemeProvider>
      <PantallaMiDia {...props} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  leerMock.mockResolvedValue({ status: 'ok', tablero: TABLERO });
  cambiarEstadoMock.mockResolvedValue({ status: 'ok', tarjeta: TABLERO.solapas[0].tarjetas[0] });
  borrarMock.mockResolvedValue({ status: 'ok' });
  crearMock.mockResolvedValue({ status: 'ok', tarjeta: TABLERO.solapas[0].tarjetas[0] });
  leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: false, eventos: [] } });
  listarCatalogoMock.mockResolvedValue({ status: 'ok', servicios: [] });
});



function tarjetaDe(id: string, over: Record<string, unknown> = {}) {
  return {
    id, texto: `Tarjeta ${id}`, regla: 'x', entidadTipo: null, entidadId: null, estado: 'pendiente',
    cliente: null, categoria: null, criticidad: 'pronto', verbo: null, ...over,
  };
}
function tableroCon(para: ReturnType<typeof tarjetaDe>[]) {
  return {
    solapas: [
      { id: 'para_hoy' as const, titulo: 'Para hoy', tarjetas: para },
      { id: 'haciendo' as const, titulo: 'Haciendo', tarjetas: [] },
      { id: 'hecha' as const, titulo: 'Hechas', tarjetas: [] },
    ],
  };
}








// PROTO4DEPS §C — `presentacion`: chip, filas clave/valor y acción derivados por el backend. Fail-soft:
// sin ella (producción hoy) la tarjeta se pinta como siempre. El caso VACÍO va primero.

// hitl (a) — el puente tarjeta → chat (C-D5 Opción A, texto sembrado). El caso SIN puente va primero:
// el verbo inerte de siempre es lo que ve quien monta la pantalla sin handler (la ruta `/midia` glass).

// hitl (a.5) — el ciclo cierra donde empezó (`index.html:2779-2781`). La fuente de verdad es el SERVIDOR: el
// mock de abajo lo modela (un PATCH cambia lo que la siguiente lectura devuelve), así que «no vuelve a
// ofrecerse» no depende de ningún flag local de la pantalla.

// caida — «Se cayó · hora» (`index.html:3658`) lo emite el BACKEND en `presentacion.kv`; la app NO lo arma.
// KVCAIDASALE (2026-10-14): armarlo acá desde `datos.desde` era la tabla regla→campo que DETALLEKV §2 prohíbe y,
// post-deploy, un camino inalcanzable y verde. Este bloque es lo que lo pone ROJO si alguien lo reintroduce.

/**
 * El alta **a mano** (SM-E3) -- gemelo de
 * `apps/copiloto-web/src/modules/midia/MidiaScreen.test.tsx`. `POST /mi-dia/tarjetas` y
 * `crearTarjetaMiDia` existian desde siempre y **ninguna pantalla los llamaba**: estos casos son lo
 * que impide que la capacidad vuelva a quedar muerta.
 */

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

  it('BL-W11 fila 4b: sin conexión pero el catálogo dice que ESTÁ caída — copy distinta, ofrece reconectar', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: false, eventos: [] } });
    listarCatalogoMock.mockResolvedValue({
      status: 'ok',
      servicios: [{ key: KEY_GOOGLE_CALENDAR, estado: 'caido' } as never],
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-calendario-caida')).toBeTruthy());
    expect(screen.getByText(/Se cayó la conexión con Google Calendar/)).toBeTruthy();
    expect(screen.getByText(/Reconectala/)).toBeTruthy();
    expect(screen.queryByTestId('midia-calendario-no-conectado')).toBeNull();
  });

  it('sin catálogo (fail-soft) degrada al texto de "nunca conectada", no se inventa una caída', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: false, eventos: [] } });
    listarCatalogoMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-calendario-no-conectado')).toBeTruthy());
    expect(screen.queryByTestId('midia-calendario-caida')).toBeNull();
  });
});

describe('PantallaMiDia — fecha de hoy en la portada (BL-W11 fila 4a)', () => {
  it('la portada (home) muestra la fecha de hoy, sin hora, junto al wordmark', async () => {
    render(
      <ThemeProvider>
        <PantallaMiDia />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('midia-fecha')).toBeTruthy());
    expect(screen.getByText(fechaDeHoyMidia())).toBeTruthy();
  });
});

describe('PantallaMiDia — entrada a la agenda (BL-J13)', () => {
  it('con `onAgenda` y el calendario listo, «Ver agenda» la abre', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: true, eventos: [] } });
    const onAgenda = jest.fn();

    render(
      <ThemeProvider>
        <PantallaMiDia onAgenda={onAgenda} />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('midia-ver-agenda')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('midia-ver-agenda'));
    expect(onAgenda).toHaveBeenCalledTimes(1);
  });

  it('sin `onAgenda` no hay entrada (la ruta glass /midia no la ofrece)', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: true, eventos: [] } });

    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-calendario-vacio')).toBeTruthy());
    expect(screen.queryByTestId('midia-ver-agenda')).toBeNull();
  });

  it('AGCAID: con Calendar CAÍDO no hay «Ver agenda» -- no hay agenda que mostrar', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: false, eventos: [] } });
    listarCatalogoMock.mockResolvedValue({
      status: 'ok',
      servicios: [{ key: KEY_GOOGLE_CALENDAR, estado: 'caido' } as never],
    });

    render(
      <ThemeProvider>
        <PantallaMiDia onAgenda={jest.fn()} />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('midia-calendario-caida')).toBeTruthy());
    expect(screen.queryByTestId('midia-ver-agenda')).toBeNull();
  });

  it('AGCAID (control negativo): `nunca_conectado` -- sin catálogo con salud, «Ver agenda» sigue ofreciéndose', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: false, eventos: [] } });
    listarCatalogoMock.mockResolvedValue({ status: 'no_disponible' });

    render(
      <ThemeProvider>
        <PantallaMiDia onAgenda={jest.fn()} />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('midia-calendario-no-conectado')).toBeTruthy());
    expect(screen.getByTestId('midia-ver-agenda')).toBeTruthy();
  });
});

describe('PantallaMiDia — hitl (a.5): volver del chat con resultado cierra la tarjeta de origen', () => {
  function servidorConUnaTarjeta() {
    const estado: Record<string, string> = { p: 'pendiente' };
    leerMock.mockImplementation(async () => {
      const t = tarjetaDe('p', { texto: 'Hace 12 días que le mandaste el presupuesto a Lucía.', verbo: 'Mandarle un recordatorio' });
      return {
        status: 'ok' as const,
        tablero: {
          solapas: [
            { id: 'para_hoy' as const, titulo: 'Para hoy', tarjetas: estado.p === 'hecha' ? [] : [t] },
            { id: 'haciendo' as const, titulo: 'Haciendo', tarjetas: [] },
            { id: 'hecha' as const, titulo: 'Hechas', tarjetas: estado.p === 'hecha' ? [t] : [] },
          ],
        },
      };
    });
    cambiarEstadoMock.mockImplementation(async (id, nuevo) => {
      estado[id] = nuevo;
      return { status: 'ok' as const, tarjeta: tarjetaDe(id) as never };
    });
  }

  it('con `cierreDeAviso` marca la tarjeta `hecha` en el servidor, recarga y NO vuelve a ofrecerse en «Para hoy»', async () => {
    servidorConUnaTarjeta();
    const { rerender } = await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-p')).toBeTruthy());

    await rerender(
      <ThemeProvider>
        <PantallaMiDia cierreDeAviso={{ tarjetaId: 'p', n: 1 }} />
      </ThemeProvider>,
    );

    await waitFor(() => expect(cambiarEstadoMock).toHaveBeenCalledWith('p', 'hecha'));
    await waitFor(() => expect(screen.queryByTestId('midia-tarjeta-p')).toBeNull());
  });

  it('un re-render con el MISMO cierre no manda un segundo PATCH; uno nuevo (`n` mayor) sí', async () => {
    servidorConUnaTarjeta();
    const { rerender } = await montar({ cierreDeAviso: { tarjetaId: 'p', n: 1 } });
    await waitFor(() => expect(cambiarEstadoMock).toHaveBeenCalledTimes(1));

    await rerender(
      <ThemeProvider>
        <PantallaMiDia cierreDeAviso={{ tarjetaId: 'p', n: 1 }} />
      </ThemeProvider>,
    );
    expect(cambiarEstadoMock).toHaveBeenCalledTimes(1);

    await rerender(
      <ThemeProvider>
        <PantallaMiDia cierreDeAviso={{ tarjetaId: 'p', n: 2 }} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(cambiarEstadoMock).toHaveBeenCalledTimes(2));
  });

  it('🔴 sin `cierreDeAviso` no se toca ninguna tarjeta (volver del chat con el chip no resuelve nada)', async () => {
    servidorConUnaTarjeta();
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-p')).toBeTruthy());
    expect(cambiarEstadoMock).not.toHaveBeenCalled();
  });
});

describe('PantallaMiDia — SM-I1: resume, no gestiona', () => {
  const CRITICA = tarjetaDe('caida', {
    texto: 'Se cortó la conexión con Mercado Pago.',
    criticidad: 'critico',
    presentacion: {
      chip: null,
      kv: [],
      prosa: null,
      accion: { texto: 'Reconectar', destino: { tipo: 'conexion', id: 'mercadopago' } },
    },
  } as never);
  const conParaHoy = (tarjetas: readonly unknown[]) => ({
    status: 'ok' as const,
    tablero: {
      solapas: [
        { id: 'para_hoy' as const, titulo: 'Para hoy', tarjetas: tarjetas as never },
        { id: 'haciendo' as const, titulo: 'Haciendo', tarjetas: [] },
        { id: 'hecha' as const, titulo: 'Hechas', tarjetas: [tarjetaDe('vieja', { texto: 'Una que ya terminó.' })] as never },
      ],
    },
  });

  it('la cabecera lleva el wordmark y la fecha aunque la portada no haya cargado', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-cabecera')).toBeTruthy());
    expect(within(screen.getByTestId('midia-cabecera')).getByTestId('midia-wordmark')).toBeTruthy();
    expect(within(screen.getByTestId('midia-cabecera')).getByTestId('midia-fecha')).toBeTruthy();
  });

  it('«Ahora» muestra la hora con «Ver agenda ›» al lado', async () => {
    await montar({ onAgenda: jest.fn() });
    await waitFor(() => expect(screen.getByTestId('midia-hora')).toBeTruthy());
    expect(screen.getByTestId('midia-hora').props.children).toMatch(/^\d{2}:\d{2}$/);
    expect(screen.getByText('Ahora')).toBeTruthy();
  });

  it('🔴 la hora de «Ahora» no queda vieja con la pantalla abierta', async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 2, 16, 12, 0) });
    try {
      await montar({ onAgenda: jest.fn() });
      await waitFor(() => expect(screen.getByTestId('midia-hora').props.children).toBe('16:12'));
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByTestId('midia-hora').props.children).toBe('16:13');
    } finally {
      jest.useRealTimers();
    }
  });

  it('un calendario `no_disponible` se lleva también el rótulo «Ahora»', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'no_disponible' });
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());
    expect(screen.queryByText('Ahora')).toBeNull();
  });

  it('«Para hoy» cuenta en singular, y «Ver tablero ›» abre Tu día', async () => {
    const onVerTablero = jest.fn();
    await montar({ onVerTablero });
    await waitFor(() => expect(screen.getByTestId('midia-para-hoy-cuenta').props.children).toBe('1 cosa'));
    await fireEvent.press(screen.getByTestId('midia-ver-tablero'));
    expect(onVerTablero).toHaveBeenCalledTimes(1);
  });

  it('«Para hoy» cuenta en plural', async () => {
    leerMock.mockResolvedValue(conParaHoy([tarjetaDe('a'), tarjetaDe('b')]));
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-para-hoy-cuenta').props.children).toBe('2 cosas'));
  });

  it('🔴 el rótulo «Para hoy · Ver tablero» sigue con el día vacío: es la puerta para anotar', async () => {
    leerMock.mockResolvedValue(conParaHoy([]));
    await montar({ onVerTablero: jest.fn() });
    await waitFor(() => expect(screen.getByTestId('midia-vacio')).toBeTruthy());
    expect(screen.getByTestId('midia-ver-tablero')).toBeTruthy();
    expect(screen.queryByTestId('midia-para-hoy-cuenta')).toBeNull();
  });

  it('🔴 el rótulo también sigue con el tablero caído', async () => {
    leerMock.mockResolvedValue({ status: 'no_disponible' });
    await montar({ onVerTablero: jest.fn() });
    await waitFor(() => expect(screen.getByTestId('midia-no-disponible')).toBeTruthy());
    expect(screen.getByTestId('midia-ver-tablero')).toBeTruthy();
  });

  it('sólo lista «Para hoy»: lo hecho vive en el tablero', async () => {
    leerMock.mockResolvedValue(conParaHoy([tarjetaDe('a')]));
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-a')).toBeTruthy());
    expect(screen.queryByTestId('midia-tarjeta-vieja')).toBeNull();
  });

  it('🔴 la primera arranca abierta y cerrarla se respeta', async () => {
    leerMock.mockResolvedValue(conParaHoy([{ ...CRITICA }, tarjetaDe('b')]));
    await montar({ onDestino: jest.fn() });
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-caida-accion')).toBeTruthy());
    expect(screen.queryByTestId('midia-tarjeta-b-verbo')).toBeNull();

    await fireEvent.press(screen.getByTestId('midia-tarjeta-caida'));
    expect(screen.queryByTestId('midia-tarjeta-caida-accion')).toBeNull();
    // Lo que abre el emprendedor reemplaza a la primera.
    await fireEvent.press(screen.getByTestId('midia-tarjeta-caida'));
    expect(screen.getByTestId('midia-tarjeta-caida-accion')).toBeTruthy();
  });

  it('🔴 lo crítico se actúa desde su tarjeta: sin banner, la acción lleva a su destino', async () => {
    const onDestino = jest.fn();
    leerMock.mockResolvedValue(conParaHoy([CRITICA]));
    await montar({ onDestino });
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-caida-accion')).toBeTruthy());
    expect(screen.queryByTestId('midia-alerta')).toBeNull();

    await fireEvent.press(screen.getByTestId('midia-tarjeta-caida-accion'));
    expect(onDestino).toHaveBeenCalledWith({ tipo: 'conexion', servicio: 'mercadopago' });
  });

  it('🔴 la tarjeta anotada se borra desde su botón y el tablero se relee: el verbo no queda como texto muerto', async () => {
    jest.mocked(borrarTarjetaMiDia).mockResolvedValue({ status: 'ok' });
    leerMock.mockResolvedValue(conParaHoy([tarjetaDe('anotada', { texto: 'Pasar por el banco', regla: null, verbo: 'Borrar', categoria: 'tuyas', criticidad: 'sin_plazo' } as never)]));
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-anotada-verbo')).toBeTruthy());
    const lecturas = leerMock.mock.calls.length;
    await fireEvent.press(screen.getByTestId('midia-tarjeta-anotada-verbo'));
    expect(borrarTarjetaMiDia).toHaveBeenCalledWith('anotada');
    await waitFor(() => expect(leerMock.mock.calls.length).toBeGreaterThan(lecturas));
  });

  it('🔴 lo de gestionar NO está acá: ni solapas, ni chips, ni alta, ni swipe', async () => {
    leerMock.mockResolvedValue(conParaHoy([tarjetaDe('a', { categoria: 'presupuestos' } as never)]));
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-a')).toBeTruthy());
    expect(screen.queryByTestId('midia-solapas')).toBeNull();
    expect(screen.queryByTestId('midia-chips')).toBeNull();
    expect(screen.queryByTestId('midia-alta')).toBeNull();
    expect(screen.queryByTestId('midia-tarjeta-a-borrar')).toBeNull();
    expect(screen.queryByTestId('midia-tarjeta-a-avanzar')).toBeNull();
  });
});
