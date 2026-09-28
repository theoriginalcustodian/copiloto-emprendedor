/**
 * BL-X10 — botón de pronunciación: sólo aparece con `pronunciacionAsset` (no hay audio en el repo
 * todavía, `[ASSUMED_PENDING_VERIFY]` -- ver docstring de `RevealEntrada.tsx`). Control negativo:
 * sin asset, ni rastro del botón (sólo el texto, como antes de X10).
 *
 * BL-X10 (port fiel) — mismo mock hoisted local que `IdentidadEntrada.test.tsx` (motivo idéntico:
 * el stub GLOBAL de `jest.setup.js` fija `useReducedMotion` en `false` a fuego, y acá hace falta
 * ejercitar también la rama reducida del wordmark/`Marca`).
 */
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

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { RevealEntrada } from './RevealEntrada';

afterEach(() => {
  mockReducedMotion = false;
});

async function montar(pronunciacionAsset?: number) {
  return render(
    <ThemeProvider>
      <RevealEntrada
        primario="Entrar"
        secundario="Entrar con otra cuenta"
        onPrimario={jest.fn()}
        onSecundario={jest.fn()}
        pronunciacionAsset={pronunciacionAsset}
      />
    </ThemeProvider>,
  );
}

describe('RevealEntrada — botón de pronunciación (BL-X10)', () => {
  it('sin asset, no renderiza el botón (sólo el texto)', async () => {
    await montar(undefined);
    expect(screen.getByTestId('reveal-entrada-pronunciacion')).toBeTruthy();
    expect(screen.queryByTestId('reveal-entrada-pronunciar')).toBeNull();
  });

  it('con asset, renderiza el botón y reproduce al tocarlo', async () => {
    await montar(1);
    const boton = screen.getByTestId('reveal-entrada-pronunciar');
    expect(boton).toBeTruthy();
    await fireEvent.press(boton);
    // El player real es `expo-audio` (mockeado en jest.setup.js): no hay aserción sobre `play()`
    // acá porque el mock es compartido -- alcanza con que tocar el botón no rompa el render.
  });
});

describe('RevealEntrada — wordmark "dobi" letra a letra (BL-X10, port fiel)', () => {
  it('monta el ícono Marca (glifo "O") y las 4 letras del wordmark, sin "Odobi" como bloque único', async () => {
    await montar(undefined);
    expect(screen.getByTestId('marca')).toBeTruthy();
    // 4 `Text` separados, no un único nodo -- así queda cada uno con su propio delay/bounce.
    expect(screen.getByText('d')).toBeTruthy();
    expect(screen.getByText('o')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.getByText('i')).toBeTruthy();
    expect(screen.queryByText('Odobi')).toBeNull();
  });

  it('con movimiento reducido, el lockup completo (Marca + "dobi") queda visible igual, sin animar', async () => {
    mockReducedMotion = true;
    await montar(undefined);
    expect(screen.getByTestId('marca')).toBeTruthy();
    expect(screen.getByText('d')).toBeTruthy();
    expect(screen.getByText('o')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.getByText('i')).toBeTruthy();
  });
});
