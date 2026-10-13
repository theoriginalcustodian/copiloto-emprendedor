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
      <ControlesFlotantes segundos={0} niveles={[]} {...callbacks} {...props} />
    </ThemeProvider>,
  );
  return callbacks;
}

describe('ControlesFlotantes -- tacho · reloj · pausa/play · enviar, flotantes (sin glass)', () => {
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
      // 🔴 Sin texto visible (es el tacho del prototipo): el control se nombra por su etiqueta de
      // accesibilidad, y el vocabulario es "Eliminar", no "Descartar" -- el del contrato del copiloto,
      // distinto del de la grabación clínica.
      expect(screen.getByLabelText('Eliminar')).toBe(screen.getByTestId('voz-eliminar'));
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

describe('ControlesFlotantes -- el reloj `0:07` del prototipo (fila `grabando`, G2)', () => {
  it.each([
    [0, '0:00'],
    [7, '0:07'],
    [75, '1:15'],
  ])('muestra %i s como «%s» (m:ss, sin cero a la izquierda en los minutos)', async (segundos, esperado) => {
    await montar({ fase: 'grabando', segundos });
    expect(screen.getByTestId('voz-reloj')).toHaveTextContent(esperado);
  });

  it('en pausa el reloj sigue visible y congelado en lo capturado', async () => {
    await montar({ fase: 'pausado', segundos: 42 });
    expect(screen.getByTestId('voz-reloj')).toHaveTextContent('0:42');
  });

  it('listo: el reloj queda con la duración final', async () => {
    await montar({ fase: 'listo', segundos: 9 });
    expect(screen.getByTestId('voz-reloj')).toHaveTextContent('0:09');
  });
});

describe('ControlesFlotantes -- íconos con nombre accesible (B5): sin texto visible, la etiqueta es todo', () => {
  it('grabando: Eliminar · Pausar · Enviar', async () => {
    await montar({ fase: 'grabando' });
    expect(screen.getByLabelText('Eliminar')).toBeTruthy();
    expect(screen.getByLabelText('Pausar')).toBe(screen.getByTestId('voz-pausar'));
    expect(screen.getByLabelText('Enviar')).toBe(screen.getByTestId('voz-enviar'));
  });

  it('pausado: el control de pausa pasa a Reanudar', async () => {
    await montar({ fase: 'pausado' });
    expect(screen.getByLabelText('Reanudar')).toBe(screen.getByTestId('voz-reanudar'));
    expect(screen.queryByLabelText('Pausar')).toBeNull();
  });

  it('🔴 no quedan los botones de TEXTO del contrato del 23/07: ninguno pinta «Pausar»/«Enviar»/«Eliminar»', async () => {
    await montar({ fase: 'grabando' });
    expect(screen.queryByText('Pausar')).toBeNull();
    expect(screen.queryByText('Enviar')).toBeNull();
    expect(screen.queryByText('Eliminar')).toBeNull();
  });
});

describe('ControlesFlotantes -- el centro de la barra: onda mientras graba, «En pausa» en texto si no (G3)', () => {
  it('grabando: la onda ocupa el centro y NO dice «En pausa»', async () => {
    await montar({ fase: 'grabando' });
    expect(screen.getByTestId('onda-flotante')).toBeTruthy();
    expect(screen.getByTestId('onda')).toBeTruthy();
    expect(screen.queryByTestId('voz-en-pausa')).toBeNull();
  });

  it('pausado: «En pausa» en TEXTO reemplaza a la onda (no depende de que algo deje de moverse)', async () => {
    await montar({ fase: 'pausado' });
    expect(screen.getByTestId('voz-en-pausa')).toHaveTextContent('En pausa');
    expect(screen.queryByTestId('onda-flotante')).toBeNull();
  });
});
