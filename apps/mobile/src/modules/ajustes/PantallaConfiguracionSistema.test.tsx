import { fireEvent, render, screen } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaConfiguracionSistema } from './PantallaConfiguracionSistema';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaConfiguracionSistema />
    </ThemeProvider>,
  );
}

describe('PantallaConfiguracionSistema (andamiaje + slot reservado de "No molestar")', () => {
  it('reserva la fila de "No molestar" marcada como pendiente', async () => {
    await envolver();
    expect(screen.getByText('No molestar')).toBeTruthy();
    expect(screen.getByTestId('config-no-molestar-badge').props.children).toBe('Pendiente');
  });

  it('la fila de "No molestar" NO dispara nada al tocarla -- no está implementada, no debe simular que sí', async () => {
    await envolver();
    // Sin `onPress`, `Row` no expone `accessibilityRole="button"` -- confirma que es inerte por
    // construcción, no sólo por ausencia de handler (que sería frágil ante un refactor futuro).
    expect(screen.getByTestId('config-no-molestar').props.accessibilityRole).toBeUndefined();
    // Tocarla no debe tirar ningún error ni cambiar nada observable.
    await fireEvent.press(screen.getByTestId('config-no-molestar'));
    expect(screen.getByTestId('config-no-molestar-badge').props.children).toBe('Pendiente');
  });
});
