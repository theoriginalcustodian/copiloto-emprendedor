import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'desktop';

/**
 * Breakpoint único del cliente (DESIGN-SYSTEM-EXTRACT-WEB.md §7 #7: ningún mock fija un valor —
 * `[ASSUMED_PENDING_VERIFY]` en el doc, con 900px como la inferencia razonada: el rail necesita
 * ese ancho para no competir con el `max-width:900px` del grid de Conexiones). Se resuelve por
 * ANCHO DE VIEWPORT, no por user-agent/device — mismo criterio "theme-aware por CSS vars, no por
 * detección de plataforma" que ya rige el resto del design-system.
 */
export const DESKTOP_MEDIA_QUERY = '(min-width: 900px)';

function resolveBreakpoint(): Breakpoint {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'mobile';
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches ? 'desktop' : 'mobile';
}

/**
 * Hook reactivo mobile↔desktop. Usa `matchMedia` + su evento `change` (no `resize` con debounce
 * manual) — es el mecanismo nativo pensado exactamente para esto, ya usado en tests existentes del
 * repo (`AppShell.test.tsx` mockea `window.matchMedia`).
 *
 * `addEventListener('change', ...)` es el API moderno; algunos entornos (Safari viejo, ciertos
 * mocks de test) solo exponen el legacy `addListener` — fallback defensivo para no romper ahí.
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => resolveBreakpoint());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);

    const handleChange = () => setBreakpoint(mql.matches ? 'desktop' : 'mobile');
    // Re-sincroniza al montar: `resolveBreakpoint()` en el `useState` inicial ya lo hizo, pero si
    // el mock de test reemplaza `matchMedia` DESPUÉS del primer render (algunos setups lo hacen en
    // `beforeEach`), este efecto es quien realmente aplica el valor correcto.
    handleChange();

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    // Fallback legacy (deprecated pero todavía presente en algunos entornos/mocks).
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, []);

  return breakpoint;
}
