import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

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
import { altoPestanaCon, opacidadRotuloAbierto, PanelFunciones } from './PanelFunciones';
import { espacioSuperior } from './PanelDeslizable';

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

  // SM-N23: la pestaña de arriba no puede nacer pegada a la barra de estado (el shade del sistema se come y<~48).
  describe('SM-N23 — aire fijo entre la barra de estado y la pestaña de arriba', () => {
    it('la pestaña mide su contenido MÁS el aire fijo, y ese aire es mayor que cero', () => {
      expect(espacioSuperior(0)).toBeGreaterThan(0);
      expect(altoPestanaCon(0)).toBeGreaterThan(altoPestanaCon(0) - espacioSuperior(0));
      expect(altoPestanaCon(30) - altoPestanaCon(0)).toBe(30);
    });

    it('la pestaña renderizada lleva ese alto y ese padding arriba (no queda a ras)', async () => {
      await envolver();
      const estilo = StyleSheet.flatten(screen.getByTestId('panel-funciones-pestana').props.style) as {
        height: number;
        paddingTop: number;
      };
      expect(estilo.paddingTop).toBe(espacioSuperior(0));
      expect(estilo.height).toBe(altoPestanaCon(0));
      expect(estilo.paddingTop).toBeGreaterThan(0);
    });

    it('la base (Mi día) baja lo mismo que creció la pestaña: su cabecera no queda tapada', async () => {
      await envolver();
      const base = StyleSheet.flatten(screen.getByTestId('panel-funciones-base').props.style) as { paddingTop: number };
      expect(base.paddingTop).toBe(espacioSuperior(0));
    });
  });

  // 🔴 SM-I6. Medido en SM-G4: con el escritorio ya cerrado la pestaña seguía diciendo «Subí para volver a Mi
  // día» hasta +2,9 s, porque el rótulo esperaba un estado de React que se fija al terminar la animación.
  describe('el rótulo lo decide la posición, no el estado de React (SM-I6)', () => {
    it('muestra el de abierto recién pasada la mitad del recorrido, y a los dos extremos uno solo', () => {
      expect(opacidadRotuloAbierto(-756, 756)).toBe(0);
      expect(opacidadRotuloAbierto(-378, 756)).toBeCloseTo(0.5);
      expect(opacidadRotuloAbierto(0, 756)).toBe(1);
    });

    it('sin medir todavía el escritorio está cerrado', () => {
      expect(opacidadRotuloAbierto(0, 0)).toBe(0);
    });

    it('🔴 cada rótulo pinta su mitad: cerrado se ve el de abrir, no el de cerrar', async () => {
      const espia = jest
        .spyOn(Reanimated, 'useAnimatedStyle')
        .mockImplementation(((actualizar: () => object) => actualizar()) as never);
      try {
        await envolver();
        const opacidad = (texto: string) =>
          (StyleSheet.flatten(screen.getByText(texto).props.style) as { opacity?: number }).opacity;
        expect(opacidad('Bajá para tus funciones')).toBe(1);
        expect(opacidad('Subí para volver a Mi día')).toBe(0);
      } finally {
        espia.mockRestore();
      }
    });
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
