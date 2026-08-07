import { createContext, useContext } from 'react';

import type { MeResponse } from '@copiloto/core';

/**
 * Contrato + acceso a la sesión COMPARTIDA (single source of truth) — port de
 * `_staging/documed/apps/mobile/src/modules/auth/useSession.ts` (misma lógica, mismo probe `/me`).
 * El ESTADO vive en `<SessionProvider>` (`SessionProvider.tsx`); acá solo el contexto y el hook
 * consumidor, para que el guard del layout raíz y la pantalla de login lean la MISMA sesión — ese
 * wiring (dónde se monta `<SessionProvider>` y cómo el router decide qué stack mostrar) es
 * integración del parent, no de este módulo.
 *
 * La validación de sesión usa `GET /me` como probe (mismo gate `require_tenant` 401/403):
 * - 'verificando'   -> validando token persistido contra /me (splash inicial, NUNCA contenido de la app).
 * - 'anon'          -> sin token, o token inválido/expirado (401) -> mostrar login.
 * - 'autenticado'   -> token válido + tenant habilitado -> mostrar la app.
 * - 'no-habilitada' -> token válido pero sin tenant (403) -> login CON aviso (NO es lo mismo que 401:
 *   confundirlos deja al emprendedor mirando un login que "no funciona" sin saber por qué).
 */
export type SessionStatus = 'verificando' | 'anon' | 'autenticado' | 'no-habilitada';

// 'cancelado' es propio del camino Google: el usuario cerró el consentimiento sin completar. La UI
// lo trata distinto de 'red' -- no es un error, es una decisión del usuario, así que no dispara alerta.
export type LoginErrorKind = 'credenciales' | 'no-habilitada' | 'red' | 'cancelado';

export interface LoginResult {
  ok: boolean;
  error?: LoginErrorKind;
}

export interface UseSessionResult {
  estado: SessionStatus;
  /** Identidad del tenant (`GET /me`). `null` mientras no hay sesión validada. */
  me: MeResponse | null;
  /**
   * Por qué la sesión terminó, cuando terminó sola (CTA5). `undefined` en todos los demás casos.
   * Gemelo exacto del campo del provider web — ver su docstring para por qué es dato y no un
   * `SessionStatus` nuevo.
   */
  avisoSesion?: string;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginConGoogle: () => Promise<LoginResult>;
  logout: () => void;
}

export const SessionContext = createContext<UseSessionResult | null>(null);

/** Consume la sesión compartida. Debe usarse dentro de `<SessionProvider>`. */
export function useSession(): UseSessionResult {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return ctx;
}
