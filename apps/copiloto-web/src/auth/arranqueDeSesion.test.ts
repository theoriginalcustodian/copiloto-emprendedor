/**
 * CTA7 — **el arranque cortaba antes de dejar renovar** (la tercera capa del mismo defecto).
 *
 * Con el cliente HTTP ya arreglado en el core (#342) y en la web (#345), el navegador SEGUÍA yendo
 * al login: `SessionProvider` decidía `'anon'` en el montaje con `if (!getToken())`, así que nunca
 * llamaba a `/me` y **nadie tenía ocasión de renovar**. Medido contra el sitio desplegado: 0
 * requests a `/auth/refresh` y el refresh token borrado.
 *
 * La lección que estos tests congelan: "sin access token" **no** es "sin sesión". Con refresh
 * guardado la sesión está viva y sólo falta renovarla — y de eso ya se encarga el cliente HTTP.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: { login: vi.fn(), me: vi.fn(), catalog: vi.fn(), sendChat: vi.fn(), getReply: vi.fn() },
  };
});

import { api, UnauthorizedError } from '../lib/api';
import { getRefreshToken, setRefreshToken, setToken } from './session';
import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';

const wrapper = SessionProvider;
const ME = { cliente_id: 'c1', mp_connected: false, composio_connected: [], es_admin: false };

describe('arranque con el access token AUSENTE pero el refresh guardado', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.me).mockReset();
  });

  it('EL QUE IMPORTA: hace el probe igual (el cliente renueva) → authed, no anon', async () => {
    // Revertí a `if (!getToken()) { setStatus('anon'); return; }` y esto se pone rojo: `api.me`
    // no se llama nunca y el estado queda en 'anon'.
    setRefreshToken('rt-vivo');
    vi.mocked(api.me).mockResolvedValueOnce(ME);

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authed'));
    expect(api.me).toHaveBeenCalledTimes(1);
  });

  it('control: sin refresh TAMPOCO → anon sin tocar la red (no hay sesión que recuperar)', async () => {
    // Sin este control, el test de arriba pasaría igual con un provider que llame a `/me` siempre,
    // incluido el usuario que nunca se logueó — una request inútil en cada arranque anónimo.
    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('anon'));
    expect(api.me).not.toHaveBeenCalled();
  });

  it('si el probe da 401 (refresh muerto) → anon Y la sesión se borra', async () => {
    setRefreshToken('rt-muerto');
    vi.mocked(api.me).mockRejectedValueOnce(new UnauthorizedError('sesión vencida'));

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('anon'));
    expect(getRefreshToken()).toBeNull();
  });
});

describe('un error que NO es 401 no puede destruir la sesión', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.me).mockReset();
  });

  it('EL QUE IMPORTA: el probe falla por RED → anon, pero los tokens siguen ahí', async () => {
    // Antes se llamaba `clearToken()` ante CUALQUIER error: un corte de red —el caso normal en un
    // celular— convertía un problema transitorio en un logout permanente, porque se llevaba puesto
    // el refresh token. Revertí a `clearToken()` sin condición y esto se pone rojo.
    setToken('tok-vivo');
    setRefreshToken('rt-vivo');
    vi.mocked(api.me).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('anon'));
    expect(getRefreshToken()).toBe('rt-vivo'); // la sesión se recupera cuando vuelva la red
  });
});
