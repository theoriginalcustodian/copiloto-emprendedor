import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

const mockVoz: {
  fase: 'inactivo' | 'grabando' | 'pausado' | 'listo';
  niveles: number[];
  segundos: number;
  iniciar: jest.Mock;
  pausar: jest.Mock;
  reanudar: jest.Mock;
  detener: jest.Mock;
  descartar: jest.Mock;
  tomar: jest.Mock;
} = {
  fase: 'inactivo',
  niveles: [],
  segundos: 0,
  iniciar: jest.fn(),
  pausar: jest.fn(),
  reanudar: jest.fn(),
  detener: jest.fn(),
  descartar: jest.fn(),
  tomar: jest.fn(),
};

jest.mock('./useVozComando', () => ({ useVozComando: () => mockVoz }));

// Mismo motivo que en `MicFuncion.test`: `ControlesFlotantes` anima con lo que el mock global no exporta.
jest.mock('./ControlesFlotantes', () => {
  const { Pressable, Text } = require('react-native');
  return {
    ControlesFlotantes: ({ alEnviar }: { alEnviar: () => void }) => (
      <Pressable testID="controles-enviar" onPress={alEnviar}>
        <Text>Enviar</Text>
      </Pressable>
    ),
  };
});

// El gesto real lo prueba `BotonVoz.test`; acá importa qué hace el dock con cada callback.
jest.mock('./BotonVoz', () => {
  const { Pressable, Text } = require('react-native');
  return {
    BotonVoz: ({ onIniciar, onSoltarSinFijar, onFijar, onCancelar }: any) => (
      <>
        <Pressable testID="boton-voz" onPress={onIniciar}>
          <Text>mic</Text>
        </Pressable>
        <Pressable testID="mock-soltar" onPress={onSoltarSinFijar}>
          <Text>soltar</Text>
        </Pressable>
        <Pressable testID="mock-fijar" onPress={onFijar}>
          <Text>fijar</Text>
        </Pressable>
        <Pressable testID="mock-cancelar" onPress={onCancelar}>
          <Text>cancelar</Text>
        </Pressable>
      </>
    ),
  };
});

import { ThemeProvider } from '../../theme/ThemeProvider';
import { DockEntrada } from './DockEntrada';

const AUDIO = { datos: 'file:///cache/voz.m4a', nombre: 'voz.m4a', tipo: 'audio/mp4' };

async function montar(props: Partial<React.ComponentProps<typeof DockEntrada>> = {}) {
  const onEnviarTexto = jest.fn();
  const onAudio = jest.fn();
  const arbol = () => (
    <ThemeProvider>
      <DockEntrada onEnviarTexto={onEnviarTexto} onAudio={onAudio} {...props} />
    </ThemeProvider>
  );
  const vista = await render(arbol());
  return { onEnviarTexto, onAudio, volverAPintar: () => vista.rerender(arbol()) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVoz.fase = 'inactivo';
  mockVoz.iniciar.mockResolvedValue(true);
  mockVoz.detener.mockResolvedValue(undefined);
  mockVoz.descartar.mockResolvedValue(undefined);
  mockVoz.tomar.mockReturnValue(AUDIO);
});

describe('DockEntrada -- SM-I2', () => {
  it('reposo: campo + mic, sin barra, sin onda y sin candado', async () => {
    await montar();
    expect(screen.getByTestId('chat-composer')).toBeTruthy();
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
    expect(screen.queryByTestId('voz-barra-sostenida')).toBeNull();
    expect(screen.queryByTestId('onda-flotante')).toBeNull();
    expect(screen.queryByTestId('voz-pistas')).toBeNull();
  });

  it('escribir y enviar va por el mismo dock: el texto llega y el mic vuelve', async () => {
    const { onEnviarTexto } = await montar();
    await fireEvent.changeText(screen.getByTestId('chat-composer'), 'hola');
    await fireEvent.press(screen.getByTestId('chat-enviar'));
    expect(onEnviarTexto).toHaveBeenCalledWith('hola');
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
  });

  it('sostenido: la barra reemplaza al campo, la onda y el candado flotan, y el mic sigue ahí', async () => {
    mockVoz.fase = 'grabando';
    await montar();
    expect(screen.getByTestId('voz-barra-sostenida')).toBeTruthy();
    expect(screen.getByTestId('onda-flotante')).toBeTruthy();
    expect(screen.getByTestId('voz-pistas')).toBeTruthy();
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
    expect(screen.getByTestId('chat-composer-campo', { includeHiddenElements: true })).toHaveStyle({ display: 'none' });
  });

  it('soltar sin fijar corta y entrega el audio UNA vez', async () => {
    mockVoz.fase = 'grabando';
    const { onAudio } = await montar();
    await fireEvent.press(screen.getByTestId('mock-soltar'));
    await waitFor(() => expect(onAudio).toHaveBeenCalledTimes(1));
    expect(mockVoz.detener).toHaveBeenCalledTimes(1);
    expect(onAudio.mock.calls[0][0]).toBe(AUDIO);
    expect(onAudio.mock.calls[0][1]).toBeGreaterThanOrEqual(1);
  });

  it('fijado: los controles ocupan la fila, el composer queda montado y oculto, y sale por Enviar', async () => {
    mockVoz.fase = 'grabando';
    const { onAudio } = await montar();
    await fireEvent.press(screen.getByTestId('mock-fijar'));

    expect(screen.getByTestId('controles-enviar')).toBeTruthy();
    expect(screen.queryByTestId('boton-voz')).toBeNull();
    expect(screen.queryByTestId('voz-barra-sostenida')).toBeNull();
    expect(screen.getByTestId('dock-entrada-composer', { includeHiddenElements: true })).toHaveStyle({ display: 'none' });
    expect(screen.getByTestId('chat-composer', { includeHiddenElements: true })).toBeTruthy();

    await fireEvent.press(screen.getByTestId('controles-enviar'));
    await waitFor(() => expect(onAudio).toHaveBeenCalledTimes(1));
  });

  it('🔴 al volver a inactivo se reabre el fijado: la segunda grabación no arranca ya fijada', async () => {
    mockVoz.fase = 'grabando';
    const { volverAPintar } = await montar();
    await fireEvent.press(screen.getByTestId('mock-fijar'));
    expect(screen.getByTestId('controles-enviar')).toBeTruthy();

    mockVoz.fase = 'inactivo';
    await volverAPintar();
    await waitFor(() => expect(screen.queryByTestId('controles-enviar')).toBeNull());
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
  });

  it('cancelar descarta sin entregar nada', async () => {
    mockVoz.fase = 'grabando';
    const { onAudio } = await montar();
    await fireEvent.press(screen.getByTestId('mock-cancelar'));
    expect(mockVoz.descartar).toHaveBeenCalledTimes(1);
    expect(onAudio).not.toHaveBeenCalled();
  });

  it('sin permiso de micrófono avisa a quien lo pidió: un toque sin efecto se lee como roto', async () => {
    mockVoz.iniciar.mockResolvedValue(false);
    const onSinPermiso = jest.fn();
    await montar({ onSinPermiso });
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(onSinPermiso).toHaveBeenCalledTimes(1));
  });
});
