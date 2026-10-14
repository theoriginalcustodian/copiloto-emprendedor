// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/**
 * `hitl (a)` — el puente tarjeta de Mi día → chat, **de punta a punta en el shell real**: tocar el verbo
 * de una tarjeta detectada siembra su aviso en el composer del chat (sin mandarlo), muestra el chip
 * «Desde tu aviso · …» y «Volver al tablero» lo cierra.
 *
 * Es el test que cubre la COSTURA: `PantallaMiDia` (que entrega el aviso) y `ChatView` (que lo recibe)
 * tienen cada uno el suyo, y un cableado roto en `PantallaPrincipal` los deja a los dos en verde. Un solo
 * `render` en este archivo, a propósito: el entorno de este shell se rompe a partir del segundo
 * (`PantallaPrincipal.backHandler.test.tsx`).
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    // El chat real monta acá: su transporte se mockea (nada de red) y se asevera que sembrar NO manda.
    apiReal: { ...actual.apiReal, sendChat: jest.fn(), sendAudio: jest.fn(), sendFoto: jest.fn(), getReply: jest.fn() },
    leerPerfilNegocio: jest.fn().mockResolvedValue({ status: 'no_disponible' }),
    leerTablero: jest.fn(),
    leerCalendario: jest.fn(),
    listarCatalogo: jest.fn(),
  };
});

jest.mock('../adapters/almacen', () => ({
  almacenClave: {
    leer: jest.fn().mockResolvedValue(null),
    guardar: jest.fn().mockResolvedValue(undefined),
    borrar: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

jest.mock('../modules/auth/useSession', () => ({
  useSession: () => ({ me: { cliente_id: 'cli-aviso-test', email: 'usuario@copiloto.test' } }),
}));

// `ReanimatedSwipeable` como passthrough: jsdom no ejercita el drag horizontal (ver `PantallaMiDia.test`).
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

import { apiReal as api, leerCalendario, leerTablero, listarCatalogo } from '@copiloto/core';

import { ThemeProvider } from '../theme/ThemeProvider';
import { PantallaPrincipal } from './PantallaPrincipal';

const TEXTO_AVISO = 'Hace 12 días que le mandaste el presupuesto a Lucía y no te respondió.';

describe('PantallaPrincipal — hitl (a): el verbo de la tarjeta lleva el aviso al chat', () => {
  it('siembra el aviso en el composer SIN mandarlo, muestra el chip y «Volver al tablero» lo cierra', async () => {
    jest.mocked(leerTablero).mockResolvedValue({
      status: 'ok',
      tablero: {
        solapas: [
          {
            id: 'para_hoy' as const,
            titulo: 'Para hoy',
            tarjetas: [
              {
                id: 'lucia',
                texto: TEXTO_AVISO,
                regla: 'presupuestos_enfriandose',
                entidadTipo: 'presupuesto',
                entidadId: 'p-1',
                estado: 'pendiente',
                cliente: 'Lucía',
                categoria: 'presupuestos',
                criticidad: 'pronto',
                verbo: 'Mandarle un recordatorio',
              },
            ],
          },
          { id: 'haciendo' as const, titulo: 'Haciendo', tarjetas: [] },
          { id: 'hecha' as const, titulo: 'Hechas', tarjetas: [] },
        ],
      },
    });
    jest.mocked(leerCalendario).mockResolvedValue({ status: 'ok', calendario: { conectado: false, eventos: [] } });
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [] });
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });

    await render(
      <ThemeProvider>
        <PantallaPrincipal />
      </ThemeProvider>,
    );

    // Antes de tocar nada: el chat de siempre, sin chip.
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-lucia')).toBeTruthy());
    expect(screen.queryByTestId('chat-contexto-aviso')).toBeNull();

    await fireEvent.press(screen.getByTestId('midia-tarjeta-lucia'));
    await fireEvent.press(screen.getByTestId('midia-tarjeta-lucia-verbo'));

    // El aviso entra sembrado — NO se mandó: lo manda quien lo lee.
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.value).toContain(TEXTO_AVISO));
    expect(screen.getByTestId('chat-composer').props.value).toContain('Mandarle un recordatorio');
    expect(api.sendChat).not.toHaveBeenCalled();
    expect(screen.getByTestId('chat-contexto-aviso-texto')).toHaveTextContent('Desde tu aviso · Presupuestos · Lucía');

    // La salida del prototipo: el contexto se cierra.
    await fireEvent.press(screen.getByTestId('chat-contexto-aviso-volver'));
    await waitFor(() => expect(screen.queryByTestId('chat-contexto-aviso')).toBeNull());
  });
});
