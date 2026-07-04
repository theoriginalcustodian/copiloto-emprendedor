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
