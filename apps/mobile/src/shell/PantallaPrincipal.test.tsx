import { fireEvent, render, screen, within } from '@testing-library/react-native';

// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/**
 * Mock de `expo-router` — esta pantalla ya no monta capas propias (`CapaFuncion`, borrada
 * 2026-07-21): navega. Se mockean las DOS piezas que usa: `router.push` (lo que `empujarUnaVez`
 * termina llamando) y `useFocusEffect`.
 *
 * 🔴 **`useFocusEffect` ejecuta el callback, no lo ignora.** Un `() => {}` haría pasar los tests sin
 * ejercitar `reabrirNavegacion()`, que es justamente lo que este hook existe para correr: sin él la
 * puerta de `empujarUnaVez` queda cerrada para siempre después del primer glass y ningún tile vuelve
 * a abrir nada. Un gate que no ejercita lo que dice cubrir da verde igual cuando el fix se rompe.
 */
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

import { router } from 'expo-router';

import { ThemeProvider } from '../theme/ThemeProvider';
import { PantallaPrincipal } from './PantallaPrincipal';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaPrincipal />
    </ThemeProvider>,
  );
}

describe('PantallaPrincipal (src/shell/PantallaPrincipal.tsx) — el shell real', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('monta el panel, el escritorio de 6 funciones y el chat real', async () => {
    await envolver();

    expect(screen.getByTestId('panel-principal')).toBeTruthy();
    expect(screen.getByTestId('tile-facturacion')).toBeTruthy();
    expect(screen.getByTestId('chat-view')).toBeTruthy();
  });

  it('el chat vive en la Capa 1 del panel, dentro del cristal — no como pantalla aparte', async () => {
    await envolver();

    const panel = screen.getByTestId('panel-principal');
    // `within` en vez de un getBy suelto: que `chat-view` exista en algún lado del árbol no prueba
    // que esté DENTRO del panel, que es el contrato que se quiere fijar.
    expect(within(panel).getByTestId('chat-view')).toBeTruthy();
  });

  /**
   * 🔴 **El mecanismo cambió de raíz (2026-07-21).** Hasta acá esta pantalla montaba `CapaFuncion` —
   * una capa `absoluteFill` propia de este repo que en device se comía los toques (ningún tile
   * respondía). La corrección fue clonar el mecanismo real de documed: cada función es una RUTA de
   * expo-router (`transparentModal`, ver `app/_layout.tsx`) con su propio `MarcoGlass`. Esta pantalla
   * ya no guarda ningún estado de "función activa" ni monta nada condicionalmente — sólo navega. Ver
   * `coordinacion/2026-07-20_handoff_fixes-gestos-glass-mobile.md`.
   *
   * `await fireEvent.press(...)`: RNTL 14 necesita el await para que el `act()` interno flushee
   * cualquier efecto pendiente antes de la siguiente aserción — mismo criterio que `shell.test.tsx`.
   */
  it.each([
    ['apps', '/apps'],
    ['ajustes', '/ajustes'],
    ['recientes', '/recientes'],
    ['redes', '/redes'],
    ['metricas', '/metricas'],
    ['facturacion', '/facturacion'],
  ])('tocar el tile %s navega a %s — no monta ninguna capa propia', async (key, ruta) => {
    await envolver();

    await fireEvent.press(screen.getByTestId(`tile-${key}`));

    expect(router.push).toHaveBeenCalledWith(ruta);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  /**
   * 🔴 **La regresión que este test existe para impedir, medida en device el 2026-07-21.**
   *
   * Con `router.push` directo, dos toques rápidos sobre un tile abrían DOS glass apilados de la misma
   * función. Un solo "Volver" cerraba uno y el otro quedaba arriba —`transparentModal`, o sea
   * transparente— dejando ver el escritorio detrás mientras se tragaba todos los toques. El operador
   * lo reportó como *"cuando ingreso a apps y luego salgo, al volver a la pantalla principal se queda
   * bloqueada y no responde"*, y durante horas se buscó la causa en el gesto del panel: el
   * instrumento descartó esa pista (el `onBegin` llegaba con `recorrido` bien medido).
   *
   * La invariante no es "no dos seguidos" sino "no otro MIENTRAS haya uno abierto" — por eso el lock
   * es por FOCO y no por tiempo. Ver `empujarUnaVez.ts`, clonado de documed.
   *
   * Se prueba con DOS tiles distintos a propósito: un lock que sólo mirara la última ruta dejaría
   * pasar este caso, que es el que apila dos glass DIFERENTES.
   */
  it('un solo glass a la vez: el segundo tile no navega hasta volver al escritorio', async () => {
    await envolver();

    await fireEvent.press(screen.getByTestId('tile-ajustes'));
    await fireEvent.press(screen.getByTestId('tile-metricas'));

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/ajustes');
  });

  it('doble toque rápido sobre el MISMO tile abre un solo glass', async () => {
    await envolver();

    await fireEvent.press(screen.getByTestId('tile-apps'));
    await fireEvent.press(screen.getByTestId('tile-apps'));

    expect(router.push).toHaveBeenCalledTimes(1);
  });

  /**
   * La otra mitad de la invariante: la puerta tiene que REABRIRSE al recuperar el foco, o después del
   * primer glass la app quedaría muda para siempre — un fix peor que el defecto. Remontar la pantalla
   * dispara `useFocusEffect`, que es lo que ocurre al volver de un glass.
   */
  it('al recuperar el foco la puerta se reabre y el siguiente tile vuelve a navegar', async () => {
    const { unmount } = await envolver();
    await fireEvent.press(screen.getByTestId('tile-ajustes'));
    unmount();

    await envolver();
    await fireEvent.press(screen.getByTestId('tile-metricas'));

    expect(router.push).toHaveBeenNthCalledWith(1, '/ajustes');
    expect(router.push).toHaveBeenNthCalledWith(2, '/metricas');
  });
});
