// Override LOCAL del mock global (`jest.setup.js` fija `useReducedMotion` en `false` a propósito,
// esa es la rama que ejercita el primer describe): acá se necesita también la rama reducida, en el
// MISMO archivo. `jest.resetModules()` + re-`require` (probado, revienta con "Cannot read
// properties of null (reading 'useEffect')" -- duplica la instancia de React que ve
// `@testing-library/react-native` de la que ve el componente re-importado) y
// `jest.requireActual('react-native-reanimated/mock')` (probado, revienta con "createSerializable
// is not a function" -- ese mock oficial re-importa el índice real de reanimated y dispara el
// install nativo, exactamente lo que el stub de `jest.setup.js` documenta evitar, líneas 9-12 de
// ese archivo) NO sirven. Se usa en cambio un único mock hoisted (mismo shape que el stub global,
// sólo lo que este componente importa) con una bandera mutable -- el prefijo `mock` es el único
// permitido por `babel-plugin-jest-hoist` para referenciar una variable de módulo dentro del
// factory de `jest.mock`.
let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: { View, Text, createAnimatedComponent: (Comp: unknown) => Comp },
    createAnimatedComponent: (Comp: unknown) => Comp,
    useSharedValue: (inicial: unknown) => ({ value: inicial }),
    useAnimatedStyle: () => ({}),
    withTiming: (destino: unknown) => destino,
    withDelay: (_delay: number, animacion: unknown) => animacion,
    useReducedMotion: () => mockReducedMotion,
    Easing: { bezier: () => () => 0, out: (fn: unknown) => fn, ease: () => 0 },
  };
});

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { IdentidadEntrada } from './IdentidadEntrada';

afterEach(() => {
  mockReducedMotion = false;
});

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
  it('con movimiento reducido, no monta las formas y el lockup queda visible de una', async () => {
    mockReducedMotion = true;
    await render(
      <IdentidadEntrada>
        <Text>Odobi</Text>
      </IdentidadEntrada>,
    );
    expect(screen.getByTestId('identidad-entrada')).toBeTruthy();
    expect(screen.queryByTestId('identidad-entrada-forma-1')).toBeNull();
    expect(screen.getByText('Odobi')).toBeTruthy();
  });
});
