import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaApps } from './PantallaApps';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaApps />
    </ThemeProvider>,
  );
}

describe('PantallaApps', () => {
  it('lista las 8 integraciones del backend', async () => {
    await envolver();
    for (const nombre of ['Gmail', 'Google Drive', 'Google Sheets', 'Google Docs', 'Google Calendar', 'HubSpot', 'Instagram', 'MercadoPago']) {
      expect(screen.getByText(nombre)).toBeTruthy();
    }
  });

  /**
   * 🔴 No afirmar conexión sin haberla consultado.
   *
   * Hasta F5 no hay sesión, así que esta pantalla no puede saber qué servicios están conectados.
   * Mostrar "conectado" igual sería una afirmación sin evidencia — y la que más caro sale, porque
   * el usuario le va a pedir algo al copiloto contando con eso.
   */
  it('no afirma estado de conexión mientras no haya sesión', async () => {
    await envolver();
    for (const palabra of [/conectado/i, /activo/i, /vinculado/i]) {
      expect(screen.queryByText(palabra)).toBeNull();
    }
  });

  /**
   * 🔴 Invariante invertido con la convergencia a `MarcoGlass` (2026-07-21). Antes esta pantalla se
   * montaba dentro de `CapaFuncion`, que aportaba el título — así que `PantallaApps` NO podía
   * repetirlo. `CapaFuncion` se borró: ahora es esta misma pantalla la que trae su propio
   * `MarcoGlass`, así que el título tiene que aparecer — pero UNA sola vez, nunca duplicado por el
   * contenido propio.
   */
  it('el título "Apps" lo aporta el MarcoGlass propio, una sola vez', async () => {
    await envolver();
    expect(screen.getByTestId('glass-titulo').props.children).toBe('Apps');
    expect(screen.getAllByText('Apps')).toHaveLength(1);
  });
});
