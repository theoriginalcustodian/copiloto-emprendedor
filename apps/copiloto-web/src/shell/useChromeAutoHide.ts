import { useCallback, useEffect, useRef, useState } from 'react';

/** Inactividad (ms) tras la cual el chrome se auto-oculta. */
const DEFAULT_IDLE_MS = 4000;

/**
 * Auto-hide del "chrome" del shell mobile: la tab-bar flotante y —en espejo— el composer, que al
 * ocultarse la barra se desliza al borde inferior (ver shell.css `.app-shell--tab-hidden`).
 * Objetivo (pedido del operador 2026-07-04): interfaz limpia por defecto, los controles de abajo
 * aparecen sólo cuando hacen falta.
 *
 * El estado `hidden` converge desde tres vías:
 *  - **inactividad**: tras `idleMs` sin actividad → oculta.
 *  - **tap en el área de chat** (`toggle`): alterna mostrar/ocultar (el shell lo cablea al
 *    `MessageList`; evita el swipe-desde-el-borde que chocaría con el gesto nativo del OS).
 *  - **scroll del chat / cambio de tab** (`setHidden`): el `MessageList`/`AppShell` fuerzan el valor.
 * Al MOSTRAR por cualquier vía se re-arma el timer de inactividad; al OCULTAR se cancela.
 *
 * `setHidden`/`toggle` son estables (útil para pasarlos a hijos sin re-render). `hidden` se lee del
 * estado; un ref espejo (`hiddenRef`) permite que `toggle` calcule el próximo valor sin depender de
 * una closure vieja.
 */
export function useChromeAutoHide(idleMs: number = DEFAULT_IDLE_MS) {
  const [hidden, setHiddenState] = useState(false);
  const hiddenRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const armIdle = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      hiddenRef.current = true;
      setHiddenState(true);
    }, idleMs);
  }, [clearTimer, idleMs]);

  const apply = useCallback(
    (next: boolean) => {
      hiddenRef.current = next;
      setHiddenState(next);
      if (next) clearTimer();
      else armIdle();
    },
    [armIdle, clearTimer],
  );

  const setHidden = useCallback((next: boolean) => apply(next), [apply]);
  const toggle = useCallback(() => apply(!hiddenRef.current), [apply]);

  // Arranca VISIBLE (descubrible) y programa el primer auto-hide por inactividad.
  useEffect(() => {
    armIdle();
    return clearTimer;
  }, [armIdle, clearTimer]);

  return { hidden, setHidden, toggle };
}
