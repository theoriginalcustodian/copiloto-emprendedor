import { fireEvent, render, screen } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

/** `MarcoGlass` sólo usa `router.back()` (gesto/"Volver" de cierre). Sin este mock, el import real de
 * `expo-router` arrastra `standard-navigation` (ESM sin transformar bajo Jest) y la suite entera
 * falla al cargar -- mismo precedente que `_staging/documed/apps/mobile/src/rutas/
 * proximamente.test.tsx`. */
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}));

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaAjustes, type AjusteKey } from './PantallaAjustes';

async function envolver(onAjuste?: (key: AjusteKey) => void) {
  return render(
    <ThemeProvider>
      <PantallaAjustes onAjuste={onAjuste} />
    </ThemeProvider>,
  );
}

const TILE_KEYS: AjusteKey[] = [
  'datosPersonales',
  'configuracionSistema',
  'planesDisponibles',
  'planActual',
  'skins',
  'cuenta',
];

describe('PantallaAjustes (grilla de iconos)', () => {
  it('renderiza las 6 entradas del grid', async () => {
    await envolver();
    for (const key of TILE_KEYS) {
      expect(screen.getByTestId(`ajuste-tile-${key}`)).toBeTruthy();
    }
  });

  it('tocar un tile dispara onAjuste con la key correcta', async () => {
    const onAjuste = jest.fn();
    await envolver(onAjuste);

    await fireEvent.press(screen.getByTestId('ajuste-tile-skins'));
    expect(onAjuste).toHaveBeenCalledWith('skins');

    await fireEvent.press(screen.getByTestId('ajuste-tile-cuenta'));
    expect(onAjuste).toHaveBeenCalledWith('cuenta');
  });

  it('las 6 etiquetas visibles son las esperadas', async () => {
    await envolver();
    expect(screen.getByText('Datos personales')).toBeTruthy();
    expect(screen.getByText('Configuración del sistema')).toBeTruthy();
    expect(screen.getByText('Planes disponibles')).toBeTruthy();
    expect(screen.getByText('Plan actual')).toBeTruthy();
    expect(screen.getByText('Skins')).toBeTruthy();
    expect(screen.getByText('Cuenta')).toBeTruthy();
  });

  it('sin onAjuste, tocar un tile no crashea (prop opcional)', async () => {
    await envolver();
    await fireEvent.press(screen.getByTestId('ajuste-tile-planActual'));
    expect(screen.getByTestId('pantalla-ajustes')).toBeTruthy();
  });
});
