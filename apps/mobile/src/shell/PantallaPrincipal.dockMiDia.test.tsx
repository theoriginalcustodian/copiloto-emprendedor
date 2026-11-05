// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/**
 * SM-I2 — la COSTURA del dock de Mi día: `DockEntrada` graba acá pero la charla vive en `ChatView`, y un
 * cableado roto en `PantallaPrincipal` deja a los dos con sus suites en verde. Un solo `render` en este
 * archivo, a propósito: el entorno de este shell se rompe a partir del segundo
 * (`PantallaPrincipal.backHandler.test.tsx`).
 */
// El gesto real lo prueba `BotonVoz.test`: acá importa adónde va lo grabado en Mi día.
const mockVoz = {
  fase: 'inactivo' as const,
  niveles: [] as number[],
  segundos: 0,
  iniciar: jest.fn().mockResolvedValue(true),
  pausar: jest.fn(),
  reanudar: jest.fn(),
  detener: jest.fn().mockResolvedValue(undefined),
  descartar: jest.fn().mockResolvedValue(undefined),
  tomar: jest.fn(),
};
jest.mock('../modules/chat/useVozComando', () => ({ useVozComando: () => mockVoz }));
jest.mock('../modules/chat/BotonVoz', () => {
  const { Pressable, Text } = require('react-native');
  return {
    BotonVoz: ({ onSoltarSinFijar }: any) => (
      <Pressable testID="mock-soltar" onPress={onSoltarSinFijar}>
        <Text>soltar</Text>
      </Pressable>
    ),
  };
});
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn().mockResolvedValue(undefined) }));

jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    // El chat real monta acá: su transporte se mockea (nada de red) y se asevera que sembrar NO manda.
    apiReal: { ...actual.apiReal, sendChat: jest.fn(), sendAudio: jest.fn(), sendFoto: jest.fn(), getReply: jest.fn() },
    leerPerfilNegocio: jest.fn().mockResolvedValue({ status: 'no_disponible' }),
    transcribir: jest.fn().mockResolvedValue({ transcript: 'gasté cuatro mil en nafta' }),
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

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { apiReal as api, leerCalendario, leerTablero, listarCatalogo, transcribir } from '@copiloto/core';

import { ThemeProvider } from '../theme/ThemeProvider';
import { PantallaPrincipal } from './PantallaPrincipal';

describe('PantallaPrincipal — SM-I2/SM-P9: el dock de Mi día entra al chat', () => {
  it('🔴 el campo de Mi día SE EDITA y lo escrito/dictado se MANDA una vez por el chat; el mic del chat transcribe y pega', async () => {
    jest.mocked(leerTablero).mockResolvedValue({ status: 'ok', tablero: { solapas: [] } } as any);
    jest.mocked(leerCalendario).mockResolvedValue({ status: 'ok', calendario: { conectado: false, eventos: [] } });
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [] });
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(api.sendAudio).mockResolvedValue({ replies: [], next_id: 0 } as any);
    jest.mocked(api.sendChat).mockResolvedValue({ replies: [], next_id: 0 } as any);
    const audio = { datos: 'file:///cache/voz.m4a', nombre: 'voz.m4a', tipo: 'audio/mp4' };
    mockVoz.tomar.mockReturnValue(audio);

    await render(
      <ThemeProvider>
        <PantallaPrincipal />
      </ThemeProvider>,
    );

    // 🔴 SM-P9: el campo de Mi día ya NO es un botón «abrir el chat»: es un campo de texto como el de todas las funciones.
    await waitFor(() => expect(screen.getAllByTestId('chat-composer')).toHaveLength(2));
    expect(screen.queryByTestId('chat-composer-abrir')).toBeNull();
    expect(api.sendChat).not.toHaveBeenCalled();
    expect(api.sendAudio).not.toHaveBeenCalled();

    // 🔴 El orden del árbol: el PRIMER dock es el del CHAT (`chat-dock-flotante`) y el segundo el de Mi día
    // (`panel-pie-abajo`). Medido en el árbol, no supuesto: este archivo pulsaba `mics[0]` creyendo que era el de Mi día
    // y probaba el envío del chat. Además el pie de Mi día tiene `pointerEvents="none"` mientras el chat está arriba, así
    // que RNTL descarta un evento sobre él; se invoca el handler del host, que es lo que el gesto real haría.
    const composers = screen.getAllByTestId('chat-composer');
    expect(composers[1]!.props.editable).not.toBe(false);

    // Escribir NO manda (el envío es el acto): el borrador vive en el campo.
    await act(async () => {
      composers[1]!.props.onChangeText('gasté cuatro mil en nafta');
    });
    expect(api.sendChat).not.toHaveBeenCalled();

    // Enviar desde Mi día: se MANDA por el chat (una vez) con el texto escrito.
    await act(async () => {
      screen.getByTestId('chat-enviar').props.onClick({ nativeEvent: {}, stopPropagation: () => {}, preventDefault: () => {} });
    });
    await waitFor(() => expect(api.sendChat).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(jest.mocked(api.sendChat).mock.calls[0])).toContain('gasté cuatro mil en nafta');

    // Dictar en Mi día MANDA el audio directo, UNA vez, y no transcribe.
    const mics = screen.getAllByTestId('mock-soltar');
    expect(mics).toHaveLength(2);
    await act(async () => {
      mics[1]!.props.onClick({ nativeEvent: {}, stopPropagation: () => {}, preventDefault: () => {} });
    });
    await waitFor(() => expect(api.sendAudio).toHaveBeenCalledTimes(1));
    expect(jest.mocked(api.sendAudio).mock.calls[0]).toContainEqual(audio);
    expect(transcribir).not.toHaveBeenCalled();

    // El dock del CHAT, en cambio, transcribe y pega (2026-11-04). `sendAudio` sigue en 1.
    await fireEvent.press(mics[0]!);
    await waitFor(() => expect(transcribir).toHaveBeenCalledTimes(1));
    expect(api.sendAudio).toHaveBeenCalledTimes(1);
  });
});