import { useCallback, useEffect, useState } from 'react';

import { api, ForbiddenError, UnauthorizedError, type MeResponse } from '../lib/api';
import { clearToken, getToken, setToken } from './session';

/**
 * Estado de sesión de la app (Task 6). Reusable por ambos shells (mobile/desktop) — la lógica
 * vive acá, nunca en un componente de layout.
 *
 * - 'checking'     -> validando token persistido contra /me (splash inicial).
 * - 'anon'         -> sin token, o token inválido/expirado (401) -> mostrar LoginSkeleton.
 * - 'authed'       -> token válido + tenant habilitado -> mostrar ChatSkeleton.
 * - 'no-habilitada'-> token válido pero sin tenant (403) -> LoginSkeleton con aviso (no un 5to
 *                     componente: la pantalla de login ya cubre este caso, ver LoginSkeleton).
 */
export type SessionStatus = 'checking' | 'anon' | 'authed' | 'no-habilitada';

export type LoginErrorKind = 'credenciales' | 'no-habilitada' | 'red';

export interface LoginResult {
  ok: boolean;
  error?: LoginErrorKind;
}

export interface UseSessionResult {
  status: SessionStatus;
  me?: MeResponse;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

type MeOutcome = 'ok' | 'forbidden' | 'failed';

export function useSession(): UseSessionResult {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [me, setMe] = useState<MeResponse | undefined>(undefined);

  // Valida el token actual contra /me y deja el estado consistente con el resultado. Se reusa
  // tanto en el chequeo de montaje como después de un login exitoso.
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
        if (err instanceof UnauthorizedError) {
          return { ok: false, error: 'credenciales' };
        }
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

  return { status, me, login, logout };
}
