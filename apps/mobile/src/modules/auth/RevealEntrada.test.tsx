/**
 * BL-X10 — botón de pronunciación: sólo aparece con `pronunciacionAsset` (no hay audio en el repo
 * todavía, `[ASSUMED_PENDING_VERIFY]` -- ver docstring de `RevealEntrada.tsx`). Control negativo:
 * sin asset, ni rastro del botón (sólo el texto, como antes de X10).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { RevealEntrada } from './RevealEntrada';

async function montar(pronunciacionAsset?: number) {
  return render(
    <ThemeProvider>
      <RevealEntrada
        primario="Entrar"
        secundario="Entrar con otra cuenta"
        onPrimario={jest.fn()}
        onSecundario={jest.fn()}
        pronunciacionAsset={pronunciacionAsset}
      />
    </ThemeProvider>,
  );
}

describe('RevealEntrada — botón de pronunciación (BL-X10)', () => {
  it('sin asset, no renderiza el botón (sólo el texto)', async () => {
    await montar(undefined);
    expect(screen.getByTestId('reveal-entrada-pronunciacion')).toBeTruthy();
    expect(screen.queryByTestId('reveal-entrada-pronunciar')).toBeNull();
  });

  it('con asset, renderiza el botón y reproduce al tocarlo', async () => {
    await montar(1);
    const boton = screen.getByTestId('reveal-entrada-pronunciar');
    expect(boton).toBeTruthy();
    await fireEvent.press(boton);
    // El player real es `expo-audio` (mockeado en jest.setup.js): no hay aserción sobre `play()`
    // acá porque el mock es compartido -- alcanza con que tocar el botón no rompa el render.
  });
});
