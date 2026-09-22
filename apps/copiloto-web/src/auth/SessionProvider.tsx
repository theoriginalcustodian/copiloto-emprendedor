import { alExpirarSesion, marcarSesionViva, MENSAJE_SESION_EXPIRADA } from '@copiloto/core';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { api, ForbiddenError, UnauthorizedError, type MeResponse } from '../lib/api';
import { consumeOauthCallback } from './oauth';
import { clearToken, getRefreshToken, getToken, setRefreshToken, setToken } from './session';
import {
  SessionContext,
  type LoginResult,
  type OrigenSesion,
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
  // BL-X10: 'restaurada' por default (arranque con token guardado, el camino más frecuente); el
  // efecto de montaje y `login()` lo corrigen a 'recien-autenticada' cuando corresponde, ANTES de
  // llamar a `fetchMe` — así `AppRouter` ya lo lee bien apenas `status` pasa a 'checking'/'authed'.
  const [origenSesion, setOrigenSesion] = useState<OrigenSesion>('restaurada');
  // BL-X12w: gemelo de `cierreVoluntario` en mobile (`modules/auth/SessionProvider.tsx`).
  const [cierreVoluntario, setCierreVoluntario] = useState<{ email: string | null } | undefined>(undefined);
  // BL-X10 (fila 2): `true` sólo cuando el arranque no encuentra NI token NI refresh — nunca hubo
  // sesión en este dispositivo. Gemelo de mobile (`modules/auth/SessionProvider.tsx`).
  const [primeraVez, setPrimeraVez] = useState(false);
  // Espejo en ref de `primeraVez`/`cierreVoluntario`: `login()` los necesita AL MOMENTO del click,
  // no como dependencia de `useCallback` (cambiarían su identidad en cada logout/arranque).
  const primeraVezRef = useRef(false);
  primeraVezRef.current = primeraVez;
  const cierreVoluntarioRef = useRef<{ email: string | null } | undefined>(undefined);
  cierreVoluntarioRef.current = cierreVoluntario;

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
      setOrigenSesion('recien-autenticada'); // BL-X10: callback OAuth = ingreso recién ocurrido
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
      setPrimeraVez(true); // BL-X10: nunca hubo sesión acá -> reveal de primer ingreso, no el formulario
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
      // BL-X10 (fila 2): «después del login no se repite» — si se llega acá desde el reveal (primer
      // ingreso o volver), la identidad YA se mostró ahí; repetir el splash largo acá sería la
      // segunda vez. Sólo la sesión caída sola (CTA5, sin reveal previo) preserva el splash largo
      // post-login de siempre.
      if (!primeraVezRef.current && cierreVoluntarioRef.current == null) {
        setOrigenSesion('recien-autenticada');
      }
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

  // Volvió a entrar: ni el cierre voluntario ni el primer-arranque describen ya nada (si luego se
  // cae la sesión sola, no es «volver» ni «primera vez»).
  useEffect(() => {
    if (status === 'authed') {
      setCierreVoluntario(undefined);
      setPrimeraVez(false);
    }
  }, [status]);

  const emailRef = useRef<string | null>(null);
  emailRef.current = me?.email ?? null;

  const logout = useCallback(() => {
    clearToken();
    setCierreVoluntario({ email: emailRef.current });
    setMe(undefined);
    setStatus('anon');
    // Salir a propósito no es que se te haya caído la sesión: el aviso no corresponde.
    setAvisoSesion(undefined);
  }, []);

  const value: UseSessionResult = {
    status,
    me,
    avisoSesion,
    origenSesion,
    cierreVoluntario: status === 'anon' ? cierreVoluntario : undefined,
    primeraVez: status === 'anon' ? primeraVez : false,
    login,
    logout,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
