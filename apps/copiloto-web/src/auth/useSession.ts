import { createContext, useContext } from 'react';

import type { MeResponse } from '../lib/api';

/**
 * Contrato + acceso a la sesión COMPARTIDA (single source of truth, Task 6/7). El ESTADO vive en
 * `<SessionProvider>` (SessionProvider.tsx); acá solo el contexto y el hook consumidor, para que
 * `App`, `LoginSkeleton`, `ChatSkeleton` y ambos shells (mobile/desktop) lean la MISMA sesión.
 *
 * - 'checking'      -> validando token persistido contra /me (splash inicial).
 * - 'anon'          -> sin token, o token inválido/expirado (401) -> mostrar LoginSkeleton.
 * - 'authed'        -> token válido + tenant habilitado -> mostrar ChatSkeleton.
 * - 'no-habilitada' -> token válido pero sin tenant (403) -> LoginSkeleton con aviso.
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
  /**
   * Por qué la sesión terminó, cuando terminó sola (CTA5). `undefined` en todos los demás casos —
   * arranque limpio, logout a pedido, credenciales mal tipeadas.
   *
   * Es **dato, no estado**: el estado real de una sesión expirada ya es `'anon'`, y lo que cambia es
   * el motivo, que sólo sirve para mostrarlo. Modelarlo como un `SessionStatus` nuevo obligaría a
   * cada `switch` de los dos shells a aprender un quinto valor para terminar comportándose igual que
   * con `'anon'` — más superficie tocada para expresar lo mismo. Decisión táctica de frontend,
   * reversible: si algún día el motivo tiene que cambiar el COMPORTAMIENTO y no sólo el texto, ahí
   * sí corresponde un status propio.
   */
  avisoSesion?: string;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

export const SessionContext = createContext<UseSessionResult | null>(null);

/** Consume la sesión compartida. Debe usarse dentro de `<SessionProvider>`. */
export function useSession(): UseSessionResult {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return ctx;
}
