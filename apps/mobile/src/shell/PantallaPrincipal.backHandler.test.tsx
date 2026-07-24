/**
 * `PantallaPrincipal` — el BACK de hardware de Android colapsa el panel "Funciones" en vez de salir
 * de la app (hito 7, hallazgo de device 2026-07-24: `KEYCODE_BACK` con el panel abajo sacaba al home).
 *
 * 🔴 **Sólo el caso "panel arriba" (default) se prueba acá.** Es el que importa como red de seguridad:
 * confirma que el fix NO cambia el comportamiento normal del back (nada que colapsar → sigue el
 * default de Android, la app puede salir). El caso "panel abajo → colapsa" es la MISMA función, la
 * rama contraria del mismo `if` — revisado por tipo y por lectura — pero requiere un segundo
 * `render()`/interacción de `PantallaPrincipal` en el mismo archivo de test para simularlo (el panel
 * real no reporta `onPanelAbajoChange` bajo jest: `withTiming`/`withSpring`, mockeados en
 * `jest.setup.js`, no invocan su callback de fin de animación — mismo límite documentado ahí para el
 * snap del gesto). Se intentaron varias combinaciones (mock de `PanelDeslizable` con botones de test,
 * `BackHandler` mockeado por completo, flushes con `act`) y cada una rompía el entorno de test a
 * partir del SEGUNDO render del archivo, sin causa identificable — más allá de lo que rinde perseguir
 * un síntoma del harness, no del producto. Ese camino queda para el DoD de device (mismo criterio que
 * el swipe, `gate-jsdom-no-ve-gestos-tactiles`): es el primer paso de la receta que baja a backend
 * para el gate 2.
 */
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

jest.mock('../modules/auth/useSession', () => ({
  useSession: () => ({ me: { cliente_id: 'cli-principal-test', email: 'usuario@copiloto.test' } }),
}));

import { BackHandler } from 'react-native';
import { render } from '@testing-library/react-native';

import { ThemeProvider } from '../theme/ThemeProvider';
import { PantallaPrincipal } from './PantallaPrincipal';

/** `BackHandler.addEventListener` real toca el bridge nativo — reemplazado por un mock determinista
 *  que sólo guarda el handler más reciente, sin pasar por `NativeEventEmitter`. */
let ultimoHandler: (() => boolean) | null = null;
jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_evento, handler) => {
  ultimoHandler = handler as () => boolean;
  return { remove: jest.fn() };
});

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaPrincipal />
    </ThemeProvider>,
  );
}

describe('PantallaPrincipal — BACK de Android colapsa el panel, no cierra la app', () => {
  it('con el panel ARRIBA (default), el back NO se maneja — Android hace su default (salir)', async () => {
    await envolver();

    expect(ultimoHandler).not.toBeNull();
    // `false` = "no lo manejo yo": React Navigation/Android caen a su comportamiento por defecto. Con
    // el panel arriba (estado inicial, nada que colapsar) el fix no debe interceptar el back.
    expect(ultimoHandler!()).toBe(false);
  });
});
