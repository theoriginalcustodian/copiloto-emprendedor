import { useCallback, useState } from 'react';

/**
 * Show/hide del "chrome" del shell mobile: la tab-bar flotante y —en espejo— el composer, que al
 * ocultarse la barra se desliza al borde inferior (ver shell.css `.app-shell--tab-hidden`).
 * Interfaz limpia cuando hace falta, controles a un tap de distancia.
 *
 * `hidden` cambia SÓLO por acción del usuario: tap en el área de chat (`toggle`), hide-on-scroll con
 * el dedo apoyado (`setHidden`, ver MessageList) y cambio de tab (`setHidden(false)`). NO hay
 * auto-ocultado por inactividad: escondía la barra sin que el usuario hiciera nada y, como queda con
 * `pointer-events:none` fuera de pantalla, el primer toque sobre un botón de abajo (ej. "Apps") lo
 * comía la superficie del chat como "tap para revelar" -> obligaba a un doble-tap (bug 2026-07-04,
 * "solo la primera vez"). Sin idle-hide la barra queda visible salvo que el usuario scrollee, así que
 * los botones de abajo responden al primer toque.
 */
export function useChromeAutoHide() {
  const [hidden, setHidden] = useState(false);
  // `setHidden` (dispatch de useState) es estable; `toggle` usa updater funcional para no capturar un
  // `hidden` viejo. No hace falta ref ni timer.
  const toggle = useCallback(() => setHidden((prev) => !prev), []);

  return { hidden, setHidden, toggle };
}
