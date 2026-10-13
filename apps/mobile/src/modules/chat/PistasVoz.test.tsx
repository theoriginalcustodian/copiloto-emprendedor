import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import { ThemeProvider } from '../../theme/ThemeProvider';
import { EstadoEnPausa, PistasGestoVoz } from './PistasVoz';

async function montar(ui: React.ReactElement) {
  await render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('PistasGestoVoz -- el usuario no tiene que adivinar el gesto (WCAG 2.5.1)', () => {
  it('sin cancelar: «Deslizá para cancelar» + la pista del candado, y NO el aviso de cancelación', async () => {
    await montar(<PistasGestoVoz cancelando={false} cerca={false} segundos={0} />);

    expect(screen.getByTestId('voz-pista-cancelar')).toBeTruthy();
    expect(screen.getByText('Deslizá para cancelar')).toBeTruthy();
    expect(screen.getByTestId('voz-pista-candado')).toBeTruthy();
    expect(screen.queryByTestId('voz-cancelar-aviso')).toBeNull();
  });

  it('la pista del candado se nombra para el lector de pantalla (no es un dibujo mudo)', async () => {
    await montar(<PistasGestoVoz cancelando={false} cerca={false} segundos={0} />);

    expect(screen.getByTestId('voz-pista-candado').props.accessibilityLabel).toBe(
      'Deslizá hacia arriba para fijar la grabación',
    );
  });

  it('el reloj `0:07` del prototipo va junto a la pista: quien mantiene apretado ve cuánto lleva', async () => {
    await montar(<PistasGestoVoz cancelando={false} cerca={false} segundos={7} />);

    expect(screen.getByTestId('voz-reloj')).toHaveTextContent('0:07');
  });

  it('cancelando: el aviso «Soltá para cancelar» REEMPLAZA a las pistas', async () => {
    await montar(<PistasGestoVoz cancelando cerca={false} segundos={0} />);

    expect(screen.getByTestId('voz-cancelar-aviso')).toBeTruthy();
    expect(screen.queryByTestId('voz-pistas')).toBeNull();
    expect(screen.queryByTestId('voz-pista-candado')).toBeNull();
  });

  it('«cerca» tiñe el candado: cambia el fondo respecto del reposo', async () => {
    await montar(<PistasGestoVoz cancelando={false} cerca={false} segundos={0} />);
    const reposo = StyleSheet.flatten(screen.getByTestId('voz-pista-candado').props.style).backgroundColor;
    await screen.unmount();

    await montar(<PistasGestoVoz cancelando={false} cerca segundos={0} />);
    const cerca = StyleSheet.flatten(screen.getByTestId('voz-pista-candado').props.style).backgroundColor;

    expect(reposo).toBeTruthy();
    expect(cerca).toBeTruthy();
    expect(cerca).not.toBe(reposo);
  });
});

describe('EstadoEnPausa -- el estado no depende sólo de que algo deje de moverse (WCAG 1.4.1)', () => {
  it('dice «En pausa» en texto y lo anuncia como región viva', async () => {
    await montar(<EstadoEnPausa />);

    const texto = screen.getByTestId('voz-en-pausa');
    expect(texto).toHaveTextContent('En pausa');
    expect(texto.props.accessibilityLiveRegion).toBe('polite');
  });
});
