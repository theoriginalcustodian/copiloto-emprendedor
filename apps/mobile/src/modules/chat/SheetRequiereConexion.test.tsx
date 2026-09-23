/**
 * K-11 / BL-J8 — el sheet «conectá X» en contexto. ⚠️ Todo `fireEvent`/`render` va con `await` (RNTL 14).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { SheetRequiereConexion } from './SheetRequiereConexion';

const CONEXION = { service: 'gmail', label: 'Gmail', alcance: ['Leer mails', 'Enviar mails'], connectPath: '/composio/connect?service=gmail' };

async function montar(props: Partial<Parameters<typeof SheetRequiereConexion>[0]> = {}) {
  const onConectar = jest.fn();
  const onAhoraNo = jest.fn();
  await render(
    <ThemeProvider>
      <SheetRequiereConexion conexion={CONEXION} onConectar={onConectar} onAhoraNo={onAhoraNo} {...props} />
    </ThemeProvider>,
  );
  return { onConectar, onAhoraNo };
}

describe('SheetRequiereConexion', () => {
  it('muestra el nombre y el alcance del catálogo con «Conectar» y «Ahora no»', async () => {
    await montar();
    expect(screen.getByText('Conectá Gmail')).toBeTruthy();
    expect(screen.getByText('• Enviar mails')).toBeTruthy();
    expect(screen.getByTestId('sheet-requiere-conexion-conectar')).toBeTruthy();
    expect(screen.getByTestId('sheet-requiere-conexion-ahora-no')).toBeTruthy();
  });

  it('cada botón dispara lo suyo', async () => {
    const { onConectar, onAhoraNo } = await montar();
    await fireEvent.press(screen.getByTestId('sheet-requiere-conexion-conectar'));
    await fireEvent.press(screen.getByTestId('sheet-requiere-conexion-ahora-no'));
    expect(onConectar).toHaveBeenCalledTimes(1);
    expect(onAhoraNo).toHaveBeenCalledTimes(1);
  });

  it('sin conexión (null) no renderiza nada', async () => {
    await montar({ conexion: null });
    expect(screen.queryByTestId('sheet-requiere-conexion')).toBeNull();
  });

  it('muestra el error de «Conectar» si lo hay', async () => {
    await montar({ error: 'No pudimos pedir el link de Gmail. Probá de nuevo.' });
    expect(screen.getByTestId('sheet-requiere-conexion-error')).toBeTruthy();
  });
});
