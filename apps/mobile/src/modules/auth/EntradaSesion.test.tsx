/**
 * BL-X12m — el reveal «volver»: sólo quien salió A PROPÓSITO lo ve; todo lo demás va directo al formulario.
 * ⚠️ Todo `fireEvent`/`render` va con `await` (RNTL 14).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { EntradaSesion } from './EntradaSesion';
import { SessionContext, type UseSessionResult } from './useSession';

function sesion(over: Partial<UseSessionResult> = {}): UseSessionResult {
  return {
    estado: 'anon',
    me: null,
    login: jest.fn(),
    loginConGoogle: jest.fn(),
    logout: jest.fn(),
    ...over,
  };
}

async function montar(valor: UseSessionResult) {
  return render(
    <ThemeProvider>
      <SessionContext.Provider value={valor}>
        <EntradaSesion />
      </SessionContext.Provider>
    </ThemeProvider>,
  );
}

describe('EntradaSesion', () => {
  it('tras un logout a propósito aterriza en el reveal con «Entrar» y «Entrar con otra cuenta»', async () => {
    await montar(sesion({ cierreVoluntario: { email: 'ana@x.com' } }));
    expect(screen.getByTestId('reveal-entrada')).toBeTruthy();
    expect(screen.getByText('Entrar')).toBeTruthy();
    expect(screen.getByText('Entrar con otra cuenta')).toBeTruthy();
    expect(screen.queryByTestId('login-screen')).toBeNull();
  });

  it('«Entrar» va al formulario con el mail de la cuenta que salió precargado', async () => {
    await montar(sesion({ cierreVoluntario: { email: 'ana@x.com' } }));
    await fireEvent.press(screen.getByTestId('reveal-entrada-primario'));
    expect(screen.getByTestId('login-screen')).toBeTruthy();
    expect(screen.getByTestId('login-email').props.value).toBe('ana@x.com');
  });

  it('«Entrar con otra cuenta» va al formulario en blanco', async () => {
    await montar(sesion({ cierreVoluntario: { email: 'ana@x.com' } }));
    await fireEvent.press(screen.getByTestId('reveal-entrada-secundario'));
    expect(screen.getByTestId('login-email').props.value).toBe('');
  });

  it('control negativo: primer arranque o sesión caída sola NO muestran el reveal (directo al formulario)', async () => {
    await montar(sesion());
    expect(screen.getByTestId('login-screen')).toBeTruthy();
    expect(screen.queryByTestId('reveal-entrada')).toBeNull();
  });
});
