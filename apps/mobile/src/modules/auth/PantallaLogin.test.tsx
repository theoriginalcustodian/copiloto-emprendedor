import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/** Partial mock de `@copiloto/core`: reusa las clases de error REALES (`UnauthorizedError`) para que
 * el `instanceof` de `SessionProvider` siga funcionando — sólo se reemplazan `login`/`me`. Mismo
 * patrón que `session.test.tsx`. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    apiReal: {
      ...actual.apiReal,
      login: jest.fn(),
      me: jest.fn(),
    },
  };
});

import { apiReal as api, UnauthorizedError } from '@copiloto/core';

import { almacenTokens } from '../../adapters/almacen';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaLogin } from './PantallaLogin';
import { SessionProvider } from './SessionProvider';

async function montar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <PantallaLogin />
      </SessionProvider>
    </ThemeProvider>,
  );
}

describe('PantallaLogin', () => {
  beforeEach(async () => {
    await almacenTokens.limpiar();
    jest.mocked(api.login).mockReset();
    jest.mocked(api.me).mockReset();
  });

  it('login exitoso persiste el access_token y el refresh_token', async () => {
    jest.mocked(api.login).mockResolvedValueOnce({
      access_token: 'nuevo-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'nuevo-refresh',
      user: {},
    });
    jest.mocked(api.me).mockResolvedValueOnce({ cliente_id: 'cli-1', email: 'emprendedor@copiloto.test' });

    await montar();

    // RNTL 14 + React 19: `fireEvent` es asíncrono acá (ver encabezado de `jest.config.js`) — sin el
    // `await` el `act()` interno no flushea antes de la siguiente interacción y la query siguiente
    // corre sobre estado viejo.
    await fireEvent.changeText(screen.getByTestId('login-email'), 'emprendedor@copiloto.test');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'secreta123');
    await fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(api.login).toHaveBeenCalledWith('emprendedor@copiloto.test', 'secreta123'));
    await waitFor(async () => expect(await almacenTokens.leerToken()).toBe('nuevo-token'));
    expect(await almacenTokens.leerRefresh()).toBe('nuevo-refresh');
    expect(screen.queryByTestId('login-alert')).toBeNull();
  });

  it('credenciales inválidas muestran un aviso legible y NO filtran el detalle crudo del backend', async () => {
    const detalleCrudo = 'invalid_grant: password mismatch for user 8f21';
    jest.mocked(api.login).mockRejectedValueOnce(new UnauthorizedError(detalleCrudo));

    await montar();

    await fireEvent.changeText(screen.getByTestId('login-email'), 'emprendedor@copiloto.test');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'mala-password');
    await fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(screen.getByTestId('login-alert')).toBeTruthy());
    expect(screen.getByText('Email o contraseña incorrectos. Probá de nuevo.')).toBeTruthy();
    // El detalle crudo del backend (mensaje interno de GoTrue/proveedor) nunca debe llegar a la UI.
    expect(screen.queryByText(detalleCrudo)).toBeNull();
    expect(await almacenTokens.leerToken()).toBeNull();
  });

  it('campos vacíos no disparan request', async () => {
    await montar();

    // Ni un toque con los dos campos en blanco...
    await fireEvent.press(screen.getByTestId('login-submit'));
    // ...ni con sólo espacios (no es "contenido", es ausencia de contenido).
    await fireEvent.changeText(screen.getByTestId('login-email'), '   ');
    await fireEvent.changeText(screen.getByTestId('login-password'), '   ');
    await fireEvent.press(screen.getByTestId('login-submit'));

    expect(api.login).not.toHaveBeenCalled();
    expect(screen.queryByTestId('login-alert')).toBeNull();
  });
});
