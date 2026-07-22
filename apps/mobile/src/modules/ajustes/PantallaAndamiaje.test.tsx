import { render, screen } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect son globales, no se importan de vitest.

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaAndamiaje } from './PantallaAndamiaje';

async function envolver(mensaje: string) {
  return render(
    <ThemeProvider>
      <PantallaAndamiaje titulo="Datos personales" icono="note" mensaje={mensaje} testID="pantalla-datos-personales" />
    </ThemeProvider>,
  );
}

describe('PantallaAndamiaje (andamiaje honesto para pantallas sin fuente de datos real todavía)', () => {
  it('pinta el título recibido en el marco de vidrio', async () => {
    await envolver('Todavía no hay datos personales cargados.');
    expect(screen.getByTestId('glass-titulo').props.children).toBe('Datos personales');
  });

  it('muestra el mensaje EXPLÍCITO recibido -- nunca un dato inventado', async () => {
    const mensaje = 'Acá vas a poder cargar tus datos de facturación. Todavía no está conectado a ningún dato real.';
    await envolver(mensaje);
    expect(screen.getByTestId('andamiaje-vacio').props.children).toBe(mensaje);
  });
});
