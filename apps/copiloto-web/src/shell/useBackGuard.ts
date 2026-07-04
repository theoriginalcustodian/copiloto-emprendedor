import { useEffect, useRef } from 'react';

/**
 * Botón "atrás" del navegador/OS (pedido del operador 2026-07-04): mientras haya overlays abiertos
 * (bottom-sheet y/o un tab distinto del default), "atrás" debe PELAR una capa de UI en vez de salir
 * de la app. Recién con todo cerrado, "atrás" sale (comportamiento nativo).
 *
 * Mecánica — sincroniza N "centinelas" en el history con `depth` (cuántas capas hay abiertas):
 *  - cuando `depth` sube, empuja centinelas (`history.pushState`);
 *  - un `popstate` del usuario (apretó atrás) saca el centinela de arriba y llama `onBack`, que
 *    cierra UNA capa → `depth` baja y el efecto reconcilia el resto;
 *  - cuando una capa se cierra por otra vía (scrim, botón), sobra un centinela: se consume con
 *    `history.back()`, marcando ese `popstate` como "programático" (`skipPop`) para no confundirlo
 *    con un atrás del usuario.
 *
 * `onBack` cambia de identidad entre renders (depende del estado del overlay) — se lee por ref para
 * que el listener de `popstate`, registrado una sola vez, siempre invoque la última versión.
 */
export function useBackGuard(depth: number, onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const sentinelsRef = useRef(0);
  const skipPopRef = useRef(0);

  // Reconciliá el número de centinelas en el history con `depth`.
  useEffect(() => {
    while (sentinelsRef.current < depth) {
      window.history.pushState({ ucBackGuard: true }, '');
      sentinelsRef.current += 1;
    }
    while (sentinelsRef.current > depth) {
      sentinelsRef.current -= 1;
      if ((window.history.state as { ucBackGuard?: boolean } | null)?.ucBackGuard) {
        skipPopRef.current += 1; // el popstate que dispare este back es de consumo, no del usuario
        window.history.back();
      }
    }
  }, [depth]);

  useEffect(() => {
    function handlePop() {
      if (skipPopRef.current > 0) {
        skipPopRef.current -= 1; // popstate de un back programático de consumo — ignorar
        return;
      }
      if (sentinelsRef.current > 0) {
        sentinelsRef.current -= 1; // el browser ya sacó el centinela de arriba
        onBackRef.current(); // pela una capa; `depth` baja y el efecto de arriba reconcilia
      }
    }
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);
}
