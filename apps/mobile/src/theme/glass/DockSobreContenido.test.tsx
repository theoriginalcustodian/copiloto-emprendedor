import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider } from '../ThemeProvider';
import { ALTO_SOLAPE, DockSobreContenido } from './DockSobreContenido';

describe('DockSobreContenido (SM-P5)', () => {
  it('pinta el MISMO scrim del chat detrás del dock y sube sobre el scroll sin cambiar el alto neto', async () => {
    await render(
      <ThemeProvider>
        <DockSobreContenido testID="dsc">
          <Text>campo</Text>
        </DockSobreContenido>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('dsc-scrim')).toBeTruthy();
    expect(screen.getByText('campo')).toBeTruthy();
    const estilo = StyleFlat(screen.getByTestId('dsc').props.style);
    expect(estilo.marginTop).toBe(-ALTO_SOLAPE);
    expect(estilo.paddingTop).toBe(ALTO_SOLAPE);
    expect(screen.getByTestId('dsc').props.pointerEvents).toBe('box-none');
  });

  it('una vez medido, su huella en el flujo es CERO: el scroll llega al borde y la lista pasa bajo todo el dock', async () => {
    await render(
      <ThemeProvider>
        <DockSobreContenido testID="dsc">
          <Text>campo</Text>
        </DockSobreContenido>
      </ThemeProvider>,
    );
    await fireEvent(screen.getByTestId('dsc'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 130 } } });
    expect(StyleFlat(screen.getByTestId('dsc').props.style).marginTop).toBe(-130);
  });
});

function StyleFlat(s: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(s) ? s.flat(Infinity) : [s]));
}