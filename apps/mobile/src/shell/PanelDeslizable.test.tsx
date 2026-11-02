import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { useRef } from 'react';
import { Text } from 'react-native';

// Jest (jest-expo) — render de RNTL 14 es ASYNC (await). El COMPORTAMIENTO del gesto (drag/snap/
// toggle) se valida en el device (Fase 6) + lo validó el spike de Fase 1; en jest cubrimos que las
// dos capas + el handle montan sin crashear (reanimated/gesture-handler no revientan bajo el harness).

import { ThemeProvider } from '../theme/ThemeProvider';
import { PanelDeslizable, translacionPanel } from './PanelDeslizable';

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
    expect(screen.getByTestId('panel-hint').props.children).toBe('Escribile a Odobi');
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
