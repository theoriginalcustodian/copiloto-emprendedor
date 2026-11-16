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

import { apiReal as api } from '@copiloto/core';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { almacenTokens } from '../../adapters/almacen';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaMetodo } from './PantallaMetodo';
import { SessionProvider } from './SessionProvider';

const onMail = jest.fn();

async function montar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <PantallaMetodo onMail={onMail} />
      </SessionProvider>
    </ThemeProvider>,
  );
}

/** Flujo «Entrada a Odobi» (Martin 12/11): la elección de método. Los tests de Google vinieron de `PantallaLogin.test.tsx`. */
describe('PantallaMetodo', () => {
  beforeEach(async () => {
    await almacenTokens.limpiar();
    onMail.mockReset();
    jest.mocked(api.me).mockReset();
    jest.mocked(api.ensureOauthTenant).mockReset();
    jest.mocked(GoogleSignin.signIn).mockReset();
    jest.mocked(GoogleSignin.hasPlayServices).mockReset().mockResolvedValue(true);
    (global as any).fetch = jest.fn();
    process.env.EXPO_PUBLIC_API_BASE = 'https://copilotoemprendedor.duckdns.org';
  });

  it('los tres métodos se ven: Apple, Google y mail, cada uno con su ícono a la izquierda', async () => {
    await montar();
    expect(screen.getByTestId('metodo-apple')).toBeTruthy();
    expect(screen.getByTestId('metodo-google')).toBeTruthy();
    expect(screen.getByTestId('metodo-mail')).toBeTruthy();
    expect(screen.getByTestId('metodo-apple-logo')).toBeTruthy();
    expect(screen.getByTestId('metodo-google-logo')).toBeTruthy();
    expect(screen.getByTestId('metodo-mail-logo')).toBeTruthy(); // el sobre: cierra la columna de íconos
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
    jest.mocked(api.me).mockResolvedValueOnce({ cliente_id: 'cli-1', email: 'emprendedor@copiloto.test', es_admin: false, mp_connected: false, composio_connected: [], legal_aceptado: false, legal_version_aceptada: null });

    await montar();
    await fireEvent.press(screen.getByTestId('metodo-google'));

    await waitFor(async () => expect(await almacenTokens.leerToken()).toBe('tok-google'));
    expect(await almacenTokens.leerRefresh()).toBe('refresh-google');
    expect(screen.queryByTestId('metodo-aviso')).toBeNull();
  });

  it('cancelar el selector nativo de Google no muestra alerta (no es un error)', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({ type: 'cancelled', data: null } as any);

    await montar();
    await fireEvent.press(screen.getByTestId('metodo-google'));

    await waitFor(() => expect(GoogleSignin.signIn).toHaveBeenCalled());
    expect(screen.queryByTestId('metodo-aviso')).toBeNull();
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
      .mockResolvedValueOnce({ cliente_id: 'cli-nuevo', email: 'nuevo@gmail.com', es_admin: false, mp_connected: false, composio_connected: [], legal_aceptado: false, legal_version_aceptada: null });
    jest.mocked(api.ensureOauthTenant).mockResolvedValueOnce({ cliente_id: 'cli-nuevo' });

    await montar();
    await fireEvent.press(screen.getByTestId('metodo-google'));

    await waitFor(() => expect(api.ensureOauthTenant).toHaveBeenCalled());
    await waitFor(() => expect(api.me).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('metodo-aviso')).toBeNull();
  });

  it('Apple todavía no tiene backend: avisa que llega pronto y no llama a nada', async () => {
    await montar();
    await fireEvent.press(screen.getByTestId('metodo-apple'));
    expect(screen.getByTestId('metodo-aviso').props.children).toMatch(/Apple llega muy pronto/);
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('«Continuar con mail» lleva al formulario', async () => {
    await montar();
    await fireEvent.press(screen.getByTestId('metodo-mail'));
    expect(onMail).toHaveBeenCalledTimes(1);
  });

  it('en Android no se dibuja el botón de Apple', async () => {
    const { Platform } = jest.requireActual<typeof import('react-native')>('react-native');
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    try {
      await montar();
      expect(screen.queryByTestId('metodo-apple')).toBeNull();
      expect(screen.getByTestId('metodo-google')).toBeTruthy();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => original });
    }
  });
});
