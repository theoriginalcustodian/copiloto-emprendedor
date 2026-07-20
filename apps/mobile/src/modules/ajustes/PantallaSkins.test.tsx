import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

/** `MarcoGlass` sólo usa `router.back()` (gesto/"Volver" de cierre). Sin este mock, el import real de
 * `expo-router` arrastra `standard-navigation` (ESM sin transformar bajo Jest) y la suite entera
 * falla al cargar -- mismo precedente que `_staging/documed/apps/mobile/src/rutas/
 * proximamente.test.tsx`. */
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}));

/** En memoria -- aísla estos tests de `AsyncStorage` real: lo que se prueba acá es que
 * `PantallaSkins` DISPARA la persistencia (vía `useSkin`/`ThemeProvider`, ya testeado en
 * `temaSinHex.test.ts`/`shell.test.tsx`), no la implementación de `almacenClave` en sí. */
jest.mock('../../adapters/almacen', () => ({
  almacenClave: {
    leer: jest.fn().mockResolvedValue(null),
    guardar: jest.fn().mockResolvedValue(undefined),
    borrar: jest.fn().mockResolvedValue(undefined),
  },
}));

import { almacenClave } from '../../adapters/almacen';
import { SKINS } from '../../theme/tokens';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaSkins } from './PantallaSkins';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaSkins />
    </ThemeProvider>,
  );
}

describe('PantallaSkins (pantalla propia con cards de color, ex-selector dentro de Ajustes)', () => {
  beforeEach(() => {
    jest.mocked(almacenClave.leer).mockReset().mockResolvedValue(null);
    jest.mocked(almacenClave.guardar).mockReset().mockResolvedValue(undefined);
  });

  it('arranca en el tema "cian" (default) con su card marcada activa', async () => {
    await envolver();
    await waitFor(() => expect(screen.getByTestId('skin-card-cian').props.accessibilityState.selected).toBe(true));
    expect(screen.getByTestId('skin-card-violeta').props.accessibilityState.selected).toBe(false);
  });

  it('cambiar de skin PERSISTE la elección (almacenClave) y se APLICA al instante (la card pasa a activa)', async () => {
    await envolver();
    // Se presiona un tema DISTINTO del default (`cian`) para ejercitar un cambio real.
    await fireEvent.press(screen.getByTestId('skin-card-violeta'));

    // Persiste: mismo criterio que `ThemeProvider.tsx::setSkin` -- guarda vía `almacenClave`.
    await waitFor(() => expect(almacenClave.guardar).toHaveBeenCalledWith(expect.any(String), 'violeta'));

    // Se aplica al instante: la card de "violeta" queda seleccionada y la de "cian" deja de estarlo
    // -- sin esto, `setSkin` podría persistir sin re-renderizar nada (bug silencioso).
    expect(screen.getByTestId('skin-card-violeta').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('skin-card-cian').props.accessibilityState.selected).toBe(false);
  });

  it('re-hidrata el skin guardado de una sesión previa al montar', async () => {
    jest.mocked(almacenClave.leer).mockResolvedValueOnce('black');
    await envolver();
    await waitFor(() => expect(screen.getByTestId('skin-card-black').props.accessibilityState.selected).toBe(true));
  });

  it('las 5 etiquetas visibles son las del rediseño de vidrio -- no traducciones inventadas', async () => {
    await envolver();
    expect(screen.getByText('Cian')).toBeTruthy();
    expect(screen.getByText('Violeta')).toBeTruthy();
    expect(screen.getByText('Ámbar')).toBeTruthy();
    expect(screen.getByText('Blanco clínico')).toBeTruthy();
    expect(screen.getByText('Negro')).toBeTruthy();
  });

  it('cada card muestra 4 chips de color -- la MUESTRA real, no sólo el nombre', async () => {
    await envolver();
    for (let i = 0; i < 4; i += 1) {
      expect(screen.getByTestId(`skin-card-violeta-muestra-${i}`)).toBeTruthy();
    }
  });

  it('los chips de una card pintan los colores REALES de SU paleta, no los del tema activo', async () => {
    // Control: con "cian" activo (default de `envolver`), la card de "violeta" tiene que mostrar el
    // acento de VIOLETA, no el de cian -- si esto fallara, las 5 cards se verían idénticas salvo la
    // elegida, que es exactamente el bug que este diseño evita.
    await envolver();
    const chipAcentoVioleta = screen.getByTestId('skin-card-violeta-muestra-0');
    const estiloAplanado = StyleSheet.flatten(chipAcentoVioleta.props.style);
    expect(estiloAplanado.backgroundColor).toBe(SKINS.violeta.color.acento);
    expect(SKINS.violeta.color.acento).not.toBe(SKINS.cian.color.acento);
  });
});
