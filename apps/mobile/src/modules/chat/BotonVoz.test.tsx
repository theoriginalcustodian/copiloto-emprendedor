import { render, screen } from '@testing-library/react-native';
import { useRef } from 'react';
import type { ScrollView } from 'react-native-gesture-handler';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import { ECUALIZADOR_BARRAS } from '../../theme/glass/ecualizadorPalette';
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

describe('BotonVoz -- isotipo ODOBI (ODOBI8 §A, reemplaza el micrófono heredado)', () => {
  it('renderiza los 4 trazos del isotipo, con el stroke-width compensado por logoScale (34/24)', async () => {
    await montar();
    // `react-native-svg` está mockeado a Views que REENVIAN sus props (ver `jest.setup.js`), así que
    // `d`/`strokeWidth` quedan legibles tal cual se los pasamos -- mismo patrón que `GlassIcon.test`.
    const trazo1 = screen.getByTestId('boton-voz-isotipo-trazo-1');
    const trazo2 = screen.getByTestId('boton-voz-isotipo-trazo-2');
    const trazo3 = screen.getByTestId('boton-voz-isotipo-trazo-3');
    const trazo4 = screen.getByTestId('boton-voz-isotipo-trazo-4');

    expect(trazo1.props.d).toBe('M11 3.5a8.5 8.5 0 1 0 0 17');
    expect(trazo2.props.d).toBe('M11 7.5a4.5 4.5 0 1 0 0 9');
    expect(trazo3.props.d).toBe('M16.5 8.8a4.8 4.8 0 0 1 0 6.4');
    expect(trazo4.props.d).toBe('M19.5 6.5a9 9 0 0 1 0 11');

    // 1.7 (stroke-width base del mock, viewBox 24) / (34/24) = 1.2 -- si alguien cambia el tamaño del
    // botón (34) o el viewBox (24) sin actualizar el otro, este número se mueve y el test lo caza.
    expect(trazo1.props.strokeWidth).toBeCloseTo(1.2);
  });

  it('deshabilitado atenúa el isotipo igual que atenuaba el micrófono (opacity 0.45)', async () => {
    await montar({ disabled: true });
    expect(screen.getByTestId('boton-voz-isotipo').props.opacity).toBe(0.45);
  });

  it('sin `disabled`, el isotipo va a opacidad plena', async () => {
    await montar();
    expect(screen.getByTestId('boton-voz-isotipo').props.opacity).toBe(1);
  });
});

describe('BotonVoz -- ecualizador estático (ODOBI8 §B, decorativo, sin reactividad a audio real)', () => {
  it('renderiza exactamente las 7 barras del contrato, con las alturas/colores de ecualizadorPalette', async () => {
    await montar();
    expect(ECUALIZADOR_BARRAS).toHaveLength(7);

    ECUALIZADOR_BARRAS.forEach((barra, indice) => {
      const nodo = screen.getByTestId(`boton-voz-ecualizador-barra-${indice}`);
      const estilo = Array.isArray(nodo.props.style) ? Object.assign({}, ...nodo.props.style) : nodo.props.style;
      expect(estilo.height).toBe(barra.altura);
      expect(estilo.backgroundColor).toBe(barra.color);
    });
  });

  it('es puramente decorativo -- no compite con el gesto del botón que tiene debajo', async () => {
    await montar();
    expect(screen.getByTestId('boton-voz-ecualizador').props.pointerEvents).toBe('none');
  });
});
