// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/**
 * `hitl (a)` — **bajar el chat con el GESTO termina el contexto del aviso**.
 *
 * El test de integración (`PantallaPrincipal.avisoAlChat.test.tsx`) ejercita «Volver al tablero», que
 * limpia el contexto por su propio camino explícito: ese verde NO prueba que el gesto de bajar (que sólo
 * llega por `alBajar` del panel) también lo limpie. Acá el panel se reemplaza por un stub que expone
 * `alBajar` — el gesto real no se simula en jsdom (`PanelDeslizable.test` cubre la señal) — y se lo invoca
 * como lo invocaría el pan al asentarse abajo.
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


let alBajarDelPanel: (() => void) | undefined;
jest.mock('./PanelDeslizable', () => {
  const { View } = require('react-native');
  return {
    PanelDeslizable: (props: any) => {
      alBajarDelPanel = props.alBajar;
      return (
        <View>
          {props.fondo}
          {props.children}
        </View>
      );
    },
  };
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { apiReal as api, leerCalendario, leerTablero, listarCatalogo } from '@copiloto/core';

import { ThemeProvider } from '../theme/ThemeProvider';
import { PantallaPrincipal } from './PantallaPrincipal';

describe('PantallaPrincipal — hitl (a): bajar el chat con el gesto cierra el contexto del aviso', () => {
  it('🔴 el chip «Desde tu aviso» no sobrevive a que el emprendedor baje la conversación', async () => {
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
                texto: 'Hace 12 días que le mandaste el presupuesto a Lucía y no te respondió.',
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

    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-lucia')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('midia-tarjeta-lucia'));
    await fireEvent.press(screen.getByTestId('midia-tarjeta-lucia-verbo'));
    await waitFor(() => expect(screen.getByTestId('chat-contexto-aviso')).toBeTruthy());

    // El pan del panel termina abajo: el shell recibe `alBajar`.
    expect(alBajarDelPanel).toBeDefined();
    await act(async () => {
      alBajarDelPanel?.();
    });

    await waitFor(() => expect(screen.queryByTestId('chat-contexto-aviso')).toBeNull());
  });
});
