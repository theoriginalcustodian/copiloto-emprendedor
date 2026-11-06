/**
 * SM-P16 — arrastre del panel desde el CUERPO (contrato 2026-11-05 `arrastre-desde-el-cuerpo-mi-dia`).
 *
 * El cuerpo del panel es la conversación (`ListaMensajes`, un `FlatList` con su propio scroll). Para que un
 * arrastre hacia abajo desde cualquier punto del chat baje el panel SIN quitarle el scroll a la lista, el panel
 * necesita saber una sola cosa de ella: si está en su tope. Esa es la costura, y viaja por este contexto:
 * `ListaMensajes` la ESCRIBE (`onScroll`), `PanelDeslizable` la LEE en el hilo de UI.
 *
 * Fuera de un panel (Soporte, tests aislados) no hay proveedor: el contexto vale `null` y la lista no hace nada.
 *
 * 🔴 La decisión del gesto (`decidirArrastreCuerpo`) vive en `PanelDeslizable.tsx`, no acá: se ejecuta dentro de
 * un worklet y un worklet no resuelve bindings importados de otro módulo (ver el comentario de `VELOCIDAD_FLICK`).
 */
import { createContext } from 'react';
import type { MutableRefObject } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export interface ArrastreCuerpo {
  /** `true` cuando la lista está en su tope (o no scrolleó todavía): ahí un arrastre hacia abajo es del panel. */
  enTope: SharedValue<boolean>;
  /**
   * Ref al Pan del cuerpo (`Gesture.Pan().withRef(...)`). La lista la pasa como `simultaneousHandlers` a su
   * `FlatList`: criterio «Pan dentro de ScrollView» de `swmansion-rn-gestures/gesture-composition.md` — sin eso el
   * scroll nativo cancela al Pan y el arrastre desde el cuerpo nunca se activa.
   *
   * 🔴 La relación se declara DESDE LA LISTA y no desde el Pan (`simultaneousWithExternalGesture(refLista)`) a
   * propósito: RNGH 2.32 resuelve un ref a tag con `ref.current?.handlerTag` (`GestureDetector/utils.ts:55`) y el
   * `ref` de un `FlatList` de RNGH apunta al `FlatList` de RN, que NO tiene `handlerTag` (lo tiene el `ScrollView`
   * interno). Del lado del Pan la simultaneidad se resolvía a -1 y se descartaba en silencio: medido en device, el
   * Pan recibía `touchDown` y ningún `touchMove` (el scroll lo cancelaba).
   */
  refGestoCuerpo: MutableRefObject<unknown>;
}

export const ArrastreCuerpoContext = createContext<ArrastreCuerpo | null>(null);

/** Holgura (px) del scroll para considerar «en el tope»: absorbe el redondeo del `contentOffset`. */
export const TOLERANCIA_TOPE = 1;
