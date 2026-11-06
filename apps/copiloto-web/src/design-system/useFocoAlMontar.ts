import { useEffect, useRef } from 'react';

const CAMPO_EDITABLE = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

/**
 * Mueve el foco al PRIMER CAMPO EDITABLE del contenedor (o al contenedor mismo si no hay ninguno;
 * necesita `tabIndex={-1}`). Sin esto el foco queda en BODY y desde ahí el teclado no llega a
 * ningún lado: la pantalla se ve bien y el estado de entrada no se preparó (familia #1683 / SM-P13).
 *
 * Dos casos, explícitos:
 *  - **Pantalla/paso con los campos ya presentes al montar** (`listo` se omite → `true`): enfoca al
 *    montar. Una expansión (p. ej. «Cambiar contraseña») también es «montar»: el formulario se monta
 *    recién al expandir.
 *  - **Pantalla que carga datos antes de mostrar los campos**: pasá `listo={false}` mientras carga
 *    y `true` cuando el dato llegó y los campos están en el árbol. Enfocar antes no sirve (el campo
 *    no existe todavía y el foco no se prepara).
 *
 * Una sola vez por montaje: el primer `listo === true` enfoca; los re-renders posteriores no le
 * roban el foco al usuario. `preventScroll` para no desplazar el contenedor de scroll.
 */
export function useFocoAlMontar<T extends HTMLElement>(listo: boolean = true) {
  const ref = useRef<T>(null);
  const yaEnfocado = useRef(false);
  useEffect(() => {
    if (!listo || yaEnfocado.current) return;
    const el = ref.current;
    if (!el) return;
    yaEnfocado.current = true;
    const destino = el.querySelector<HTMLElement>(CAMPO_EDITABLE) ?? el;
    destino.focus({ preventScroll: true });
  }, [listo]);
  return ref;
}
