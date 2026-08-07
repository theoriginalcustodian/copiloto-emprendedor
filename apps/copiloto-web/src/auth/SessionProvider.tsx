import { alExpirarSesion, marcarSesionViva, MENSAJE_SESION_EXPIRADA } from '@copiloto/core';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { api, ForbiddenError, UnauthorizedError, type MeResponse } from '../lib/api';
import { consumeOauthCallback } from './oauth';
import { clearToken, getRefreshToken, getToken, setRefreshToken, setToken } from './session';
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
  const [avisoSesion, setAvisoSesion] = useState<string | undefined>(undefined);

  // Valida el token actual contra /me y deja el estado consistente. Se reusa en el chequeo de
  // montaje y después de un login exitoso.
  const fetchMe = useCallback(async (): Promise<MeOutcome> => {
    try {
      const meResponse = await api.me();
      setMe(meResponse);
      setStatus('authed');
      // Sesión viva confirmada ⇒ rearmar el aviso, o la SEGUNDA muerte saldría muda (CTA5). Va acá y
      // no en `login` porque los tres caminos de entrada —email, el callback OAuth y el probe del
      // arranque— pasan por esta función: un solo punto, en vez de tres que se desincronizan.
      marcarSesionViva();
      return 'ok';
    } catch (err) {
      if (err instanceof ForbiddenError) {
        setStatus('no-habilitada');
        return 'forbidden';
      }
      // Degradar a anónimo, sí; **borrar la sesión, sólo si el 401 la mató de verdad** (CTA7).
      // `client.ts` ya limpia en ese caso; limpiar acá ante CUALQUIER error convertía un corte de
      // red en un logout permanente, llevándose el refresh token que podía recuperarla.
      if (err instanceof UnauthorizedError) clearToken();
      setMe(undefined);
      setStatus('anon');
      return 'failed';
    }
  }, []);

  // CTA5 — la sesión murió sola: el core ya limpió los tokens, y sin esto nadie se enteraba. La app
  // quedaba SIN sesión pero MOSTRÁNDOSE logueada, y el usuario seguía tocando botones que fallaban
  // todos igual, leyendo el `detail` crudo del backend («missing or malformed Authorization header»).
  // Acá se cierra el circuito: al login, con un motivo en castellano.
  //
  // Se suscribe una sola vez (deps `[]`) y devuelve la desuscripción como cleanup — el provider
  // envuelve la app entera, así que su ciclo de vida ES el de la sesión.
  useEffect(
    () =>
      alExpirarSesion(() => {
        setMe(undefined);
        setStatus('anon');
        setAvisoSesion(MENSAJE_SESION_EXPIRADA);
      }),
    [],
  );

  useEffect(() => {
    // 1) ¿Volvemos de un callback OAuth (Google)? GoTrue deja los tokens en el fragment de la URL.
    const oauth = consumeOauthCallback();
    if (oauth) {
      setToken(oauth.access_token);
      if (oauth.refresh_token) setRefreshToken(oauth.refresh_token);
      void (async () => {
        // First-login OAuth: provisiona el tenant (idempotente en el backend). Si ya existía o el
        // endpoint no aplica, `fetchMe` resuelve igual el estado (authed / no-habilitada / anon) —
        // nunca bloquea el login por un fallo de provisioning parcial.
        try {
          await api.ensureOauthTenant();
        } catch {
          /* idempotente / ya provisionado: el estado final lo decide fetchMe */
        }
        await fetchMe();
      })();
      return;
    }

    // 2) Sesión normal: validar contra /me. "Sin access token" NO es "sin sesión" (CTA7): con
    // refresh guardado la sesión está viva y sólo falta renovar — de eso ya se encarga el cliente
    // HTTP al hacer el probe. Cortar acá declarando 'anon' impedía que nadie llegara a intentarlo,
    // y era la razón por la que el fix del cliente no se veía en el navegador.
    if (!getToken() && !getRefreshToken()) {
      setStatus('anon');
      return;
    }
    void fetchMe();
  }, [fetchMe]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      // El aviso describe la sesión ANTERIOR: dejarlo puesto mientras se reintenta haría convivir
      // «tu sesión expiró» con el error del intento nuevo, y el usuario no sabría cuál leer.
      setAvisoSesion(undefined);
      try {
        const response = await api.login(email, password);
        setToken(response.access_token);
        setRefreshToken(response.refresh_token);
      } catch (err) {
        if (err instanceof UnauthorizedError) return { ok: false, error: 'credenciales' };
        return { ok: false, error: 'red' };
      }

      const outcome = await fetchMe(); // rearma el aviso al confirmar sesión viva (ver `fetchMe`)
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
    // Salir a propósito no es que se te haya caído la sesión: el aviso no corresponde.
    setAvisoSesion(undefined);
  }, []);

  const value: UseSessionResult = { status, me, avisoSesion, login, logout };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
