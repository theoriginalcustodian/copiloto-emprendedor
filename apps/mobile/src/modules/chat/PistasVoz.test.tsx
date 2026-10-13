import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import { ThemeProvider } from '../../theme/ThemeProvider';
import { BarraSostenida, EstadoEnPausa, PistasGestoVoz } from './PistasVoz';

async function montar(ui: React.ReactElement) {
  await render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('PistasGestoVoz -- la pista del candado (alternativa WCAG 2.5.1 al mantener apretado)', () => {
  it('sin cancelar: muestra la pista del candado, y NO el aviso ni la pista de cancelar (esas viven en la barra)', async () => {
    await montar(<PistasGestoVoz cancelando={false} cerca={false} />);

    expect(screen.getByTestId('voz-pista-candado')).toBeTruthy();
    expect(screen.queryByTestId('voz-pista-cancelar')).toBeNull();
    expect(screen.queryByTestId('voz-cancelar-aviso')).toBeNull();
  });

  it('la pista del candado se nombra para el lector de pantalla (no es un dibujo mudo)', async () => {
    await montar(<PistasGestoVoz cancelando={false} cerca={false} />);

    expect(screen.getByTestId('voz-pista-candado').props.accessibilityLabel).toBe(
      'Deslizá hacia arriba para fijar la grabación',
    );
  });

  it('cancelando: el candado desaparece (el gesto ya eligió el otro eje)', async () => {
    await montar(<PistasGestoVoz cancelando cerca={false} />);

    expect(screen.queryByTestId('voz-pistas')).toBeNull();
    expect(screen.queryByTestId('voz-pista-candado')).toBeNull();
  });

  it('«cerca» tiñe el candado: cambia el fondo respecto del reposo', async () => {
    await montar(<PistasGestoVoz cancelando={false} cerca={false} />);
    const reposo = StyleSheet.flatten(screen.getByTestId('voz-pista-candado').props.style).backgroundColor;
    await screen.unmount();

    await montar(<PistasGestoVoz cancelando={false} cerca />);
    const cerca = StyleSheet.flatten(screen.getByTestId('voz-pista-candado').props.style).backgroundColor;

    expect(reposo).toBeTruthy();
    expect(cerca).toBeTruthy();
    expect(cerca).not.toBe(reposo);
  });
});

describe('BarraSostenida -- la barra del composer mientras se mantiene apretado (G3)', () => {
  it('muestra el reloj `0:07` y la pista «Deslizá para cancelar»', async () => {
    await montar(<BarraSostenida segundos={7} cancelando={false} />);

    expect(screen.getByTestId('voz-reloj')).toHaveTextContent('0:07');
    expect(screen.getByTestId('voz-pista-cancelar')).toBeTruthy();
    expect(screen.getByText('Deslizá para cancelar')).toBeTruthy();
    expect(screen.queryByTestId('voz-cancelar-aviso')).toBeNull();
  });

  it('el reloj es un timer para el lector de pantalla', async () => {
    await montar(<BarraSostenida segundos={0} cancelando={false} />);

    expect(screen.getByTestId('voz-reloj').props.accessibilityRole).toBe('timer');
  });

  it('cancelando: el aviso «Soltá para cancelar» REEMPLAZA a la pista, en la misma barra', async () => {
    await montar(<BarraSostenida segundos={3} cancelando />);

    expect(screen.getByTestId('voz-cancelar-aviso')).toBeTruthy();
    expect(screen.queryByTestId('voz-pista-cancelar')).toBeNull();
    // el reloj sigue: cancelar no es esconder cuánto llevaba
    expect(screen.getByTestId('voz-reloj')).toHaveTextContent('0:03');
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
