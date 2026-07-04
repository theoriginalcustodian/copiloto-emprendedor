import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { api, ForbiddenError, UnauthorizedError, type MeResponse } from '../lib/api';
import { clearToken, getToken, setToken } from './session';
import {
  SessionContext,
  type LoginResult,
  type SessionStatus,
  type UseSessionResult,
} from './useSession';

type MeOutcome = 'ok' | 'forbidden' | 'failed';

/**
 * Estado de sesión COMPARTIDO (Task 6/7). Envuelve la app UNA sola vez -> `App`, `LoginSkeleton`,
 * `ChatSkeleton` y ambos shells (mobile/desktop) consumen la MISMA sesión vía `useSession()`.
 *
 * Por qué un provider y no un `useSession()` por componente: cada llamada a `useSession()` con
 * estado propio era un estado INDEPENDIENTE -> el login que corría en la instancia de
 * `LoginSkeleton` guardaba el token y pasaba SU status a 'authed', pero la instancia de `App`
 * (el router) nunca se enteraba -> seguía 'anon', re-renderizaba el login, y el botón quedaba
 * trabado en "Entrando…". El fix de raíz es una fuente ÚNICA de verdad: el estado vive acá y todos
 * lo leen del mismo contexto. La lógica es reusable por ambos shells (vive en el provider, no en
 * un componente de layout).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [me, setMe] = useState<MeResponse | undefined>(undefined);

  // Valida el token actual contra /me y deja el estado consistente. Se reusa en el chequeo de
  // montaje y después de un login exitoso.
  const fetchMe = useCallback(async (): Promise<MeOutcome> => {
    try {
      const meResponse = await api.me();
      setMe(meResponse);
      setStatus('authed');
      return 'ok';
    } catch (err) {
      if (err instanceof ForbiddenError) {
        setStatus('no-habilitada');
        return 'forbidden';
      }
      // 401 (client.ts ya limpió el token) u otro error (red/servidor): degradar a anónimo.
      clearToken();
      setMe(undefined);
      setStatus('anon');
      return 'failed';
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setStatus('anon');
      return;
    }
    void fetchMe();
  }, [fetchMe]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const response = await api.login(email, password);
        setToken(response.access_token);
      } catch (err) {
        if (err instanceof UnauthorizedError) return { ok: false, error: 'credenciales' };
        return { ok: false, error: 'red' };
      }

      const outcome = await fetchMe();
      if (outcome === 'ok') return { ok: true };
      if (outcome === 'forbidden') return { ok: false, error: 'no-habilitada' };
      return { ok: false, error: 'red' };
    },
    [fetchMe],
  );

  const logout = useCallback(() => {
    clearToken();
    setMe(undefined);
    setStatus('anon');
  }, []);

  const value: UseSessionResult = { status, me, login, logout };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
