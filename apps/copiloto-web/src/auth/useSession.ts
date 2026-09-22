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

/**
 * BL-X10 — de dónde vino la sesión `'authed'` actual, para decidir splash (identidad, una vez por
 * ingreso) vs entrada diaria (cubre la carga). `'recien-autenticada'`: el usuario acaba de escribir
 * credenciales o volver de un callback OAuth — primer ingreso o post-logout, spec admite 6,8 s.
 * `'restaurada'`: el token ya estaba guardado al abrir la app — se ve 20+ veces por día, sólo 1,5 s.
 * Default `'restaurada'` porque es el camino más frecuente (arranques 2..n) y evita mostrar el
 * splash largo un instante antes de que el efecto de montaje corrija el valor real.
 */
export type OrigenSesion = 'restaurada' | 'recien-autenticada';

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
  origenSesion: OrigenSesion;
  /**
   * BL-X10/BL-X12w — cierre a PROPÓSITO (botón logout), gemelo de `cierreVoluntario` en mobile
   * (`modules/auth/useSession.ts`). Sólo se completa en `status === 'anon'`: si la sesión vuelve a
   * `'authed'` deja de describir nada (ver `SessionProvider`). `undefined` en el resto de los casos
   * — arranque limpio, sesión caída sola (CTA5) — esos van directo al formulario, no al reveal.
   */
  cierreVoluntario?: { email: string | null };
  /**
   * BL-X10 (fila 2) — `true` sólo en el arranque SIN token ni refresh guardado (nunca hubo sesión en
   * este dispositivo): el reveal de «primer ingreso» (`TEXTOS_REVEAL.primeraVez`) se muestra acá, no
   * en `cierreVoluntario` (eso es «volver»). `false` en el resto — sesión caída sola (CTA5) sigue
   * yendo directo al formulario, como antes.
   */
  primeraVez: boolean;
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
