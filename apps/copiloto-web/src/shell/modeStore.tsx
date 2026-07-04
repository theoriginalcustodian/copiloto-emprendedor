import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * "Modo por app" (Feature addendum 2026-07-03, `docs/copiloto-emprendedor/2026-07-03-cliente-
 * feature-modos-por-app.md`) — estado GLOBAL compartido entre `modules/apps/AppsScreen` (setea el
 * modo al tocar un servicio conectado) y `modules/chat/Composer` (lo lee para adaptar el
 * placeholder/mostrar el chip + incluir `mode.key` en cada `POST /chat`). Mismo patrón que
 * `auth/SessionProvider` + `auth/useSession`: una fuente ÚNICA de verdad vía Context — un
 * `useState` propio por componente reproduciría el bug ya documentado en `SessionProvider.tsx`
 * (instancias desincronizadas que no se enteran una de la otra).
 *
 * Guarda el objeto COMPLETO (`key`/`label`/`category`), no solo la key: el snapshot se toma UNA
 * vez en `AppsScreen`, en el momento en que el usuario tiene el `CatalogService` a mano. Así
 * `Composer` no necesita volver a pedir `/catalog` para mostrar "Modo Mail" ni para elegir el hint
 * de placeholder por dominio — cero acoplamiento a `modules/connections` y cero fetch duplicado.
 *
 * Efímero de sesión (spec §2: "no hace falta localStorage; el modo es efímero de sesión") — se
 * pierde al recargar la página, a diferencia del `session_id` del chat (que sí persiste).
 */
export interface ActiveMode {
  /** = `CatalogService.key` — lo único que viaja en el contrato `POST /chat` (`mode`). */
  key: string;
  /** = `CatalogService.work_label` (label corto de acción, ej. "Mail"/"Cobrar") — copy del chip y
   * del placeholder adaptado del composer. */
  label: string;
  /** = `CatalogService.category` — hint de placeholder por dominio en `Composer` (ver
   * `CATEGORY_HINT` ahí); NO un identificador de servicio puntual, así que degrada con gracia a
   * cualquier categoría nueva sin tocar este archivo. */
  category: string;
}

export interface UseModeResult {
  /** Modo activo, o `null` en modo general (default). */
  mode: ActiveMode | null;
  /** Activa un modo — reemplaza el anterior sin acumular (spec §3.2: uno solo a la vez). */
  setMode: (mode: ActiveMode) => void;
  /** Vuelve a modo general (spec §3.3: tocar la ✕ del chip, o el mismo botón activo). */
  clearMode: () => void;
}

const ModeContext = createContext<UseModeResult | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ActiveMode | null>(null);

  const setMode = useCallback((next: ActiveMode) => setModeState(next), []);
  const clearMode = useCallback(() => setModeState(null), []);

  const value = useMemo<UseModeResult>(
    () => ({ mode, setMode, clearMode }),
    [mode, setMode, clearMode],
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

/** Consume el modo activo compartido. Debe usarse dentro de `<ModeProvider>`. */
export function useMode(): UseModeResult {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode debe usarse dentro de <ModeProvider>');
  return ctx;
}
