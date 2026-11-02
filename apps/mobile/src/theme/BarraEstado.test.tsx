import { render } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

// El mock de react-native de jest-expo no llega al `setBarStyle`: lo que pinta se comprueba en device.
const mockStatusBar = jest.fn((_props: { style: string }) => null);
jest.mock('expo-status-bar', () => ({ StatusBar: (props: { style: string }) => mockStatusBar(props) }));

import { BarraEstado } from './BarraEstado';
import { ThemeProvider } from './ThemeProvider';
import type { NombreSkin } from './tokens';

describe('BarraEstado -- SM-N10', () => {
  it.each<[NombreSkin, string]>([
    ['claro', 'dark'],
    ['oscuro', 'light'],
  ])('en la piel %s los íconos son %s, sin mirar el esquema del teléfono', async (skin, style) => {
    await render(
      <ThemeProvider skinForzado={skin}>
        <BarraEstado />
      </ThemeProvider>,
    );

    expect(mockStatusBar).toHaveBeenLastCalledWith({ style });
  });
});
