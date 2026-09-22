import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { IdentidadEntrada } from './IdentidadEntrada';

describe('IdentidadEntrada (BL-X10, animación de entrada sobre el reveal)', () => {
  it('monta las 4 formas y el lockup (children) sin romper', async () => {
    await render(
      <IdentidadEntrada>
        <Text>Odobi</Text>
      </IdentidadEntrada>,
    );
    expect(screen.getByTestId('identidad-entrada')).toBeTruthy();
    expect(screen.getByTestId('identidad-entrada-forma-1')).toBeTruthy();
    expect(screen.getByTestId('identidad-entrada-forma-4')).toBeTruthy();
    expect(screen.getByText('Odobi')).toBeTruthy();
  });
});

describe('IdentidadEntrada — movimiento reducido (H-A3-6, gemelo del test de web)', () => {
  // Override LOCAL: el mock global (`jest.setup.js`) fija `useReducedMotion` en `false` a propósito
  // (esa es la rama que ejercitan los demás tests). Acá se pisa para probar la rama reducida sin
  // tocar el default global.
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('react-native-reanimated', () => {
      const actual = jest.requireActual('react-native-reanimated/mock');
      return { ...actual, useReducedMotion: () => true };
    });
  });

  it('con movimiento reducido, no monta las formas y el lockup queda visible de una', async () => {
    const { IdentidadEntrada: IdentidadEntradaReducida } = require('./IdentidadEntrada');
    await render(
      <IdentidadEntradaReducida>
        <Text>Odobi</Text>
      </IdentidadEntradaReducida>,
    );
    expect(screen.getByTestId('identidad-entrada')).toBeTruthy();
    expect(screen.queryByTestId('identidad-entrada-forma-1')).toBeNull();
    expect(screen.getByText('Odobi')).toBeTruthy();
  });
});
