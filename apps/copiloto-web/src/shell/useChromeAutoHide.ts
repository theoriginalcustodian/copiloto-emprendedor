import { useCallback, useEffect, useRef, useState } from 'react';

/** Inactividad (ms) tras la cual el chrome se auto-oculta. */
const DEFAULT_IDLE_MS = 4000;

/**
 * Auto-hide del "chrome" del shell mobile: la tab-bar flotante y —en espejo— el composer, que al
 * ocultarse la barra se desliza al borde inferior (ver shell.css `.app-shell--tab-hidden`).
 * Interfaz limpia por defecto; los controles de abajo aparecen sólo cuando hacen falta.
 *
 * `hidden` converge desde: inactividad (timer), tap en el área de chat (`toggle`), y scroll/cambio
 * de tab (`setHidden`). Al mostrar se re-arma el timer de inactividad; al ocultar se cancela. El
 * mostrar viene SÓLO de tap/cambio de tab: el scroll únicamente OCULTA (ver MessageList) — mostrar
 * desde el scroll creaba un loop con el deslizamiento del composer.
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

  // Arranca visible y programa el primer auto-hide por inactividad.
  useEffect(() => {
    armIdle();
    return clearTimer;
  }, [armIdle, clearTimer]);

  return { hidden, setHidden, toggle };
}
