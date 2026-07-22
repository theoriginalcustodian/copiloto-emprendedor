import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { apiReal as api, ForbiddenError, UnauthorizedError, type MeResponse } from '@copiloto/core';

import { almacenTokens } from '../../adapters/almacen';
import {
  SessionContext,
  type LoginResult,
  type SessionStatus,
  type UseSessionResult,
} from './useSession';

type ValidateOutcome = 'ok' | 'forbidden' | 'failed';

/**
 * Estado de sesión COMPARTIDO — port de `_staging/documed/apps/mobile/src/modules/auth/SessionProvider.tsx`
 * (misma lógica, mismo probe `GET /me`; el contrato `POST /auth/login` / `GET /me` ya está verificado
 * contra el backend vivo de `copilotoemprendedor.duckdns.org`, ver `packages/core/src/api/auth.ts` +
 * `me.ts`). El refresh-on-401 (incl. la rotación de refresh token de GoTrue en CADA uso) ya lo resuelve
 * `apiClient` de forma transparente (`packages/core/src/api/client.ts`) — este provider no lo reimplementa.
 *
 * Única adaptación real vs. la fuente: el token no se puede leer sincrónicamente (`AsyncStorage` es
 * async en RN), así que se resuelve `almacenTokens.leerToken()` explícitamente ANTES de decidir si hace
 * falta llamar a `/me` — el estado arranca en 'verificando' y quien monte el guard de la app (el
 * `_layout.tsx` del parent) no debe renderizar contenido protegido mientras esa resolución está en curso.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<SessionStatus>('verificando');
  const [meData, setMeData] = useState<MeResponse | null>(null);

  // Valida el token actual contra el probe `GET /me` (mismo gate `require_tenant`: 401 token
  // inválido / 403 sin tenant) y, de paso, trae la identidad del tenant.
  const validarSesion = useCallback(async (): Promise<ValidateOutcome> => {
    try {
      const identidad = await api.me();
      setMeData(identidad);
      setEstado('autenticado');
      return 'ok';
    } catch (err) {
      setMeData(null);
      if (err instanceof ForbiddenError) {
        setEstado('no-habilitada');
        return 'forbidden';
      }
      // 401 (el core ya limpió el token en `client.ts`) u otro error (red/servidor): degradar a
      // anónimo y limpiar igual — un error de red con un token que después resulta inválido no debe
      // dejar al emprendedor "logueado" en apariencia.
      await almacenTokens.limpiar();
      setEstado('anon');
      return 'failed';
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const token = await almacenTokens.leerToken();
      if (!token) {
        if (vivo) setEstado('anon');
        return;
      }
      if (vivo) await validarSesion();
    })();
    return () => {
      vivo = false;
    };
  }, [validarSesion]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const response = await api.login(email, password);
        await almacenTokens.guardarToken(response.access_token);
        await almacenTokens.guardarRefresh(response.refresh_token);
      } catch (err) {
        if (err instanceof UnauthorizedError) return { ok: false, error: 'credenciales' };
        return { ok: false, error: 'red' };
      }

      const outcome = await validarSesion();
      if (outcome === 'ok') return { ok: true };
      if (outcome === 'forbidden') return { ok: false, error: 'no-habilitada' };
      return { ok: false, error: 'red' };
    },
    [validarSesion],
  );

  const logout = useCallback(() => {
    void almacenTokens.limpiar();
    setMeData(null);
    setEstado('anon');
  }, []);

  const value: UseSessionResult = { estado, me: meData, login, logout };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
