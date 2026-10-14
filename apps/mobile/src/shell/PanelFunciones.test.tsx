import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// El COMPORTAMIENTO del gesto (drag/snap/toggle) se valida en device, igual que con
// `PanelDeslizable`: acá se cubre que la capa monta, que la base queda montada debajo y que la
// pestaña existe con nombre accesible — que es lo que hace alcanzable el escritorio sin el gesto.

// `jest.setup.js` vuelve `GestureDetector` un passthrough (cablear el gesto real arrastra ~10 internals de
// reanimated). Acá guarda el gesto que RECIBE: el test invoca sus callbacks directo, que es lo que el
// recognizer nativo haría. Lo que NO prueba —que Android llegue a reconocer el Tap— se mide en device.
let gestoPestana: { toGestureArray: () => Array<{ handlerName: string; handlers: Record<string, (...a: unknown[]) => void> }> } | undefined;
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  return {
    ...actual,
    GestureDetector: ({ gesture, children }: { gesture: typeof gestoPestana; children: unknown }) => {
      gestoPestana = gesture;
      return children;
    },
  };
});

import { ThemeProvider } from '../theme/ThemeProvider';
import { PanelFunciones } from './PanelFunciones';

async function envolver() {
  return render(
    <ThemeProvider>
      <PanelFunciones escritorio={<Text>escritorio-arriba</Text>}>
        <Text>base-mi-dia</Text>
      </PanelFunciones>
    </ThemeProvider>,
  );
}

describe('PanelFunciones — el escritorio colgado del borde de arriba (Ola 4)', () => {
  it('monta la base y el escritorio como capas separadas', async () => {
    await envolver();
    expect(screen.getByText('base-mi-dia')).toBeTruthy();
    expect(screen.getByText('escritorio-arriba')).toBeTruthy();
    expect(screen.getByTestId('panel-funciones-capa')).toBeTruthy();
  });

  it('🔴 la pestaña es TOCABLE y dice a dónde lleva — WCAG 2.5.1', async () => {
    // Un panel que sólo se abre arrastrando deja afuera a quien no puede hacer un gesto de
    // trayectoria. La pestaña es la alternativa de un solo puntero, y su nombre dice qué se consigue
    // ("Ver funciones"), no qué es ("pestaña").
    await envolver();
    const pestana = screen.getByTestId('panel-funciones-pestana');
    expect(pestana.props.accessibilityRole).toBe('button');
    expect(pestana.props.accessibilityLabel).toBe('Ver funciones');
    expect(pestana.props.accessibilityState).toEqual({ expanded: false });
  });

  // 🔴 SM-A1 (issue 1010). El toque quieto sobre la pestaña vivía en el `onEnd` de un `Gesture.Pan()`,
  // que en Android sólo se activa al moverse más que el slop: un toque sin temblor lo dejaba en
  // BEGAN → FAILED y su `onEnd` nunca corría, o sea la pestaña «no abría» salvo por azar del dedo.
  // Acá el toque es un `Gesture.Tap()` en `Race` con el Pan; estos dos tests fijan las dos mitades:
  // el Tap abre/cierra, y un Pan que NO se activó (toque quieto) ya no es lo que abre.
  async function medirCapa() {
    await envolver();
    await fireEvent(screen.getByTestId('panel-funciones-capa'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
    });
  }

  function gesto(nombre: string) {
    const g = gestoPestana?.toGestureArray().find((x) => x.handlerName === nombre);
    if (!g) throw new Error(`la pestaña no declara un ${nombre}`);
    return g.handlers;
  }
  const abierto = () => screen.getByTestId('panel-funciones-pestana').props.accessibilityState.expanded;

  it('🔴 el toque quieto es un Tap (no depende de que el Pan se active) y abre el escritorio', async () => {
    await medirCapa();
    expect(abierto()).toBe(false);

    await act(async () => gesto('TapGestureHandler').onEnd({}, true));
    expect(abierto()).toBe(true);
    expect(screen.getByText('Subí para volver a Mi día')).toBeTruthy();
    // El «cerrar» con un 2º toque no se ejercita acá: el stub de `useSharedValue` del setup crea un
    // objeto NUEVO por render, así que tras `setAbierto(true)` el `y`/`alto` del gesto vuelven a su
    // inicial. Alternar en ambos sentidos se mide en device (receta de SM-A1).
  });

  it('un Tap que FALLA (el dedo se movió y ganó el Pan) no alterna', async () => {
    await medirCapa();
    await act(async () => gesto('TapGestureHandler').onEnd({}, false));
    expect(abierto()).toBe(false);
  });

  it('el Pan sigue declarado: arrastrar abre/cierra, y el toque ya no vive SÓLO ahí', async () => {
    await medirCapa();
    const nombres = (gestoPestana?.toGestureArray() ?? []).map((g) => g.handlerName).sort();
    expect(nombres).toEqual(['PanGestureHandler', 'TapGestureHandler']);
  });
});
