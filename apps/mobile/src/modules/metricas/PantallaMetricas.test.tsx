import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaMetricas } from './PantallaMetricas';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaMetricas />
    </ThemeProvider>,
  );
}

describe('PantallaMetricas (Cascarón D3)', () => {
  it('renderiza el título de la pantalla', async () => {
    await envolver();
    expect(screen.getByText('Métricas')).toBeTruthy();
  });

  it('renderiza la descripción de métricas', async () => {
    await envolver();
    expect(
      screen.getByTestId('metricas-descripcion'),
    ).toBeTruthy();
  });
});
