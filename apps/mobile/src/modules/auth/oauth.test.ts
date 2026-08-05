/**
 * `iniciarLoginGoogle` -- reescrito 2026-08-05 (BETA-4b) a sign-in NATIVO (Credential Manager,
 * `@react-native-google-signin/google-signin`): pedido explícito del operador tras verificar en
 * device que el flujo anterior (`expo-web-browser` + Custom Tabs forzando Chrome) mostraba SIEMPRE
 * el login manual de Google en vez del selector nativo de cuenta del sistema -- Android en general
 * no tiene un equivalente nativo de `ASWebAuthenticationSession` para browsers, así que cualquier
 * flujo basado en abrir un navegador (aunque sea Chrome) queda un escalón por debajo del selector
 * real de Credential Manager que usan el resto de las apps del teléfono.
 */
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn().mockResolvedValue(true), signIn: jest.fn() },
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
}));

import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { iniciarLoginGoogle } from './oauth';

const EXITO_GOOGLE = { type: 'success' as const, data: { idToken: 'google-id-token-real', user: {} } };

function mockFetchOnce(status: number, body: unknown) {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('iniciarLoginGoogle', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_BASE = 'https://copilotoemprendedor.duckdns.org';
    jest.mocked(GoogleSignin.signIn).mockReset();
    jest.mocked(GoogleSignin.hasPlayServices).mockReset().mockResolvedValue(true);
  });

  it('abre el selector nativo y, con éxito, intercambia el idToken por el token propio en el backend', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce(EXITO_GOOGLE as any);
    mockFetchOnce(200, { access_token: 'tok-abc', refresh_token: 'ref-xyz' });

    const resultado = await iniciarLoginGoogle();

    expect(GoogleSignin.hasPlayServices).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://copilotoemprendedor.duckdns.org/auth/google/id-token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id_token: 'google-id-token-real' }),
      }),
    );
    expect(resultado).toEqual({ ok: true, tokens: { access_token: 'tok-abc', refresh_token: 'ref-xyz' } });
  });

  it('cancelado por el usuario no es un error ni intenta el intercambio', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({ type: 'cancelled', data: null } as any);
    (global as any).fetch = jest.fn();

    const resultado = await iniciarLoginGoogle();

    expect(resultado).toEqual({ ok: false, reason: 'cancelado' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('si el backend rechaza el idToken (401), resuelve sin-tokens', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce(EXITO_GOOGLE as any);
    mockFetchOnce(401, { detail: 'id_token de Google inválido' });

    const resultado = await iniciarLoginGoogle();

    expect(resultado).toEqual({ ok: false, reason: 'sin-tokens' });
  });

  it('un error nativo (Play Services / red) no propaga la excepción -- resuelve sin-tokens', async () => {
    jest.mocked(GoogleSignin.hasPlayServices).mockRejectedValueOnce(new Error('PLAY_SERVICES_NOT_AVAILABLE'));

    const resultado = await iniciarLoginGoogle();

    expect(resultado).toEqual({ ok: false, reason: 'sin-tokens' });
  });

  it('sin EXPO_PUBLIC_API_BASE no intenta abrir el selector de Google', async () => {
    process.env.EXPO_PUBLIC_API_BASE = '';

    const resultado = await iniciarLoginGoogle();

    expect(resultado).toEqual({ ok: false, reason: 'sin-configurar' });
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
  });
});
