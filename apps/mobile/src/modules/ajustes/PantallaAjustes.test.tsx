import { fireEvent, render, screen } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

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

  it('las 7 etiquetas visibles son las esperadas', async () => {
    await envolver();
    expect(screen.getByText('Datos personales')).toBeTruthy();
    expect(screen.getByText('Configuración del sistema')).toBeTruthy();
    expect(screen.getByText('Planes disponibles')).toBeTruthy();
    expect(screen.getByText('Plan actual')).toBeTruthy();
    expect(screen.getByText('Skins')).toBeTruthy();
    expect(screen.getByText('Cuenta')).toBeTruthy();
    expect(screen.getByText('Facturación AFIP')).toBeTruthy();
  });

  /**
   * 🔴 **La regresión que este test impide.** La grilla armaba sus filas con dos `slice` fijos —
   * `slice(0,3)` y `slice(3,6)`—, o sea asumía exactamente 6 tiles. Al sumar el séptimo, el tile
   * nuevo caía FUERA de las dos filas y no se renderizaba: sin error, sin warning, sin nada. Un ícono
   * que desaparece en silencio porque un array creció es de los defectos más difíciles de notar en
   * una revisión de código, y trivial de cazar acá.
   *
   * Se afirma sobre el ÚLTIMO tile a propósito: es el único que el bug hacía desaparecer, y también
   * el que lo volvería a sufrir si alguien reintroduce un límite fijo.
   */
  it('el último tile del array se renderiza — la grilla no asume un número fijo de tiles', async () => {
    await envolver();
    expect(screen.getByTestId('ajuste-tile-facturacionAfip')).toBeTruthy();
  });

  it('sin onAjuste, tocar un tile no crashea (prop opcional)', async () => {
    await envolver();
    await fireEvent.press(screen.getByTestId('ajuste-tile-planActual'));
    expect(screen.getByTestId('pantalla-ajustes')).toBeTruthy();
  });
});
