import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider } from '../ThemeProvider';
import { MarcoGlass } from './MarcoGlass';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

/**
 * `MarcoGlass` no tenía test propio — se ejercitaba sólo indirecto vía las 9 pantallas que lo
 * consumen (todas siguen 573/573 verdes tras este cambio, ver el suite completo). Este archivo fija
 * la estructura del `hallazgo_..._el-repro-no-cuadra` (freeze del dismiss): la zona de arrastre
 * creció de sólo el handle a handle+identidad, "Volver" quedó afuera del `GestureDetector` — lo que
 * se puede probar en jsdom es que "Volver" SIGUE funcionando igual (mismo testID, mismo onPress,
 * misma etiqueta), no el gesto en sí (`GestureDetector` es passthrough mockeado, `jest.setup.js`).
 */
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { back: jest.fn() },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

async function montar() {
  return render(
    <ThemeProvider>
      <MarcoGlass titulo="Ingresos" icono="ingreso" testID="marco-test">
        <Text>contenido</Text>
      </MarcoGlass>
    </ThemeProvider>,
  );
}

describe('MarcoGlass -- la zona de arrastre creció (handle+identidad), "Volver" quedó intacto', () => {
  it('renderiza el handle, el título y "Volver", sin reventar', async () => {
    await montar();
    expect(screen.getByTestId('glass-handle')).toBeTruthy();
    expect(screen.getByTestId('glass-titulo')).toBeTruthy();
    expect(screen.getByText('Ingresos')).toBeTruthy();
    expect(screen.getByTestId('glass-volver')).toBeTruthy();
  });

  it('🔴 "Volver" sigue funcionando -- tocarlo llama router.back(), igual que antes', async () => {
    const { router } = require('expo-router');
    await montar();

    await fireEvent.press(screen.getByTestId('glass-volver'));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('la nueva zona de arrastre (ícono+título) existe con su propio testID', async () => {
    await montar();
    expect(screen.getByTestId('glass-zona-arrastre-identidad')).toBeTruthy();
  });

  it('el contenido (children) sigue montando debajo del encabezado', async () => {
    await montar();
    expect(screen.getByText('contenido')).toBeTruthy();
  });
});
