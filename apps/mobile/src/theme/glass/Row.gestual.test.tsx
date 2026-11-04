/**
 * SM-N12 — la fila que contiene botones de Gesture Handler no puede ser un `Pressable` de RN.
 * En jest el bubbling de `fireEvent.press` frena en el primer handler, así que el bug (dos sistemas de toque
 * disparando el mismo toque) NO es reproducible acá; lo que sí se fija es la causa: qué `Pressable` es la raíz.
 * Para distinguirlos, el `Pressable` de Gesture Handler se reemplaza por un marcador (`testID` + `-gh`).
 * La corrida del toque real vive en device (`adb input motionevent`), ver el cierre de la ficha.
 */
import { render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { ThemeProvider } from '../ThemeProvider';
import { Row } from './Row';

jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  const React = require('react');
  const { View: Vista } = require('react-native');
  return {
    ...actual,
    Pressable: ({ testID, children }: { testID?: string; children?: unknown }) =>
      React.createElement(Vista, { testID: `${testID}-gh` }, children),
  };
});

async function montar(gestual: boolean) {
  await render(
    <ThemeProvider>
      <Row testID="fila" onPress={() => {}} gestual={gestual}>
        <Text>x</Text>
      </Row>
    </ThemeProvider>,
  );
}

describe('Row · SM-N12', () => {
  it('gestual: la raíz es el Pressable de Gesture Handler', async () => {
    await montar(true);
    expect(screen.queryByTestId('fila-gh')).not.toBeNull();
    expect(screen.queryByTestId('fila')).toBeNull();
  });

  it('por defecto (control): sigue siendo el Pressable de RN, nadie más cambia', async () => {
    await montar(false);
    expect(screen.queryByTestId('fila')).not.toBeNull();
    expect(screen.queryByTestId('fila-gh')).toBeNull();
  });
});

void View;
