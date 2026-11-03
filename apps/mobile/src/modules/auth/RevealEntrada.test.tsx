/**
 * SM-N30 — sin altavoz: el audio de la pronunciación está descartado (operador, 2026-11-03); sólo el texto.
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
import { StyleSheet } from 'react-native';

import { TAGLINE_MARCA } from '@copiloto/core';

import { COLOR_PALABRA_MARCA } from '../../theme/identidadPalette';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { RevealEntrada, type VarianteEntrada } from './RevealEntrada';

afterEach(() => {
  mockReducedMotion = false;
});

async function montar(variante: VarianteEntrada = 'splash') {
  return render(
    <ThemeProvider>
      <RevealEntrada
        variante={variante}
        primario="Entrar"
        secundario="Entrar con otra cuenta"
        onPrimario={jest.fn()}
        onSecundario={jest.fn()}
      />
    </ThemeProvider>,
  );
}

describe('RevealEntrada — pronunciación (SM-N30: el audio está descartado)', () => {
  it('queda el TEXTO «se dice o-DO-bi» y NO hay botón de altavoz', async () => {
    await montar('reveal');
    expect(screen.getByTestId('reveal-entrada-pronunciacion')).toBeTruthy();
    expect(screen.queryByTestId('reveal-entrada-pronunciar')).toBeNull();
  });
});

describe('RevealEntrada — wordmark "dobi" letra a letra (BL-X10, port fiel)', () => {
  it('monta el ícono Marca (glifo "O") y las 4 letras del wordmark, sin "Odobi" como bloque único', async () => {
    await montar();
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
    await montar();
    expect(screen.getByTestId('marca')).toBeTruthy();
    expect(screen.getByText('d')).toBeTruthy();
    expect(screen.getByText('o')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.getByText('i')).toBeTruthy();
  });
});

describe('RevealEntrada — lockup del prototipo (TRIAJE15, fila `reveal`/`splash`)', () => {
  it('el wordmark mide 46 dp y es del color de marca, no `acentoTinta` (`.rv-word`, index.html:469)', async () => {
    await montar();
    const estilo = StyleSheet.flatten(screen.getByText('d').props.style);
    expect(estilo.fontSize).toBe(46);
    expect(estilo.color).toBe(COLOR_PALABRA_MARCA);
  });

  it('dibuja el descriptor «Tu copiloto emprendedor» junto al wordmark, más chico que él', async () => {
    await montar();
    const tagline = screen.getByTestId('reveal-entrada-tagline');
    expect(tagline.props.children).toBe(TAGLINE_MARCA);
    expect(TAGLINE_MARCA).toBe('Tu copiloto emprendedor');
    // «Acompaña, no compite en jerarquía» (Brand Book l.69/72): nunca del tamaño del nombre.
    expect(StyleSheet.flatten(tagline.props.style).fontSize).toBeLessThan(46);
  });

  it('con movimiento reducido el descriptor también queda visible', async () => {
    mockReducedMotion = true;
    await montar();
    expect(screen.getByTestId('reveal-entrada-tagline')).toBeTruthy();
  });
});

describe('RevealEntrada — SM-N30: `splash` y `reveal` son dos pantallas, no una fusionada', () => {
  it('reveal: lockup ENTERO «Odobi» (no letra a letra), con «se dice o-DO-bi» y SIN descriptor (`#reveal`, index.html:2553)', async () => {
    await montar('reveal');
    expect(screen.getByTestId('marca')).toBeTruthy();
    expect(screen.getByText('Odobi')).toBeTruthy();
    expect(screen.getByTestId('reveal-entrada-pronunciacion')).toBeTruthy();
    expect(screen.queryByTestId('reveal-entrada-tagline')).toBeNull();
    expect(screen.queryByText('d')).toBeNull();
  });

  it('SM-A2: el reveal dibuja el símbolo DESNUDO a 54, sin badge de acento (`#reveal`, index.html:2547)', async () => {
    await montar('reveal');
    expect(StyleSheet.flatten(screen.getByTestId('marca').props.style).backgroundColor).toBe('transparent');
    expect(screen.getByTestId('marca-isotipo').props.width).toBe(54);
  });

  it('SM-A2 (control): el splash NO se tocó -- su `Marca` conserva el badge, la «O» es otra pantalla (`#splash`, index.html:2447)', async () => {
    await montar('splash');
    expect(StyleSheet.flatten(screen.getByTestId('marca').props.style).backgroundColor).not.toBe('transparent');
  });

  it('reveal: el fondo es el degradé crema del prototipo y ambas puertas se dibujan', async () => {
    await montar('reveal');
    expect(screen.getByTestId('reveal-entrada-fondo')).toBeTruthy();
    expect(screen.getByTestId('reveal-entrada-primario')).toBeTruthy();
    expect(screen.getByTestId('reveal-entrada-secundario')).toBeTruthy();
  });

  it('control: el splash conserva el descriptor y el «dobi» animado, y NO lleva pronunciación ni «Odobi» entero (`#splash`, index.html:2446)', async () => {
    await montar('splash');
    expect(screen.getByTestId('reveal-entrada-tagline')).toBeTruthy();
    expect(screen.getByText('d')).toBeTruthy();
    expect(screen.queryByText('Odobi')).toBeNull();
    expect(screen.queryByTestId('reveal-entrada-pronunciacion')).toBeNull();
    expect(screen.queryByTestId('reveal-entrada-fondo')).toBeNull();
  });
});
