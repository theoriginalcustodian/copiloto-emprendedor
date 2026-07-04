import { afterEach, describe, expect, it } from 'vitest';

import { clearToken, getRefreshToken, getToken, setRefreshToken, setToken } from './session';

describe('session token storage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('getToken devuelve null si no hay nada persistido', () => {
    expect(getToken()).toBeNull();
  });

  it('setToken persiste y getToken lo recupera', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
  });

  it('clearToken lo borra', () => {
    setToken('abc123');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('getRefreshToken devuelve null si no hay nada persistido', () => {
    expect(getRefreshToken()).toBeNull();
  });

  it('setRefreshToken persiste y getRefreshToken lo recupera', () => {
    setRefreshToken('rt-abc123');
    expect(getRefreshToken()).toBe('rt-abc123');
  });

  it('clearToken borra AMBOS tokens (access + refresh)', () => {
    setToken('abc123');
    setRefreshToken('rt-abc123');
    clearToken();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
