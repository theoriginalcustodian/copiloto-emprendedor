import { useEffect, useRef } from 'react';

const CAMPO_EDITABLE = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

/**
 * Al montar una pantalla/paso, mueve el foco al PRIMER CAMPO EDITABLE del contenedor; si no hay
 * ninguno (detalle de solo lectura), al contenedor mismo (necesita `tabIndex={-1}`). Sin esto el
 * foco queda en BODY y desde ahí el teclado no llega a ningún lado: la pantalla se ve bien y el
 * estado de entrada no se preparó (misma familia que #1683 y SM-P13).
 *
 * Una vez por montaje: no le roba el foco al usuario cuando el componente re-renderiza.
 * `preventScroll` para no desplazar el contenedor de scroll al enfocar.
 */
export function useFocoAlMontar<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const destino = el.querySelector<HTMLElement>(CAMPO_EDITABLE) ?? el;
    destino.focus({ preventScroll: true });
  }, []);
  return ref;
}
