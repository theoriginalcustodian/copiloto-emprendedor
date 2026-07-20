import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaRedes } from './PantallaRedes';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaRedes />
    </ThemeProvider>,
  );
}

describe('PantallaRedes (Cascarón D3)', () => {
  it('renderiza el título de la pantalla', async () => {
    await envolver();
    expect(screen.getByText('Redes Sociales')).toBeTruthy();
  });

  it('renderiza la descripción de redes', async () => {
    await envolver();
    expect(
      screen.getByTestId('redes-descripcion'),
    ).toBeTruthy();
  });
});
