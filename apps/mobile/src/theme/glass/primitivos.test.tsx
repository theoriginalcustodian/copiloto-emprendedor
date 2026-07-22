import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// Jest (jest-expo) — describe/it/expect son globales. En este repo `render` de RNTL 14 es ASYNC
// (devuelve Promise): hay que `await`-earlo, igual que `PantallaAjustes.test.tsx`/`PantallaApps.test.tsx`.

import { ThemeProvider } from '../ThemeProvider';
import { CristalVidrio, type NivelCristal } from './CristalVidrio';
import { FondoIluminado } from './FondoIluminado';
import { Orbe } from './Orbe';
import { Row } from './Row';
import { Tile } from './Tile';

async function envolver(nodo: React.ReactElement) {
  return render(<ThemeProvider>{nodo}</ThemeProvider>);
}

describe('primitivos glass (Tarea 2.3)', () => {
  const niveles: NivelCristal[] = ['conversacion', 'grabacion', 'informe', 'menu'];

  it.each(niveles)('CristalVidrio renderiza el nivel "%s" sin crashear y con sus children', async (nivel) => {
    await envolver(
      <CristalVidrio nivel={nivel} testID={`cristal-${nivel}`}>
        <Text>contenido</Text>
      </CristalVidrio>,
    );
    expect(screen.getByTestId(`cristal-${nivel}`)).toBeTruthy();
    expect(screen.getByText('contenido')).toBeTruthy();
  });

  it('Tile dispara onPress al tocarlo', async () => {
    const onPress = jest.fn();
    await envolver(
      <Tile onPress={onPress} testID="tile" accessibilityLabel="Historias">
        <Text>Historias</Text>
      </Tile>,
    );
    fireEvent.press(screen.getByTestId('tile'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Row dispara onPress al tocarla', async () => {
    const onPress = jest.fn();
    await envolver(
      <Row onPress={onPress} testID="row">
        <Text>Evolución post-op</Text>
      </Row>,
    );
    fireEvent.press(screen.getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Orbe renderiza (luz difusa, no intercepta toques)', async () => {
    await envolver(<Orbe testID="orbe" size={200} />);
    expect(screen.getByTestId('orbe')).toBeTruthy();
  });

  it('FondoIluminado renderiza las zonas de luz del skin sin crashear', async () => {
    await envolver(<FondoIluminado testID="fondo-luz" />);
    expect(screen.getByTestId('fondo-luz')).toBeTruthy();
  });
});
