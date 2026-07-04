import { afterEach, describe, expect, it } from 'vitest';

import { clearToken, getToken, setToken } from './session';

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
});
