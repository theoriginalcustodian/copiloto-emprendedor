/**
 * Override LOCAL de `react-native-reanimated`: el mock GLOBAL (`jest.setup.js`) no exporta
 * `FadeIn`/`FadeOut` — hasta este componente, nada en el árbol los usaba (mismo caso que
 * `SlideInDown`/`SlideOutDown` documentado en `ChatView.test.tsx`). Sin este override, montar el
 * componente revienta con "Cannot read properties of undefined (reading 'duration')".
 */
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const entradaSalida = { duration: () => ({}) };
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (Comp: unknown) => Comp },
    createAnimatedComponent: (Comp: unknown) => Comp,
    FadeIn: entradaSalida,
    FadeOut: entradaSalida,
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { ControlesFlotantes, type ControlesFlotantesProps } from './ControlesFlotantes';

async function montar(props: Partial<ControlesFlotantesProps> & Pick<ControlesFlotantesProps, 'fase'>) {
  const callbacks = { alPausar: jest.fn(), alReanudar: jest.fn(), alEnviar: jest.fn(), alEliminar: jest.fn() };
  await render(
    <ThemeProvider>
      <ControlesFlotantes {...callbacks} {...props} />
    </ThemeProvider>,
  );
  return callbacks;
}

describe('ControlesFlotantes -- Pausar/Reanudar · Enviar · Eliminar, flotantes (sin glass)', () => {
  it('grabando: muestra Pausar y Enviar, no Reanudar', async () => {
    await montar({ fase: 'grabando' });
    expect(screen.getByTestId('voz-pausar')).toBeTruthy();
    expect(screen.getByTestId('voz-enviar')).toBeTruthy();
    expect(screen.queryByTestId('voz-reanudar')).toBeNull();
  });

  it('pausado: muestra Reanudar y Enviar, no Pausar', async () => {
    await montar({ fase: 'pausado' });
    expect(screen.getByTestId('voz-reanudar')).toBeTruthy();
    expect(screen.getByTestId('voz-enviar')).toBeTruthy();
    expect(screen.queryByTestId('voz-pausar')).toBeNull();
  });

  it('listo: sólo Enviar (y Eliminar) -- nada que pausar sobre un grabador ya cortado', async () => {
    await montar({ fase: 'listo' });
    expect(screen.getByTestId('voz-enviar')).toBeTruthy();
    expect(screen.queryByTestId('voz-pausar')).toBeNull();
    expect(screen.queryByTestId('voz-reanudar')).toBeNull();
  });

  it.each(['grabando', 'pausado', 'listo'] as const)(
    'Eliminar SIEMPRE está presente en fase %s -- es la única vía de perder el audio',
    async (fase) => {
      await montar({ fase });
      expect(screen.getByTestId('voz-eliminar')).toBeTruthy();
      // 🔴 El texto es "Eliminar", no "Descartar" -- el contrato del copiloto usa ese vocabulario,
      // distinto del de la grabación clínica que `BotonDescartar` sirve por default.
      expect(screen.getByText('Eliminar')).toBeTruthy();
    },
  );

  it('tocar cada botón dispara su callback', async () => {
    const cb = await montar({ fase: 'grabando' });
    await fireEvent.press(screen.getByTestId('voz-pausar'));
    await fireEvent.press(screen.getByTestId('voz-enviar'));
    await fireEvent.press(screen.getByTestId('voz-eliminar'));
    expect(cb.alPausar).toHaveBeenCalledTimes(1);
    expect(cb.alEnviar).toHaveBeenCalledTimes(1);
    expect(cb.alEliminar).toHaveBeenCalledTimes(1);
  });
});
