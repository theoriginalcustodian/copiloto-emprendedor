import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { apiReal as api, ForbiddenError, UnauthorizedError, type MeResponse } from '@copiloto/core';

import { almacenTokens } from '../../adapters/almacen';
import { iniciarLoginGoogle } from './oauth';
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
      // Degradar a anónimo, sí; **borrar la sesión, sólo si el 401 la mató de verdad** (CTA7). El
      // core ya limpia en ese caso; acá limpiar ante CUALQUIER error convertía un corte de red en un
      // logout permanente: se iba también el refresh token, que era lo único capaz de recuperarla.
      if (err instanceof UnauthorizedError) await almacenTokens.limpiar();
      setEstado('anon');
      return 'failed';
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      // "Sin access token" NO es "sin sesión" (CTA7): con refresh guardado la sesión está viva y
      // sólo falta renovar — y de eso ya se encarga el `apiClient` al hacer el probe. Declarar
      // 'anon' acá cortaba el camino ANTES de que nadie pudiera intentarlo.
      const token = await almacenTokens.leerToken();
      const refresh = token ? null : await almacenTokens.leerRefresh();
      if (!token && !refresh) {
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

  const loginConGoogle = useCallback(async (): Promise<LoginResult> => {
    const resultado = await iniciarLoginGoogle();
    if (!resultado.ok) {
      // 'sin-configurar' (build sin EXPO_PUBLIC_API_BASE) es un error de red real de cara al usuario;
      // 'sin-tokens' -- GoTrue volvió sin token, contrato incumplido -- se trata igual.
      const error = resultado.reason === 'cancelado' ? 'cancelado' : 'red';
      return { ok: false, error };
    }
    await almacenTokens.guardarToken(resultado.tokens.access_token);
    if (resultado.tokens.refresh_token) await almacenTokens.guardarRefresh(resultado.tokens.refresh_token);

    const primerIntento = await validarSesion();
    if (primerIntento === 'ok') return { ok: true };
    if (primerIntento !== 'forbidden') return { ok: false, error: 'red' };

    // 403 en el FIRST-LOGIN de un proveedor OAuth: el user ya existe en GoTrue (alta self-service)
    // pero todavía no tiene fila de tenant -- a diferencia del login por email/password (donde el
    // tenant se crea en el signup admin-mediado), acá hace falta este paso explícito. Idempotente en
    // el backend (`provision_oauth_tenant`), así que llamarlo siempre que el probe da 403 es seguro:
    // en logins subsiguientes del MISMO user simplemente no hace nada nuevo. Si esto falla, es un
    // 403 genuino (cuenta no habilitada por otra vía) -- degradar al aviso normal.
    try {
      await api.ensureOauthTenant();
    } catch {
      return { ok: false, error: 'no-habilitada' };
    }
    const segundoIntento = await validarSesion();
    if (segundoIntento === 'ok') return { ok: true };
    return { ok: false, error: 'no-habilitada' };
  }, [validarSesion]);

  const logout = useCallback(() => {
    void almacenTokens.limpiar();
    setMeData(null);
    setEstado('anon');
  }, []);

  const value: UseSessionResult = { estado, me: meData, login, loginConGoogle, logout };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
