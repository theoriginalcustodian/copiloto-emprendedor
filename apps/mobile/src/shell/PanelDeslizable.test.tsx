import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

// Jest (jest-expo) — render de RNTL 14 es ASYNC (await). El COMPORTAMIENTO del gesto (drag/snap/
// toggle) se valida en el device (Fase 6) + lo validó el spike de Fase 1; en jest cubrimos que las
// dos capas + el handle montan sin crashear (reanimated/gesture-handler no revientan bajo el harness).

import { ThemeProvider } from '../theme/ThemeProvider';
import {
  ALTO_HANDLE,
  espacioSuperior,
  MARGEN_TIRADOR,
  opacidadRotuloAbajo,
  PanelDeslizable,
  recorridoDesdeAlto,
  translacionPanel,
} from './PanelDeslizable';

describe('SM-N23 — margen fijo del tirador de arriba', () => {
  const INSET = 24;
  const ALTO = 853;

  it('hay margen bajo la barra de estado (antes era 0) y el spacer lo incluye', () => {
    expect(MARGEN_TIRADOR).toBeGreaterThan(0);
    expect(espacioSuperior(INSET)).toBe(INSET + MARGEN_TIRADOR);
  });

  it('el recorrido se acorta EXACTAMENTE en el margen respecto de la geometría anterior', () => {
    const anterior = ALTO - ALTO_HANDLE - INSET;
    expect(recorridoDesdeAlto(ALTO, INSET)).toBe(anterior - MARGEN_TIRADOR);
  });

  it('el handle de abajo cae donde siempre: recorrido + spacer = alto - ALTO_HANDLE', () => {
    expect(recorridoDesdeAlto(ALTO, INSET) + espacioSuperior(INSET)).toBe(ALTO - ALTO_HANDLE);
  });

  it('con el alto sin medir no inventa un recorrido negativo', () => {
    expect(recorridoDesdeAlto(0, INSET)).toBe(0);
  });
});

async function envolver(props: Partial<React.ComponentProps<typeof PanelDeslizable>> = {}) {
  return render(
    <ThemeProvider>
      <PanelDeslizable testID="panel" fondo={<Text>escritorio-fondo</Text>} {...props}>
        <Text>conversacion-frente</Text>
      </PanelDeslizable>
    </ThemeProvider>,
  );
}

describe('PanelDeslizable (Tarea 2.4)', () => {
  it('monta las dos capas (fondo Capa 0 + children Capa 1) y el grab-handle', async () => {
    await envolver();
    expect(screen.getByTestId('panel')).toBeTruthy();
    expect(screen.getByText('escritorio-fondo')).toBeTruthy();
    expect(screen.getByText('conversacion-frente')).toBeTruthy();
    expect(screen.getByTestId('panel-handle')).toBeTruthy();
  });

  it('el hint con el chat arriba es el del prototipo (`index.html:1873`) — el panel nace arriba y abajo está la base', async () => {
    await envolver();
    expect(screen.getByTestId('panel-hint').props.children).toBe('Bajá para volver a Mi día');
  });

  it('🔴 con `arrancaAbajo` el hint es el del borde inferior: la app abre en la base, no en el chat', async () => {
    // El texto ES la diferencia visible del cambio de aterrizaje (Ola 4): con la conversación abajo,
    // la tira que asoma invita a hablarle, no a "subir la conversación" — que nombraba el mecanismo
    // en vez de lo que se consigue.
    await envolver({ arrancaAbajo: true, hintAbajo: 'Escribile a Odobi' });
    expect(screen.getByText('Escribile a Odobi').props.accessibilityElementsHidden).toBe(false);
    expect(screen.getByTestId('panel-hint', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  });

  // 🔴 SM-I6. El rótulo se decidía con un estado de React que se fija al TERMINAR la animación y que además
  // tiene que cruzar al hilo de JS: SM-G4 midió el chat en su lugar a +0,1 s y el rótulo viejo hasta +2,6 s.
  describe('el rótulo lo decide la posición, no el estado de React (SM-I6)', () => {
    it('muestra el de abajo recién pasada la mitad del recorrido, y a los dos extremos uno solo', () => {
      expect(opacidadRotuloAbajo(0, 800)).toBe(0);
      expect(opacidadRotuloAbajo(320, 800)).toBe(0);
      expect(opacidadRotuloAbajo(400, 800)).toBeCloseTo(0.5);
      expect(opacidadRotuloAbajo(480, 800)).toBeCloseTo(1);
      expect(opacidadRotuloAbajo(800, 800)).toBe(1);
    });

    it('sin medir todavía no hay «abajo»: el panel está arriba', () => {
      expect(opacidadRotuloAbajo(0, 0)).toBe(0);
    });

    it('🔴 con el estado diciendo «abajo» y el panel todavía arriba, se ve el rótulo de arriba', async () => {
      // `arrancaAbajo` deja el estado en «abajo» desde el primer render, y el stub deja `panelY` en 0: es
      // justo el desacuerdo entre los dos. Si el rótulo volviera a leer el estado, acá se vería el de abajo.
      const espia = jest
        .spyOn(Reanimated, 'useAnimatedStyle')
        .mockImplementation(((actualizar: () => object) => actualizar()) as never);
      try {
        await envolver({ arrancaAbajo: true, hintAbajo: 'Escribile a Odobi' });
        const opacidad = (el: { props: Record<string, unknown> }) =>
          (StyleSheet.flatten(el.props.style as never) as { opacity?: number }).opacity;
        expect(opacidad(screen.getByTestId('panel-hint', { includeHiddenElements: true }))).toBe(1);
        expect(opacidad(screen.getByText('Escribile a Odobi'))).toBe(0);
      } finally {
        espia.mockRestore();
      }
    });
  });
});

// `senalBajar` — la gemela de `senalSubir` (hitl a: «Volver al tablero»). Jest mockea `withTiming` (no
// invoca su callback de fin y no mueve nada), así que lo que se ejercita es el WIRING: que la señal
// dispare la bajada y la AVISE por la misma puerta que el gesto (`alBajar`, regla A: el escritorio se
// cierra al bajar el chat). Que el panel BAJE de verdad es DoD de device, como el resto del gesto.
describe('PanelDeslizable — senalBajar', () => {
  // El stub global de `useSharedValue` (`jest.setup.js`) devuelve un objeto NUEVO por render: `recorrido`
  // volvería a «sin medir» en cada re-render y el test no vería nunca un panel ya medido. Acá se le da la
  // estabilidad que el hook real tiene (un `ref`), sólo para este bloque.
  beforeEach(() => {
    const Reanimated = require('react-native-reanimated');
    jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((inicial: unknown) => useRef({ value: inicial }).current);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const MEDIDA = { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } };

  function arbol(props: Partial<React.ComponentProps<typeof PanelDeslizable>>) {
    return (
      <ThemeProvider>
        <PanelDeslizable testID="panel" fondo={<Text>escritorio-fondo</Text>} {...props}>
          <Text>conversacion-frente</Text>
        </PanelDeslizable>
      </ThemeProvider>
    );
  }

  it('un cambio de la señal avisa la bajada UNA vez; el primer render no cuenta', async () => {
    const alBajar = jest.fn();
    const vista = await render(arbol({ alBajar, senalBajar: 0 }));
    await fireEvent(screen.getByTestId('panel'), 'layout', MEDIDA);
    expect(alBajar).not.toHaveBeenCalled();

    await vista.rerender(arbol({ alBajar, senalBajar: 1 }));
    expect(alBajar).toHaveBeenCalledTimes(1);

    // Mismo valor en otro render: ya fue atendida, no vuelve a bajar.
    await vista.rerender(arbol({ alBajar, senalBajar: 1 }));
    expect(alBajar).toHaveBeenCalledTimes(1);
  });

  it('🔴 sin recorrido medido no inventa un destino: no baja ni avisa', async () => {
    const alBajar = jest.fn();
    const vista = await render(arbol({ alBajar, senalBajar: 0 }));
    // sin `layout`: `recorrido` sigue en «todavía no medí».
    await vista.rerender(arbol({ alBajar, senalBajar: 1 }));
    expect(alBajar).not.toHaveBeenCalled();
  });
});

// 🔴 El suite `PanelDeslizable — traba por captura viva` de DocuMed (props `bloqueado`/
// `hintBloqueado`) se retiró junto con esos props — ver el docstring de `PanelDeslizable.tsx` (decisión
// D6). No queda nada que ejercitar acá: el copiloto no tiene una grabación viva que se pueda "dejar
// corriendo sin darse cuenta" al deslizar el panel.

/**
 * SM-I4 (D1): con el escritorio abierto la tira del chat sale por abajo y queda una sola solapa. La cuenta es
 * una función pura porque el mock de Reanimated no calcula estilos animados.
 */
describe('translacionPanel — la tira se va sólo con el chat abajo', () => {
  const recorrido = 700;
  const altoTira = 80;

  it('con el escritorio cerrado no cambia nada', () => {
    expect(translacionPanel(0, recorrido, 0, altoTira)).toBe(0);
    expect(translacionPanel(350, recorrido, 0, altoTira)).toBe(350);
    expect(translacionPanel(recorrido, recorrido, 0, altoTira)).toBe(recorrido);
  });

  it('con el escritorio abierto y el chat abajo, la tira entera queda fuera de pantalla', () => {
    expect(translacionPanel(recorrido, recorrido, 1, altoTira)).toBe(recorrido + altoTira);
  });

  it('🔴 con el chat ARRIBA el escritorio abierto no lo corre: si no, el chat quedaría desplazado', () => {
    expect(translacionPanel(0, recorrido, 1, altoTira)).toBe(0);
  });

  it('a mitad de camino se va en proporción', () => {
    expect(translacionPanel(recorrido, recorrido, 0.5, altoTira)).toBe(recorrido + altoTira / 2);
  });

  it('sin recorrido medido no inventa un destino', () => {
    expect(translacionPanel(0, 0, 1, altoTira)).toBe(0);
  });
});

describe('SM-N22 — el asa queda ENCIMA del campo (pieAbajo)', () => {
  const INSET = 24;
  const ALTO = 853;
  const PIE = 80;

  it('el recorrido se acorta en el alto del pie: el asa sube justo esa cantidad y el campo cabe bajo ella', () => {
    expect(recorridoDesdeAlto(ALTO, INSET, PIE)).toBe(recorridoDesdeAlto(ALTO, INSET) - PIE);
    // asa (arriba del pie) + pie = el borde inferior de la pantalla
    expect(recorridoDesdeAlto(ALTO, INSET, PIE) + espacioSuperior(INSET) + ALTO_HANDLE + PIE).toBe(ALTO);
  });

  it('sin pie el recorrido NO cambia (default 0: el resto de los montajes no se mueve)', () => {
    expect(recorridoDesdeAlto(ALTO, INSET, 0)).toBe(recorridoDesdeAlto(ALTO, INSET));
  });

  it('el pie se monta DENTRO del panel y DESPUÉS del asa (el campo queda debajo de la barrita, como el mapa)', async () => {
    await render(
      <ThemeProvider>
        <PanelDeslizable fondo={<Text>fondo</Text>} pieAbajo={<Text testID="campo-pie">Escribí</Text>} altoPieAbajo={PIE}>
          <Text>chat</Text>
        </PanelDeslizable>
      </ThemeProvider>,
    );
    const pie = screen.getByTestId('panel-pie-abajo');
    expect(screen.getByTestId('campo-pie')).toBeTruthy();
    const e = StyleSheet.flatten(pie.props.style);
    expect(e.position).toBe('absolute');
    expect(e.height).toBe(PIE);
    // `top` = spacer + handle: arranca justo bajo el asa, nunca por encima de ella
    expect(e.top).toBeGreaterThanOrEqual(ALTO_HANDLE);
  });

  it('control negativo: sin `pieAbajo` no se monta nada extra', async () => {
    await render(
      <ThemeProvider>
        <PanelDeslizable fondo={<Text>fondo</Text>}>
          <Text>chat</Text>
        </PanelDeslizable>
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('panel-pie-abajo')).toBeNull();
  });
});
