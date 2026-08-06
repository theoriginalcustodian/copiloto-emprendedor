import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

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

  it('arranca en el tema "claro" (default de ODOBI) con su card marcada activa', async () => {
    await envolver();
    await waitFor(() => expect(screen.getByTestId('skin-card-claro').props.accessibilityState.selected).toBe(true));
    expect(screen.getByTestId('skin-card-oscuro').props.accessibilityState.selected).toBe(false);
  });

  it('cambiar de skin PERSISTE la elección (almacenClave) y se APLICA al instante (la card pasa a activa)', async () => {
    await envolver();
    // Se presiona un tema DISTINTO del default (`claro`) para ejercitar un cambio real.
    await fireEvent.press(screen.getByTestId('skin-card-oscuro'));

    // Persiste: mismo criterio que `ThemeProvider.tsx::setSkin` -- guarda vía `almacenClave`.
    await waitFor(() => expect(almacenClave.guardar).toHaveBeenCalledWith(expect.any(String), 'oscuro'));

    // Se aplica al instante: la card de "oscuro" queda seleccionada y la de "claro" deja de estarlo
    // -- sin esto, `setSkin` podría persistir sin re-renderizar nada (bug silencioso).
    expect(screen.getByTestId('skin-card-oscuro').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('skin-card-claro').props.accessibilityState.selected).toBe(false);
  });

  it('re-hidrata el skin guardado de una sesión previa al montar', async () => {
    jest.mocked(almacenClave.leer).mockResolvedValueOnce('nocturno');
    await envolver();
    await waitFor(() => expect(screen.getByTestId('skin-card-nocturno').props.accessibilityState.selected).toBe(true));
  });

  it('las 3 etiquetas visibles son las pieles de ODOBI -- no traducciones inventadas', async () => {
    await envolver();
    expect(screen.getByText('Claro')).toBeTruthy();
    expect(screen.getByText('Oscuro')).toBeTruthy();
    expect(screen.getByText('Nocturno')).toBeTruthy();
  });

  it('cada card muestra 4 chips de color -- la MUESTRA real, no sólo el nombre', async () => {
    await envolver();
    for (let i = 0; i < 4; i += 1) {
      expect(screen.getByTestId(`skin-card-oscuro-muestra-${i}`)).toBeTruthy();
    }
  });

  it('los chips de FONDO de una card pintan el color REAL de SU paleta, no el del tema activo', async () => {
    // Control: con "claro" activo (default de `envolver`), la card de "oscuro" tiene que mostrar SU
    // PROPIO fondo -- si esto fallara, las 3 cards se verían idénticas salvo la elegida, que es
    // exactamente el bug que este diseño evita. Se usa `fondo` (no `acento`, chip índice 0) porque
    // ODOBI comparte un solo acento entre las 3 pieles (§1 del DoD) -- el fondo es lo que las
    // distingue.
    await envolver();
    const chipFondoOscuro = screen.getByTestId('skin-card-oscuro-muestra-2');
    const estiloAplanado = StyleSheet.flatten(chipFondoOscuro.props.style);
    expect(estiloAplanado.backgroundColor).toBe(SKINS.oscuro.color.fondo);
    expect(SKINS.oscuro.color.fondo).not.toBe(SKINS.claro.color.fondo);
  });

  it('el acento es el MISMO en las 3 pieles -- identidad ODOBI, no un bug', async () => {
    expect(SKINS.claro.color.acento).toBe(SKINS.oscuro.color.acento);
    expect(SKINS.oscuro.color.acento).toBe(SKINS.nocturno.color.acento);
  });
});
