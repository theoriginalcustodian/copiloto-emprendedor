import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaFacturacion } from './PantallaFacturacion';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaFacturacion />
    </ThemeProvider>,
  );
}

describe('PantallaFacturacion (Cascarón D3)', () => {
  it('renderiza el título de la pantalla', async () => {
    await envolver();
    expect(screen.getByText('Facturación')).toBeTruthy();
  });

  it('renderiza la descripción de facturación', async () => {
    await envolver();
    expect(
      screen.getByTestId('facturacion-descripcion'),
    ).toBeTruthy();
  });
});
