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
 *
 * El timer de inactividad es **declarativo**: una función pura de `hidden`. Mientras el chrome está
 * VISIBLE (`hidden=false`) SIEMPRE hay un timeout pendiente que lo oculta tras `idleMs` → el composer
 * vuelve a bajar solo pase lo que pase (imposible que quede trabado arriba — el bug reportado). Al
 * ocultarse no hay timer. Cualquier vía que vuelva a mostrar el chrome (tap, scroll, cambio de tab,
 * cierre del sheet) re-dispara este efecto y re-arma el auto-hide. `setHidden`/`toggle` son estables
 * (para pasarlos a hijos sin re-render); `hiddenRef` es el espejo síncrono que usa `toggle`.
 */
export function useChromeAutoHide(idleMs: number = DEFAULT_IDLE_MS) {
  const [hidden, setHiddenState] = useState(false);
  const hiddenRef = useRef(false);

  const apply = useCallback((next: boolean) => {
    hiddenRef.current = next;
    setHiddenState(next);
  }, []);

  const setHidden = useCallback((next: boolean) => apply(next), [apply]);
  const toggle = useCallback(() => apply(!hiddenRef.current), [apply]);

  useEffect(() => {
    if (hidden) return;
    const id = setTimeout(() => {
      hiddenRef.current = true;
      setHiddenState(true);
    }, idleMs);
    return () => clearTimeout(id);
  }, [hidden, idleMs]);

  return { hidden, setHidden, toggle };
}
