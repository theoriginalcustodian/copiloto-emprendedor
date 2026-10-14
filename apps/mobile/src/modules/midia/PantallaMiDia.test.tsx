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
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react-native';

import {
  borrarTarjetaMiDia,
  cambiarEstadoTarjetaMiDia,
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
  leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: false, eventos: [] } });
  listarCatalogoMock.mockResolvedValue({ status: 'ok', servicios: [] });
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
  it('🔴 tocar la tarjeta muestra el detalle (cliente); tocar de nuevo lo contrae', async () => {
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

describe('PantallaMiDia — BL-J5 (categoría / criticidad / verbo del backend)', () => {
  it('los chips filtran por `t.categoria`; categoria null sólo aparece en «Todo»', async () => {
    leerMock.mockResolvedValue({
      status: 'ok',
      tablero: tableroCon([tarjetaDe('a', { categoria: 'arca' }), tarjetaDe('n', { categoria: null })]),
    });
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-a')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('midia-chip-arca'));
    expect(screen.getByTestId('midia-tarjeta-a')).toBeTruthy();
    expect(screen.queryByTestId('midia-tarjeta-n')).toBeNull();

    await fireEvent.press(screen.getByTestId('midia-chip-todo'));
    expect(screen.getByTestId('midia-tarjeta-n')).toBeTruthy();
  });

  it('🔴 backend previo (ninguna tarjeta con categoría): no se dibujan chips', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());
    expect(screen.queryByTestId('midia-chips')).toBeNull();
  });

  it('banner crítico: con una tarjeta `critico` aparece con su verbo y el contador la cuenta', async () => {
    leerMock.mockResolvedValue({
      status: 'ok',
      tablero: tableroCon([
        tarjetaDe('c', { criticidad: 'critico', verbo: 'Renovarlo', texto: 'Tu certificado vence en 12 días' }),
        tarjetaDe('p'),
      ]),
    });
    await montar();

    await waitFor(() => expect(screen.getByTestId('midia-alerta')).toBeTruthy());
    expect(screen.getByTestId('midia-alerta-c')).toBeTruthy();
    expect(screen.queryByTestId('midia-alerta-p')).toBeNull();
    expect(screen.getByText('Renovarlo')).toBeTruthy();
    expect(screen.getByTestId('midia-contador')).toHaveTextContent('2 para hoy · 0 en curso · 1 crítico');
  });

  it('🔴 DEVICE15 H5: la píldora del banner es un botón y lleva a Ajustes (antes era un rótulo inerte)', async () => {
    const onAjustes = jest.fn();
    leerMock.mockResolvedValue({
      status: 'ok',
      tablero: tableroCon([
        tarjetaDe('c', { criticidad: 'critico', verbo: 'Reconectar', texto: 'Se me cayó la conexión con Gmail' }),
      ]),
    });
    await montar({ onAjustes });

    await waitFor(() => expect(screen.getByTestId('midia-alerta-c-accion')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('midia-alerta-c-accion'));

    expect(onAjustes).toHaveBeenCalledTimes(1);
  });

  describe('H5b — «Reconectar» rutea por `destino.tipo` (contrato H5B-destino-en-la-tarjeta-critica)', () => {
    async function montarBannerCon(destino: unknown, props: ComponentProps<typeof PantallaMiDia> = {}) {
      leerMock.mockResolvedValue({
        status: 'ok',
        tablero: tableroCon([
          tarjetaDe('c', { criticidad: 'critico', verbo: 'Reconectar', texto: 'Se me cayó la conexión con Gmail', destino }),
        ]),
      });
      await montar(props);
      await waitFor(() => expect(screen.getByTestId('midia-alerta-c-accion')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('midia-alerta-c-accion'));
    }

    it('destino conexion con id → abre ESA conexión (y no Ajustes)', async () => {
      const onAjustes = jest.fn();
      const onConexion = jest.fn();
      await montarBannerCon({ tipo: 'conexion', id: 'gmail', connectPath: '/composio/connect?service=gmail' }, { onAjustes, onConexion });
      expect(onConexion).toHaveBeenCalledWith('gmail');
      expect(onAjustes).not.toHaveBeenCalled();
    });

    it('🔴 tipo DESCONOCIDO (valor inventado) → cae a Ajustes, sin crash ni pantalla en blanco', async () => {
      const onAjustes = jest.fn();
      const onConexion = jest.fn();
      await montarBannerCon({ tipo: 'lo-que-sea', id: 'gmail', connectPath: null }, { onAjustes, onConexion });
      expect(onConexion).not.toHaveBeenCalled();
      expect(onAjustes).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('midia-alerta-c')).toBeTruthy();
    });

    it('destino ausente (backend previo) → Ajustes', async () => {
      const onAjustes = jest.fn();
      const onConexion = jest.fn();
      await montarBannerCon(undefined, { onAjustes, onConexion });
      expect(onConexion).not.toHaveBeenCalled();
      expect(onAjustes).toHaveBeenCalledTimes(1);
    });

    it('conexion SIN id → Ajustes (no hay a qué conexión ir)', async () => {
      const onAjustes = jest.fn();
      const onConexion = jest.fn();
      await montarBannerCon({ tipo: 'conexion', id: null, connectPath: null }, { onAjustes, onConexion });
      expect(onConexion).not.toHaveBeenCalled();
      expect(onAjustes).toHaveBeenCalledTimes(1);
    });
  });

  it('🔴 `tablero`: encabezado, banner, solapas y lista viven en UN solo scroll (no queda una lista de ~1,5 tarjetas)', async () => {
    leerMock.mockResolvedValue({
      status: 'ok',
      tablero: tableroCon([
        tarjetaDe('c', { criticidad: 'critico', verbo: 'Reconectar', texto: 'Se me cayó la conexión con Gmail' }),
        tarjetaDe('p'),
      ]),
    });
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-scroll')).toBeTruthy());
    const scroll = within(screen.getByTestId('midia-scroll'));
    expect(scroll.getByTestId('midia-contador')).toBeTruthy();
    expect(scroll.getByTestId('midia-alerta')).toBeTruthy();
    expect(scroll.getByTestId('midia-solapas')).toBeTruthy();
    expect(scroll.getByTestId('midia-lista')).toBeTruthy();
  });

  it('sin tarjeta crítica no hay banner', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());
    expect(screen.queryByTestId('midia-alerta')).toBeNull();
  });

  it('el verbo se muestra en la tarjeta expandida', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());
    expect(screen.queryByTestId('midia-tarjeta-t1-verbo')).toBeNull();

    await fireEvent.press(screen.getByTestId('midia-tarjeta-t1'));

    expect(screen.getByTestId('midia-tarjeta-t1-verbo')).toHaveTextContent('Revisar el trabajo');
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
    // Mapeo `vacio` (index.html:1853-1854): título con punto y el cuerpo del prototipo.
    expect(screen.getByTestId('midia-vacio-titulo').props.children).toBe('Nada urgente por hoy.');
    expect(screen.getByTestId('midia-vacio-cuerpo').props.children).toBe(
      'Cuando haya algo que mirar, te lo dejo acá. Si querés saber algo, preguntame.',
    );
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
        <PantallaMiDia comoPortada />
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

// PROTO4DEPS §C — `presentacion`: chip, filas clave/valor y acción derivados por el backend. Fail-soft:
// sin ella (producción hoy) la tarjeta se pinta como siempre. El caso VACÍO va primero.
describe('PantallaMiDia — PROTO4DEPS §C (presentacion de la tarjeta expandida)', () => {
  const PRESENTACION = {
    chip: { texto: '31 días sin respuesta', tono: 'pronto' },
    kv: [
      { k: 'Monto', v: '$84.000' },
      { k: 'Enviado', v: '12/09' },
    ],
    accion: { texto: 'Reclamar el pago', destino: { tipo: 'conexion', id: 'mercadopago', connectPath: null } },
  };

  async function expandir(over: Record<string, unknown>, props: ComponentProps<typeof PantallaMiDia> = {}) {
    leerMock.mockResolvedValue({ status: 'ok', tablero: tableroCon([tarjetaDe('p', { verbo: 'Reclamar', ...over })]) });
    await montar(props);
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-p')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('midia-tarjeta-p'));
  }

  it('🔴 SIN presentacion: nada nuevo — el verbo inerte de siempre, sin chip ni píldora', async () => {
    await expandir({});
    expect(screen.getByTestId('midia-tarjeta-p-verbo')).toHaveTextContent('Reclamar');
    expect(screen.queryByTestId('midia-tarjeta-p-chip')).toBeNull();
    expect(screen.queryByTestId('midia-tarjeta-p-accion')).toBeNull();
  });

  it('con presentacion: chip, filas del backend (con SU rótulo) y la píldora en lugar del verbo inerte', async () => {
    await expandir({ presentacion: PRESENTACION, cliente: 'Panadería' });
    expect(screen.getByTestId('midia-tarjeta-p-chip')).toHaveTextContent('31 días sin respuesta');
    const detalle = screen.getByTestId('midia-tarjeta-p-detalle');
    expect(detalle).toHaveTextContent(/Monto/);
    expect(detalle).toHaveTextContent(/\$84\.000/);
    expect(detalle).toHaveTextContent(/Enviado/);
    expect(detalle).toHaveTextContent(/12\/09/);
    // H12 §5: «Cliente» se queda mientras `texto` no nombre la entidad — el nombre no desaparece al llegar la `presentacion`.
    expect(detalle).toHaveTextContent(/Panadería/);
    expect(screen.getByTestId('midia-tarjeta-p-accion')).toHaveTextContent('Reclamar el pago');
    expect(screen.queryByTestId('midia-tarjeta-p-verbo')).toBeNull();
  });

  it('🔴 H12: la PROSA se pinta (ahí vive el importe de la factura) junto a las kv, y sin `presentacion` no hay prosa', async () => {
    await expandir({
      presentacion: {
        prosa: 'Emitida hace 22 días. Son $120.000 que ya facturaste y todavía no entraron.',
        kv: [{ k: 'Factura', v: 'A-0034' }, { k: 'Emitida', v: '22 de septiembre' }],
      },
    });
    expect(screen.getByTestId('midia-tarjeta-p-prosa')).toHaveTextContent(/Son \$120\.000 que ya facturaste/);
    expect(screen.getByTestId('midia-tarjeta-p-detalle')).toHaveTextContent(/A-0034/);
  });

  it('🔴 H12: una tarjeta de SÓLO prosa (regla «trabajo», kv vacía) pinta la prosa y ninguna fila', async () => {
    await expandir({ presentacion: { prosa: 'Pusiste $20.000 y no registraste que te pagaran.', kv: [] } });
    expect(screen.getByTestId('midia-tarjeta-p-prosa')).toHaveTextContent(/no registraste que te pagaran/);
    expect(screen.queryByTestId('midia-tarjeta-p-detalle')).toBeNull();
  });

  it('🔴 H12 control de ceguera: la pantalla NO lee `tarjeta.monto`/`tarjeta.fecha` (ninguna regla los escribe)', () => {
    // Si la tabla fija Monto/Fecha vuelve en un merge, esas filas quedan escritas e inalcanzables y nadie lo
    // ve (ya pasó). El campo tampoco existe en `TarjetaMiDia`, así que el tipo también lo frena.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fuente: string = require('fs').readFileSync(require('path').join(__dirname, 'PantallaMiDia.tsx'), 'utf8');
    expect(fuente).not.toMatch(/tarjeta\.(monto|fecha)/);
  });

  it('la píldora rutea por `rutaDeDestino` TAL CUAL: conexion con id → abre ESA conexión', async () => {
    const onConexion = jest.fn();
    await expandir({ presentacion: PRESENTACION }, { onConexion });
    await fireEvent.press(screen.getByTestId('midia-tarjeta-p-accion'));
    expect(onConexion).toHaveBeenCalledWith('mercadopago');
  });

  it('🔴 un `tipo` que esta app no conoce deja la píldora como RÓTULO: no navega ni cae a Ajustes', async () => {
    const onConexion = jest.fn();
    const onAjustes = jest.fn();
    await expandir(
      { presentacion: { ...PRESENTACION, accion: { texto: 'Reclamar el pago', destino: { tipo: 'presupuesto', id: '412', connectPath: null } } } },
      { onConexion, onAjustes },
    );
    const pildora = screen.getByTestId('midia-tarjeta-p-accion');
    expect(pildora).toHaveTextContent('Reclamar el pago');
    await fireEvent.press(pildora);
    expect(onConexion).not.toHaveBeenCalled();
    expect(onAjustes).not.toHaveBeenCalled();
    expect(pildora.props.accessibilityState?.disabled).toBe(true);
  });

  it('un `tono` desconocido pinta el chip igual (sin color propio) y no rompe', async () => {
    await expandir({ presentacion: { chip: { texto: 'Nuevo', tono: 'urgentisimo' }, kv: [], accion: null } });
    expect(screen.getByTestId('midia-tarjeta-p-chip')).toHaveTextContent('Nuevo');
  });

  it('presentacion sin kv: las filas legadas siguen (no se pierde el detalle que ya había)', async () => {
    await expandir({ presentacion: { chip: { texto: 'x', tono: null }, kv: [], accion: null }, cliente: 'Panadería' });
    expect(screen.getByTestId('midia-tarjeta-p-detalle')).toHaveTextContent(/Panadería/);
    // Sin `accion` de presentacion, el verbo inerte sigue.
    expect(screen.getByTestId('midia-tarjeta-p-verbo')).toBeTruthy();
  });
});
