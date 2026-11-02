// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/**
 * SM-I1 — la COSTURA del puente cuando el verbo se toca en Tu día: la ruta deja el aviso, vuelve, y el shell
 * lo toma al recuperar el foco. Cubre las dos puntas reales: `app/midia.tsx` (que entrega y vuelve) y
 * `PantallaPrincipal` (que siembra). Un solo `render` del shell en este archivo, a propósito: su entorno se
 * rompe a partir del segundo (`PantallaPrincipal.backHandler.test.tsx`).
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    apiReal: { ...actual.apiReal, sendChat: jest.fn(), sendAudio: jest.fn(), sendFoto: jest.fn(), getReply: jest.fn() },
    leerPerfilNegocio: jest.fn().mockResolvedValue({ status: 'no_disponible' }),
    leerTablero: jest.fn(),
    cambiarEstadoTarjetaMiDia: jest.fn(),
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
    router: { push: jest.fn(), back: jest.fn() },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

jest.mock('../modules/auth/useSession', () => ({
  useSession: () => ({ me: { cliente_id: 'cli-aviso-test', email: 'usuario@copiloto.test' } }),
}));

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
import { router } from 'expo-router';

import { apiReal as api, leerCalendario, leerTablero, listarCatalogo } from '@copiloto/core';

import PantallaTuDiaRoute from '../../app/midia';
import { tomarAvisoParaElChat } from '../navegacion/avisoParaElChat';
import { ThemeProvider } from '../theme/ThemeProvider';
import { PantallaPrincipal } from './PantallaPrincipal';

const TEXTO_AVISO = 'Hace 12 días que le mandaste el presupuesto a Lucía y no te respondió.';

beforeEach(() => {
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
  jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
});

describe('SM-I1 — del verbo en Tu día al chat', () => {
  it('🔴 la ruta deja el aviso y vuelve; el shell lo siembra sin mandarlo, y una sola vez', async () => {
    const ruta = await render(
      <ThemeProvider>
        <PantallaTuDiaRoute />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-lucia')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('midia-tarjeta-lucia'));
    await fireEvent.press(screen.getByTestId('midia-tarjeta-lucia-verbo'));
    expect(router.back).toHaveBeenCalledTimes(1);
    await ruta.unmount();

    await render(
      <ThemeProvider>
        <PantallaPrincipal />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('chat-contexto-aviso')).toBeTruthy());
    expect(api.sendChat).not.toHaveBeenCalled();
    // Consumido: volver a enfocar el shell no lo siembra de nuevo.
    expect(tomarAvisoParaElChat()).toBeNull();
  });
});
