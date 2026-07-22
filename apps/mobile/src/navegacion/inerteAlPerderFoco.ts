import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * **Una pantalla que quedó DEBAJO de otra no puede seguir siendo tocable por el lector de pantalla.**
 *
 * 🔴 **El bug que cierra, medido por backend en el árbol de accesibilidad (no en una captura):** con
 * el formulario de alta de cliente abierto, `uiautomator` encontró los seis tiles del escritorio
 * **presentes y nombrados** —*Facturación · Ingresos · Gastos · Presupuestos · Clientes · Mi día*—.
 * Con TalkBack, alguien completando el formulario puede recorrerlos y **activarlos**: no es que se
 * lean de fondo, es que están **vivos**. Un toque ahí navega a otra función desde adentro de un
 * formulario a medio llenar.
 *
 * 🔴 **Por qué pasa acá y no en una app común:** las funciones entran como `transparentModal`, así que
 * el escritorio de atrás **sigue montado a propósito** (es lo que se ve a través del vidrio). Esa
 * decisión es correcta para lo visual y **no lo es para la accesibilidad**: el árbol de accesibilidad
 * no sabe nada de opacidad, y un elemento tapado por un vidrio traslúcido le parece perfectamente
 * disponible. Lo visual y lo accesible se separaron sin que nadie lo decidiera.
 *
 * 🔵 **Y apareció como consecuencia de haberlo arreglado a medias.** Hasta que los controles tuvieron
 * nombre, el fondo tampoco era navegable —porque *nada* lo era—, así que el problema no existía en la
 * práctica: quedó **destapado** al ponerle nombres a todo. Es la forma habitual de la deuda de
 * accesibilidad: se arregla una capa y la siguiente recién ahí se vuelve visible.
 *
 * ⚠️ **Las dos plataformas necesitan props DISTINTAS y hay que poner las dos.** `accessibilityElements
 * Hidden` sólo lo mira iOS; `importantForAccessibility` sólo Android. Poner una sola deja la mitad de
 * los usuarios con el bug intacto — y como cada plataforma ignora en silencio la que no es suya, la
 * que falta no da ningún error.
 */
export interface PropsInercia {
  /** iOS: los descendientes desaparecen del árbol de accesibilidad. */
  accessibilityElementsHidden: boolean;
  /** Android: idem. `auto` = comportamiento normal. */
  importantForAccessibility: 'auto' | 'no-hide-descendants';
}

/**
 * El mapeo, aparte del hook **para poder probar las dos direcciones**.
 *
 * No es una separación decorativa: con el hook solo, un test únicamente puede montar la pantalla
 * *enfocada* —simular el blur pide un contenedor de navegación real, que estos tests no tienen—, así
 * que el caso que importa (**perdió el foco → inerte**) quedaría sin cubrir y el gate pasaría igual si
 * la inercia nunca se aplicara. Con la función pura, la decisión se verifica de los dos lados.
 */
export function propsDeInercia(enfocada: boolean): PropsInercia {
  return {
    accessibilityElementsHidden: !enfocada,
    importantForAccessibility: enfocada ? 'auto' : 'no-hide-descendants',
  };
}

/**
 * Para la raíz de una pantalla que puede quedar debajo de otra. Se esparce en la `View` de más afuera:
 * oculta **el subárbol entero**, así que no hay que acordarse de nada por elemento.
 *
 * El default es `true` (activa) a propósito: si el foco nunca se resolviera, la pantalla queda
 * **usable**. La dirección del default importa — un fallo que deja media app inaccesible al lector de
 * pantalla es mucho peor que uno que deja de más lo que ya estaba de más.
 */
export function useInerteAlPerderFoco(): PropsInercia {
  const [enfocada, setEnfocada] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setEnfocada(true);
      return () => setEnfocada(false);
    }, []),
  );

  return propsDeInercia(enfocada);
}
