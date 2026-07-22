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

/** Las 6 entradas EXPLÍCITAS y en orden, no `TILES_AJUSTES.length`: sacar o agregar una obliga a
 *  nombrarla acá. Quedaron 6 tras absorber los andamiajes duplicados (2026-07-22). */
const TILE_KEYS: AjusteKey[] = [
  'perfilNegocio',
  'facturacionAfip',
  'apps',
  'miPlan',
  'cuenta',
  'apariencia',
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

    await fireEvent.press(screen.getByTestId('ajuste-tile-apariencia'));
    expect(onAjuste).toHaveBeenCalledWith('apariencia');

    await fireEvent.press(screen.getByTestId('ajuste-tile-cuenta'));
    expect(onAjuste).toHaveBeenCalledWith('cuenta');
  });

  it('las 6 etiquetas visibles son las esperadas — en castellano y sin pares que se pisen', async () => {
    await envolver();
    expect(screen.getByText('Mi negocio')).toBeTruthy();
    expect(screen.getByText('Facturación AFIP')).toBeTruthy();
    expect(screen.getByText('Apps conectadas')).toBeTruthy();
    expect(screen.getByText('Mi plan')).toBeTruthy();
    expect(screen.getByText('Mi cuenta')).toBeTruthy();
    expect(screen.getByText('Apariencia')).toBeTruthy();
  });

  it('🔴 los pares que se pisaban ya no están', async () => {
    // Dos tiles para un solo concepto es lo que confunde a quien entró a configurar algo: no sabe
    // cuál de los dos es el que busca. `Datos personales` duplicaba `Cuenta` y las dos de plan se
    // duplicaban entre sí — y las tres eran andamiaje vacío.
    await envolver();
    for (const viejo of ['Datos personales', 'Planes disponibles', 'Plan actual', 'Skins', 'Configuración del sistema']) {
      expect(screen.queryByText(viejo)).toBeNull();
    }
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
    await fireEvent.press(screen.getByTestId('ajuste-tile-miPlan'));
    expect(screen.getByTestId('pantalla-ajustes')).toBeTruthy();
  });
});
