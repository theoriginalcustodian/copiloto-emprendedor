import { afterEach, describe, expect, it, vi } from 'vitest';

import { consumeOauthCallback, googleAuthUrl } from './oauth';

describe('googleAuthUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('devuelve null si no hay VITE_AUTH_URL (build sin Google → botón oculto)', () => {
    vi.stubEnv('VITE_AUTH_URL', '');
    expect(googleAuthUrl()).toBeNull();
  });

  it('arma la URL de authorize con provider=google y redirect_to al origin', () => {
    vi.stubEnv('VITE_AUTH_URL', 'https://auth.example.com');
    const url = googleAuthUrl();
    expect(url).not.toBeNull();
    expect(url!).toContain('https://auth.example.com/auth/v1/authorize?provider=google');
    expect(url!).toContain(`redirect_to=${encodeURIComponent(`${window.location.origin}/`)}`);
  });

  it('normaliza el trailing slash de VITE_AUTH_URL (no duplica //)', () => {
    vi.stubEnv('VITE_AUTH_URL', 'https://auth.example.com/');
    expect(googleAuthUrl()!).toContain('https://auth.example.com/auth/v1/authorize');
  });
});

describe('consumeOauthCallback', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('devuelve null si no hay fragment', () => {
    window.history.replaceState(null, '', '/');
    expect(consumeOauthCallback()).toBeNull();
  });

  it('devuelve null y NO toca la URL si el fragment es ajeno al OAuth (ej #/ruta)', () => {
    window.history.replaceState(null, '', '/#/alguna-ruta');
    expect(consumeOauthCallback()).toBeNull();
    expect(window.location.hash).toBe('#/alguna-ruta');
  });

  it('extrae access_token + refresh_token del fragment y limpia el hash', () => {
    window.history.replaceState(null, '', '/#access_token=AT123&refresh_token=RT456&expires_in=3600');
    const tokens = consumeOauthCallback();
    expect(tokens).toEqual({ access_token: 'AT123', refresh_token: 'RT456' });
    expect(window.location.hash).toBe(''); // el token no queda en la barra ni en el historial
  });

  it('con access_token sin refresh_token, refresh_token = null', () => {
    window.history.replaceState(null, '', '/#access_token=AT123');
    expect(consumeOauthCallback()).toEqual({ access_token: 'AT123', refresh_token: null });
  });

  it('si el proveedor devuelve error, limpia el hash y devuelve null (login anónimo)', () => {
    window.history.replaceState(null, '', '/#error=access_denied&error_description=denied');
    expect(consumeOauthCallback()).toBeNull();
    expect(window.location.hash).toBe('');
  });
});
