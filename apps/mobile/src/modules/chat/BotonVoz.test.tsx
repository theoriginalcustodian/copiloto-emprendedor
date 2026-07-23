import { render, screen } from '@testing-library/react-native';
import { useRef } from 'react';
import type { ScrollView } from 'react-native-gesture-handler';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import { ThemeProvider } from '../../theme/ThemeProvider';
import { BotonVoz, type BotonVozProps } from './BotonVoz';

/**
 * `GestureDetector` está mockeado GLOBALMENTE como passthrough en `jest.setup.js` ("no ejercitamos
 * el gesto -- se valida en el device"): jsdom no dispara `onStart`/`onUpdate`/`onEnd` de
 * `Gesture.LongPress()`/`Gesture.Pan()`, así que este archivo NO puede probar "mantener apretado
 * arranca" / "deslizar fija" / "soltar envía" -- ESO es DoD de device (contrato
 * `dictado-por-voz-sin-glass...` §4, aparato de BACKEND). Lo que sí puede y debe verificar acá:
 * que el componente renderiza con las props nuevas, que el estado `disabled` se refleja en la
 * accesibilidad, y que no reventó armando la composición de gestos (`simultaneousWithExternalGesture`
 * contra un `scrollRef` real).
 */
function ArnesConScrollRef(props: Partial<Omit<BotonVozProps, 'scrollRef'>>) {
  const scrollRef = useRef<ScrollView>(null);
  return (
    <ThemeProvider>
      <BotonVoz
        onIniciar={jest.fn()}
        onSoltarSinFijar={jest.fn()}
        onFijar={jest.fn()}
        {...props}
        scrollRef={scrollRef}
      />
    </ThemeProvider>
  );
}

async function montar(props: Partial<Omit<BotonVozProps, 'scrollRef'>> = {}) {
  await render(<ArnesConScrollRef {...props} />);
}

describe('BotonVoz -- hold-graba/soltar-envía/deslizar-fija (gesto verificado en device, no acá)', () => {
  it('monta sin reventar con la composición de gestos armada contra un scrollRef real', async () => {
    await montar();
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
    expect(screen.getByTestId('boton-voz-nucleo')).toBeTruthy();
  });

  it('deshabilitado (ya hay una captura en curso) lo marca en accessibilityState', async () => {
    await montar({ disabled: true });
    expect(screen.getByTestId('boton-voz').props.accessibilityState?.disabled).toBe(true);
  });

  it('sin `disabled`, accessibilityState no marca deshabilitado', async () => {
    await montar();
    expect(screen.getByTestId('boton-voz').props.accessibilityState?.disabled).toBeFalsy();
  });

  it('🔴 ya NO tiene `onPress` -- el gesto entero es hold/deslizar/soltar, sin toque simple', async () => {
    await montar();
    // Un `Pressable`/`onPress` plano ya no es la interacción: `GestureDetector` (mockeado a
    // passthrough) es lo único que envuelve el núcleo. Si alguien reintrodujera un `onPress` suelto,
    // este test lo cazaría por la ausencia de la prop en el tipo (`BotonVozProps` ya no la declara,
    // ver el error de tsc que este archivo dejó de tener tras el contrato de reescritura).
    expect(screen.getByTestId('boton-voz').props.onPress).toBeUndefined();
  });
});
