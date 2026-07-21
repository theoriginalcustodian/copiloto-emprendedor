import { fireEvent, render, screen, within } from '@testing-library/react-native';

// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/**
 * Mock de `expo-router` — esta pantalla ya no monta capas propias (`CapaFuncion`, borrada
 * 2026-07-21): navega con `router.push`. Sólo se mockea `router`, no todo el módulo — nada más de
 * `expo-router` corre en este árbol (`PanelDeslizable`/`EscritorioFunciones`/`ChatView` no lo tocan).
 */
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

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

  it('tocar dos tiles distintos navega dos veces, cada una a su propia ruta', async () => {
    await envolver();

    await fireEvent.press(screen.getByTestId('tile-ajustes'));
    await fireEvent.press(screen.getByTestId('tile-metricas'));

    expect(router.push).toHaveBeenNthCalledWith(1, '/ajustes');
    expect(router.push).toHaveBeenNthCalledWith(2, '/metricas');
  });
});
