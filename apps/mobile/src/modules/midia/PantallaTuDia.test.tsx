/**
 * `PantallaTuDia` — el tablero del detector proactivo: 3 solapas, tarjetas con `texto` redactado,
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
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react-native';

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

import { PantallaTuDia } from './PantallaTuDia';
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

async function montar(props: ComponentProps<typeof PantallaTuDia> = {}) {
  return render(
    <ThemeProvider>
      <PantallaTuDia {...props} />
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

describe('PantallaTuDia — las 3 solapas', () => {
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

describe('PantallaTuDia — expandir', () => {
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

describe('PantallaTuDia — tile de color por categoría (`detalle`, index.html:2493)', () => {
  it('cada tarjeta con categoría decidida por el backend lleva SU tile, con el pastel de su categoría', async () => {
    leerMock.mockResolvedValue({
      status: 'ok',
      tablero: tableroCon([
        tarjetaDe('c', { categoria: 'cobros' }),
        tarjetaDe('a', { categoria: 'arca' }),
        tarjetaDe('p', { categoria: 'presupuestos' }),
        tarjetaDe('t', { categoria: 'tuyas' }),
      ]),
    });
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-c')).toBeTruthy());

    const fondos = ['c', 'a', 'p', 't'].map((id) => {
      const estilo = screen.getByTestId(`midia-tarjeta-${id}-tile`).props.style;
      return Array.isArray(estilo) ? Object.assign({}, ...estilo.flat()).backgroundColor : estilo.backgroundColor;
    });
    // Cuatro categorías, cuatro colores DISTINTOS: un tile del mismo color en todas no distingue nada.
    expect(new Set(fondos).size).toBe(4);
  });

  it('sin categoría —o con una que esta versión no conoce— NO hay tile: no se inventa una identidad', async () => {
    leerMock.mockResolvedValue({
      status: 'ok',
      tablero: tableroCon([tarjetaDe('n', { categoria: null }), tarjetaDe('x', { categoria: 'categoria-del-futuro' })]),
    });
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-n')).toBeTruthy());

    expect(screen.queryByTestId('midia-tarjeta-n-tile')).toBeNull();
    expect(screen.queryByTestId('midia-tarjeta-x-tile')).toBeNull();
  });
});

describe('PantallaTuDia — BL-J5 (categoría / criticidad / verbo del backend)', () => {
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
    async function montarBannerCon(destino: unknown, props: ComponentProps<typeof PantallaTuDia> = {}) {
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
      const onDestino = jest.fn();
      await montarBannerCon({ tipo: 'conexion', id: 'gmail', connectPath: '/composio/connect?service=gmail' }, { onAjustes, onDestino });
      expect(onDestino).toHaveBeenCalledWith({ tipo: 'conexion', servicio: 'gmail' });
      expect(onAjustes).not.toHaveBeenCalled();
    });

    it('destino comprobante con id de fila → abre ESE comprobante (y no Ajustes)', async () => {
      const onAjustes = jest.fn();
      const onDestino = jest.fn();
      await montarBannerCon({ tipo: 'comprobante', id: '412', connectPath: null }, { onAjustes, onDestino });
      expect(onDestino).toHaveBeenCalledWith({ tipo: 'comprobante', comprobanteId: '412' });
      expect(onAjustes).not.toHaveBeenCalled();
    });

    it('destino certificado → abre la pantalla de AFIP (y no Ajustes)', async () => {
      const onAjustes = jest.fn();
      const onDestino = jest.fn();
      await montarBannerCon({ tipo: 'certificado', id: '20123456786:homologacion', connectPath: null }, { onAjustes, onDestino });
      expect(onDestino).toHaveBeenCalledWith({ tipo: 'certificado' });
      expect(onAjustes).not.toHaveBeenCalled();
    });

    it('🔴 trabajo (sin pantalla donde abrir) → cae a Ajustes: no hay un destino que no sea adivinar', async () => {
      const onAjustes = jest.fn();
      const onDestino = jest.fn();
      await montarBannerCon({ tipo: 'trabajo', id: 'presupuesto:7', connectPath: null }, { onAjustes, onDestino });
      expect(onDestino).not.toHaveBeenCalled();
      expect(onAjustes).toHaveBeenCalledTimes(1);
    });

    it('🔴 tipo DESCONOCIDO (valor inventado) → cae a Ajustes, sin crash ni pantalla en blanco', async () => {
      const onAjustes = jest.fn();
      const onDestino = jest.fn();
      await montarBannerCon({ tipo: 'lo-que-sea', id: 'gmail', connectPath: null }, { onAjustes, onDestino });
      expect(onDestino).not.toHaveBeenCalled();
      expect(onAjustes).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('midia-alerta-c')).toBeTruthy();
    });

    it('destino ausente (backend previo) → Ajustes', async () => {
      const onAjustes = jest.fn();
      const onDestino = jest.fn();
      await montarBannerCon(undefined, { onAjustes, onDestino });
      expect(onDestino).not.toHaveBeenCalled();
      expect(onAjustes).toHaveBeenCalledTimes(1);
    });

    it('conexion SIN id → Ajustes (no hay a qué conexión ir)', async () => {
      const onAjustes = jest.fn();
      const onDestino = jest.fn();
      await montarBannerCon({ tipo: 'conexion', id: null, connectPath: null }, { onAjustes, onDestino });
      expect(onDestino).not.toHaveBeenCalled();
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

describe('PantallaTuDia — swipe (wiring, no el gesto físico)', () => {
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

describe('PantallaTuDia — lo que NO inventa', () => {
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

describe('PantallaTuDia — PROTO4DEPS §C (presentacion de la tarjeta expandida)', () => {
  const PRESENTACION = {
    chip: { texto: '31 días sin respuesta', tono: 'pronto' },
    kv: [
      { k: 'Monto', v: '$84.000' },
      { k: 'Enviado', v: '12/09' },
    ],
    accion: { texto: 'Reclamar el pago', destino: { tipo: 'conexion', id: 'mercadopago', connectPath: null } },
  };

  async function expandir(over: Record<string, unknown>, props: ComponentProps<typeof PantallaTuDia> = {}) {
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
    const fuente: string = require('fs').readFileSync(require('path').join(__dirname, 'PantallaTuDia.tsx'), 'utf8');
    expect(fuente).not.toMatch(/tarjeta\.(monto|fecha)\b/);
  });

  it('la píldora rutea por `rutaDeDestino` TAL CUAL: conexion con id → abre ESA conexión', async () => {
    const onDestino = jest.fn();
    await expandir({ presentacion: PRESENTACION }, { onDestino });
    await fireEvent.press(screen.getByTestId('midia-tarjeta-p-accion'));
    expect(onDestino).toHaveBeenCalledWith({ tipo: 'conexion', servicio: 'mercadopago' });
  });

  it('la píldora de una factura impaga abre el detalle de ESE comprobante', async () => {
    const onDestino = jest.fn();
    await expandir(
      { presentacion: { ...PRESENTACION, accion: { texto: 'Reclamar el pago', destino: { tipo: 'comprobante', id: '412', connectPath: null } } } },
      { onDestino },
    );
    const pildora = screen.getByTestId('midia-tarjeta-p-accion');
    expect(pildora.props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(pildora);
    expect(onDestino).toHaveBeenCalledWith({ tipo: 'comprobante', comprobanteId: '412' });
  });

  it('la píldora del certificado por vencer abre la pantalla de AFIP', async () => {
    const onDestino = jest.fn();
    await expandir(
      { presentacion: { ...PRESENTACION, accion: { texto: 'Renovarlo', destino: { tipo: 'certificado', id: '20123456786:produccion', connectPath: null } } } },
      { onDestino },
    );
    await fireEvent.press(screen.getByTestId('midia-tarjeta-p-accion'));
    expect(onDestino).toHaveBeenCalledWith({ tipo: 'certificado' });
  });

  it('🔴 un comprobante con id NO numérico queda como rótulo: abrir «borrador nuevo» sería peor que no navegar', async () => {
    const onDestino = jest.fn();
    await expandir(
      { presentacion: { ...PRESENTACION, accion: { texto: 'Reclamar el pago', destino: { tipo: 'comprobante', id: 'A-0034', connectPath: null } } } },
      { onDestino },
    );
    const pildora = screen.getByTestId('midia-tarjeta-p-accion');
    await fireEvent.press(pildora);
    expect(onDestino).not.toHaveBeenCalled();
    expect(pildora.props.accessibilityState?.disabled).toBe(true);
  });

  it('🔴 un `tipo` sin pantalla donde abrir (trabajo) deja la píldora como RÓTULO: no navega ni cae a Ajustes', async () => {
    const onDestino = jest.fn();
    const onAjustes = jest.fn();
    await expandir(
      { presentacion: { ...PRESENTACION, accion: { texto: 'Revisarlo', destino: { tipo: 'trabajo', id: 'presupuesto:7', connectPath: null } } } },
      { onDestino, onAjustes },
    );
    const pildora = screen.getByTestId('midia-tarjeta-p-accion');
    expect(pildora).toHaveTextContent('Revisarlo');
    await fireEvent.press(pildora);
    expect(onDestino).not.toHaveBeenCalled();
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

describe('PantallaTuDia — hitl (a): el verbo lleva el aviso al chat', () => {
  async function expandirVerbo(over: Record<string, unknown>, props: ComponentProps<typeof PantallaTuDia> = {}) {
    leerMock.mockResolvedValue({
      status: 'ok',
      tablero: tableroCon([
        tarjetaDe('p', {
          texto: 'Hace 12 días que le mandaste el presupuesto a Lucía y no te respondió.',
          regla: 'presupuestos_enfriandose',
          verbo: 'Mandarle un recordatorio',
          categoria: 'presupuestos',
          cliente: 'Lucía',
          ...over,
        }),
      ]),
    });
    await montar(props);
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-p')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('midia-tarjeta-p'));
  }

  it('🔴 SIN `onAvisoAlChat` el verbo sigue siendo rótulo: no es un botón que no lleva a ningún lado', async () => {
    await expandirVerbo({});
    const verbo = screen.getByTestId('midia-tarjeta-p-verbo');
    expect(verbo).toHaveTextContent('Mandarle un recordatorio');
    expect(verbo.props.accessibilityRole).not.toBe('button');
  });

  it('con `onAvisoAlChat` el verbo es un botón, y tocarlo entrega el aviso sembrado + el chip del prototipo', async () => {
    const onAvisoAlChat = jest.fn();
    await expandirVerbo({}, { onAvisoAlChat });

    const verbo = screen.getByTestId('midia-tarjeta-p-verbo');
    expect(verbo.props.accessibilityRole).toBe('button');
    await fireEvent.press(verbo);

    expect(onAvisoAlChat).toHaveBeenCalledTimes(1);
    const aviso = onAvisoAlChat.mock.calls[0][0];
    expect(aviso.contexto).toBe('Desde tu aviso · Presupuestos · Lucía');
    expect(aviso.texto).toContain('Hace 12 días que le mandaste el presupuesto a Lucía');
    expect(aviso.texto).toContain('Mandarle un recordatorio');
  });

  it('🔴 la tarjeta MANUAL no tiene puente aunque haya handler: su verbo («Borrar») no es un pedido al agente', async () => {
    const onAvisoAlChat = jest.fn();
    await expandirVerbo({ regla: null, verbo: 'Borrar', categoria: 'tuyas', cliente: null }, { onAvisoAlChat });

    await fireEvent.press(screen.getByTestId('midia-tarjeta-p-verbo'));
    expect(onAvisoAlChat).not.toHaveBeenCalled();
    expect(borrarMock).toHaveBeenCalledWith('p');
  });

  it('si la tarjeta trae `accion` (con su destino) manda la píldora: el verbo no se duplica como segundo botón', async () => {
    const onAvisoAlChat = jest.fn();
    await expandirVerbo(
      { presentacion: { chip: null, kv: [], accion: { texto: 'Reclamar el pago', destino: { tipo: 'conexion', id: 'gmail', connectPath: null } } } },
      { onAvisoAlChat },
    );
    expect(screen.getByTestId('midia-tarjeta-p-accion')).toBeTruthy();
    expect(screen.queryByTestId('midia-tarjeta-p-verbo')).toBeNull();
  });

  const ACCION_PRESUPUESTO = {
    chip: null,
    kv: [],
    accion: { texto: 'Mandarle un recordatorio', destino: { tipo: 'presupuesto', id: 'p-1', connectPath: null } },
  };

  it('`presupuesto` con `accion`: la píldora es un botón y entrega el aviso de ESA tarjeta (con su `tarjetaId`)', async () => {
    const onAvisoAlChat = jest.fn();
    const onDestino = jest.fn();
    await expandirVerbo({ presentacion: ACCION_PRESUPUESTO }, { onAvisoAlChat, onDestino });

    const pildora = screen.getByTestId('midia-tarjeta-p-accion');
    expect(pildora.props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(pildora);

    expect(onDestino).not.toHaveBeenCalled();
    expect(onAvisoAlChat).toHaveBeenCalledTimes(1);
    const aviso = onAvisoAlChat.mock.calls[0][0];
    expect(aviso.tarjetaId).toBe('p');
    expect(aviso.contexto).toBe('Desde tu aviso · Presupuestos · Lucía');
    expect(aviso.texto).toContain('Hace 12 días que le mandaste el presupuesto a Lucía');
    expect(aviso.texto).toContain('Acción: Mandarle un recordatorio');
  });

  it('🔴 `presupuesto` SIN `onAvisoAlChat`: rótulo deshabilitado (no un botón que no lleva a ningún lado)', async () => {
    await expandirVerbo({ presentacion: ACCION_PRESUPUESTO });
    const pildora = screen.getByTestId('midia-tarjeta-p-accion');
    expect(pildora).toHaveTextContent('Mandarle un recordatorio');
    expect(pildora.props.accessibilityState?.disabled).toBe(true);
  });

  it('🔴 `presupuesto` en una tarjeta SIN regla (manual): no hay puente aunque haya handler', async () => {
    const onAvisoAlChat = jest.fn();
    await expandirVerbo({ regla: null, presentacion: ACCION_PRESUPUESTO }, { onAvisoAlChat });
    const pildora = screen.getByTestId('midia-tarjeta-p-accion');
    await fireEvent.press(pildora);
    expect(onAvisoAlChat).not.toHaveBeenCalled();
    expect(pildora.props.accessibilityState?.disabled).toBe(true);
  });

  it('el chip no inventa cliente ni categoría: sin ellos queda «Desde tu aviso»', async () => {
    const onAvisoAlChat = jest.fn();
    await expandirVerbo({ categoria: null, cliente: null }, { onAvisoAlChat });
    await fireEvent.press(screen.getByTestId('midia-tarjeta-p-verbo'));
    expect(onAvisoAlChat.mock.calls[0][0].contexto).toBe('Desde tu aviso');
  });
});

describe('PantallaTuDia — caida: «Se cayó» lo trae el backend en `presentacion.kv`, la app no lo arma', () => {
  const hoyA = (h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  async function expandirCaida(over: Record<string, unknown>) {
    leerMock.mockResolvedValue({
      status: 'ok',
      tablero: tableroCon([
        tarjetaDe('c', { regla: 'conexion_caida', texto: 'Mercado Pago está caído', verbo: 'Reconectar', ...over }),
      ]),
    });
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-c')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('midia-tarjeta-c'));
    return screen.getByTestId('midia-tarjeta-c-detalle');
  }

  it('🔴 un instante en la tarjeta NO fabrica la fila «Se cayó» ni una hora (la app no arma el kv)', async () => {
    // `desde` ya no existe en `TarjetaMiDia`: se lo inyecto crudo. Si alguien vuelve a leerlo para pintar
    // «Se cayó», este `it` se pone rojo — es el mutante que se reintrodujo a mano para verificarlo.
    const detalle = await expandirCaida({
      desde: hoyA(9, 12),
      presentacion: { chip: null, kv: [{ k: 'Servicio', v: 'Mercado Pago' }], accion: null },
    });
    // Control de ceguera: miró un detalle con filas (si estuviera vacío, los `not` pasarían solos).
    expect(within(detalle).getByText('Servicio')).toBeTruthy();
    expect(within(detalle).getByText('Mercado Pago')).toBeTruthy();
    expect(detalle).not.toHaveTextContent(/Se cayó/);
    expect(detalle).not.toHaveTextContent(/Hoy,/);
  });

  it('sin `presentacion` (backend previo) tampoco hay «Se cayó»: no hay hora que inventar', async () => {
    const detalle = await expandirCaida({ desde: hoyA(9, 12), cliente: 'Mercado Pago' });
    expect(within(detalle).getByText('Mercado Pago')).toBeTruthy(); // control: el detalle tiene su fila «Cliente»
    expect(detalle).not.toHaveTextContent(/Se cayó/);
  });

  it('lo que el backend manda en `presentacion.kv` se pinta tal cual y una sola vez', async () => {
    const detalle = await expandirCaida({
      presentacion: { chip: null, kv: [{ k: 'Se cayó', v: 'Hoy, 9:12' }], accion: null },
    });
    expect(within(detalle).getAllByText('Se cayó')).toHaveLength(1);
    expect(detalle).toHaveTextContent(/Hoy, 9:12/);
  });
});

describe('PantallaTuDia — anotar una tarjeta a mano (SM-E3)', () => {
  // ⚠️ El `TextInput` real de `CampoTexto` es `${testID}-input` (`CampoTexto.tsx:84`): el testID pelado
  // es el View contenedor. La primera versión de estos casos tocaba el contenedor, así que `changeText`
  // no cambiaba nada, el campo quedaba vacío y el botón deshabilitado -- los 4 rojos medían el
  // silencio del instrumento, no la pantalla.
  it('con el campo vacío no manda nada, y los espacios no cuentan como texto', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-alta-enviar')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('midia-alta-enviar'));
    expect(crearMock).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('midia-alta-texto-input'), '   ');
    await fireEvent.press(screen.getByTestId('midia-alta-enviar'));
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('agrega la tarjeta con el texto sin blancos de borde y vuelve a leer el tablero', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-alta-texto-input')).toBeTruthy());
    const lecturasAntes = leerMock.mock.calls.length;

    await fireEvent.changeText(screen.getByTestId('midia-alta-texto-input'), '  Llamar al proveedor  ');
    await fireEvent.press(screen.getByTestId('midia-alta-enviar'));

    await waitFor(() => expect(crearMock).toHaveBeenCalledWith('Llamar al proveedor'));
    await waitFor(() => expect(leerMock.mock.calls.length).toBeGreaterThan(lecturasAntes));
    // El campo queda limpio: si no, el siguiente toque crea la misma tarjeta otra vez.
    await waitFor(() => expect(screen.getByTestId('midia-alta-texto-input').props.value).toBe(''));
  });

  it('🔴 anotar parado en «Haciendo» vuelve a «Para hoy»: la tarjeta manual nace ahí', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('midia-solapa-haciendo'));
    expect(screen.queryByTestId('midia-tarjeta-t1')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('midia-alta-texto-input'), 'Comprar bolsas');
    await fireEvent.press(screen.getByTestId('midia-alta-enviar'));

    // Sin esto el emprendedor toca «Agregar» y no ve aparecer nada: la tarjeta existe, pero en otra
    // solapa. Un alta que no se ve es indistinguible de un alta que falló.
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeTruthy());
  });

  it('🔴 texto vacío para el backend muestra SU motivo, no uno genérico nuestro', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    crearMock.mockResolvedValue({ status: 'texto_vacio', motivo: 'texto vacío' });
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-alta-texto-input')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('midia-alta-texto-input'), 'algo');
    await fireEvent.press(screen.getByTestId('midia-alta-enviar'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('No se pudo anotar la tarjeta', 'texto vacío'));
    alertSpy.mockRestore();
  });

  it('🔴 si el alta falla, lo que escribió NO se pierde', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    crearMock.mockResolvedValue({ status: 'no_disponible' });
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-alta-texto-input')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('midia-alta-texto-input'), 'Llamar al proveedor');
    await fireEvent.press(screen.getByTestId('midia-alta-enviar'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    // Limpiar el campo ante un fallo le borra el texto al emprendedor y encima le sugiere que anduvo.
    expect(screen.getByTestId('midia-alta-texto-input').props.value).toBe('Llamar al proveedor');
    alertSpy.mockRestore();
  });
});

describe('PantallaTuDia — el teclado no tapa el alta (SM-E3 obs. 3)', () => {
  it('el scroll deja pasar el primer toque con el teclado abierto (`handled`): «Agregar» responde al primer toque', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-scroll')).toBeTruthy());
    expect(screen.getByTestId('midia-scroll').props.keyboardShouldPersistTaps).toBe('handled');
  });
});

describe('PantallaTuDia — SM-I1: la pantalla propia del tablero', () => {
  it('se titula «Tu día», con su bajada y su «Volver»', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('tudia-subtitulo')).toBeTruthy());
    expect(screen.getByTestId('glass-titulo').props.children).toBe('Tu día');
    expect(screen.getByText('Lo que Odobi detectó y lo que anotaste vos.')).toBeTruthy();
    expect(screen.getByTestId('glass-volver')).toBeTruthy();
  });

  it('🔴 conserva los filtros por categoría y «Anotar algo para hoy» (D3)', async () => {
    leerMock.mockResolvedValue({
      status: 'ok',
      tablero: {
        solapas: TABLERO.solapas.map((s) =>
          s.id === 'para_hoy' ? { ...s, tarjetas: s.tarjetas.map((t) => ({ ...t, categoria: 'presupuestos' })) } : s,
        ),
      } as never,
    });
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-chips')).toBeTruthy());
    expect(screen.getByTestId('midia-alta-texto-input')).toBeTruthy();
    expect(screen.getByTestId('midia-solapas')).toBeTruthy();
  });

  it('🔴 la tarjeta anotada también se borra sin swipe', async () => {
    leerMock.mockResolvedValue({
      status: 'ok',
      tablero: {
        solapas: TABLERO.solapas.map((s) => (s.id === 'para_hoy' ? { ...s, tarjetas: [tarjetaDe('anotada', { texto: 'Pasar por el banco', regla: null, verbo: 'Borrar', categoria: 'tuyas', criticidad: 'sin_plazo' } as never)] } : s)),
      } as never,
    });
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-anotada')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('midia-tarjeta-anotada'));
    await fireEvent.press(screen.getByTestId('midia-tarjeta-anotada-verbo'));
    expect(borrarMock).toHaveBeenCalledWith('anotada');
  });

  it('lo que resume Mi día no está acá: ni portada ni calendario', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('midia-lista')).toBeTruthy());
    expect(screen.queryByTestId('midia-wordmark')).toBeNull();
    expect(screen.queryByTestId('midia-ver-agenda')).toBeNull();
    expect(leerCalendarioMock).not.toHaveBeenCalled();
  });
});
