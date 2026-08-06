import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/** Partial mock de `@copiloto/core`: reusa las clases de error REALES (`UnauthorizedError`) para que
 * el `instanceof` de `SessionProvider` siga funcionando — sólo se reemplazan `login`/`me`/
 * `ensureOauthTenant`. Mismo patrón que `session.test.tsx`. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    apiReal: {
      ...actual.apiReal,
      login: jest.fn(),
      me: jest.fn(),
      ensureOauthTenant: jest.fn(),
    },
  };
});

// Sign-in NATIVO (Credential Manager, sin browser) -- ver `oauth.test.ts` para el detalle de por qué
// se reemplazó `expo-web-browser` (BETA-4b, 2026-08-05).
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn().mockResolvedValue(true), signIn: jest.fn() },
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
}));

import { apiReal as api, UnauthorizedError } from '@copiloto/core';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

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
    jest.mocked(api.ensureOauthTenant).mockReset();
    jest.mocked(GoogleSignin.signIn).mockReset();
    jest.mocked(GoogleSignin.hasPlayServices).mockReset().mockResolvedValue(true);
    (global as any).fetch = jest.fn();
    process.env.EXPO_PUBLIC_API_BASE = 'https://copilotoemprendedor.duckdns.org';
  });

  it('botón "Entrar con Google" visible, no interfiere con el camino email/password', async () => {
    await montar();
    expect(screen.getByTestId('login-google')).toBeTruthy();
  });

  it('login con Google exitoso persiste los tokens que devuelve el backend tras el intercambio', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({
      type: 'success',
      data: { idToken: 'google-id-token-real', user: {} },
    } as any);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'tok-google', refresh_token: 'refresh-google' }),
    });
    jest.mocked(api.me).mockResolvedValueOnce({ cliente_id: 'cli-1', email: 'emprendedor@copiloto.test' });

    await montar();
    await fireEvent.press(screen.getByTestId('login-google'));

    await waitFor(async () => expect(await almacenTokens.leerToken()).toBe('tok-google'));
    expect(await almacenTokens.leerRefresh()).toBe('refresh-google');
    expect(screen.queryByTestId('login-alert')).toBeNull();
  });

  it('cancelar el selector nativo de Google no muestra alerta (no es un error)', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({ type: 'cancelled', data: null } as any);

    await montar();
    await fireEvent.press(screen.getByTestId('login-google'));

    await waitFor(() => expect(GoogleSignin.signIn).toHaveBeenCalled());
    expect(screen.queryByTestId('login-alert')).toBeNull();
    expect(await almacenTokens.leerToken()).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('first-login de Google (403 en /me) auto-provisiona el tenant y no muestra alerta', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({
      type: 'success',
      data: { idToken: 'google-id-token-nuevo', user: {} },
    } as any);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'tok-nuevo', refresh_token: 'refresh-nuevo' }),
    });
    // El probe /me da 403 la PRIMERA vez (user recién creado por Google, sin fila de tenant todavía)
    // y 200 recién después de que `ensureOauthTenant` provisiona -- exactamente el gap que este test
    // cubre (ver el fix en `SessionProvider.loginConGoogle`).
    jest.mocked(api.me)
      .mockRejectedValueOnce(new (jest.requireActual('@copiloto/core').ForbiddenError)('sin tenant'))
      .mockResolvedValueOnce({ cliente_id: 'cli-nuevo', email: 'nuevo@gmail.com' });
    jest.mocked(api.ensureOauthTenant).mockResolvedValueOnce({ cliente_id: 'cli-nuevo' });

    await montar();
    await fireEvent.press(screen.getByTestId('login-google'));

    await waitFor(() => expect(api.ensureOauthTenant).toHaveBeenCalled());
    await waitFor(() => expect(api.me).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('login-alert')).toBeNull();
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
