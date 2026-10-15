/**
 * `ScrollFormulario` — el área de scroll de cualquier pantalla con campos.
 *
 * Hace dos cosas que un `ScrollView` pelado no hace, y que el operador reportó como un solo problema
 * ("el teclado tapó la pantalla en vez de moverse hacia arriba… y como está casi en el fondo no se
 * puede scrollear para ver los campos", 2026-07-21):
 *
 *   1. **`keyboardShouldPersistTaps="handled"`** — con el teclado abierto, el primer toque sobre un
 *      botón lo consume el cierre del teclado y el botón no se aprieta. El usuario toca dos veces y
 *      cree que la app no responde. Mismo criterio que documed en su login.
 *   2. **Revela el campo enfocado.** React Native NO scrollea solo hasta el input que recibe el foco;
 *      con el teclado encima, el campo simplemente queda tapado. Acá cada campo avisa que se enfocó
 *      (`useRevelarCampo`, desde `CampoTexto`) y este componente calcula cuánto scrollear.
 *
 * 🔴 **La otra mitad del arreglo vive en `MarcoGlass`** (`KeyboardAvoidingView behavior="padding"`).
 * Sin ella este scroll no tendría a dónde ir: el teclado se dibuja ENCIMA sin achicar la ventana, así
 * que el contenido nunca desborda y el `ScrollView` no llega a ser scrolleable. Las dos mitades son
 * necesarias — con una sola, el síntoma no cambia.
 *
 * El `ScrollView` es el de `react-native-gesture-handler`, no el de `react-native`: la pantalla vive
 * dentro del `Pan` del vidrio, y mezclar un scroll de RN con gestos de RNGH deja dos árbitros
 * peleándose el mismo dedo (regla de "las dos mitades" de Software Mansion — `swmansion-rn-gestures`).
 */
import type { PropsWithChildren, ReactElement } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { Keyboard, StyleSheet, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { calcularDesplazamiento } from './revelarCampo';

/**
 * Lo mínimo que `ScrollFormulario` necesita de un campo para poder revelarlo. Se tipa así —y no como
 * `View`— para que un test pueda pasar un doble sin construir un árbol nativo.
 */
export interface NodoMedible {
  measureInWindow(callback: (x: number, y: number, ancho: number, alto: number) => void): void;
}

type Revelar = (nodo: NodoMedible | null | undefined) => void;

const noop: Revelar = () => {};
const ContextoRevelado = createContext<Revelar>(noop);

/**
 * Lo usa `CampoTexto` en su `onFocus`. Fuera de un `ScrollFormulario` devuelve un no-op: un campo
 * suelto (un diálogo, un test) tiene que seguir funcionando sin envolverse en nada.
 */
export function useRevelarCampo(): Revelar {
  return useContext(ContextoRevelado);
}

/**
 * Espera a que el teclado termine de abrir y el layout se reasiente antes de medir. Sin la demora, la
 * medición corre contra la altura VIEJA (el área todavía no se achicó) y el scroll se queda corto:
 * el campo sigue tapado y encima ya se movió, que es peor que no haber hecho nada. Los 120 ms son los
 * de documed, medidos en este mismo teléfono.
 */
const DEMORA_TECLADO_MS = 120;

/**
 * Margen tras `keyboardDidShow`: el `KeyboardAvoidingView` escucha ESE mismo evento para aplicar su
 * padding, y el layout se reasienta un frame después. Sirve para el segundo pasado del revelado.
 */
const DEMORA_POST_TECLADO_MS = 60;

export interface ScrollFormularioProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * El `RefreshControl` del tirón-para-actualizar, si la pantalla lo quiere. Va acá y no en un
   * wrapper porque `ScrollView` sólo lo acepta como prop propia.
   *
   * 🔴 **No le disputa el dedo al tirón que cierra el vidrio.** El `Pan` de `MarcoGlass` está montado
   * únicamente sobre la zona del handle (la barrita de arriba), no sobre el contenido — verificado en
   * `MarcoGlass.tsx`. Si algún día ese gesto se extendiera a toda la pantalla, los dos arrastres
   * hacia abajo pasarían a competir y habría que declarar la relación entre ambos explícitamente.
   */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Offset vertical en cada scroll (negativo = arrastre más allá del tope, en iOS). Lo usa el indicador del refresco. */
  onOffsetY?: (y: number) => void;
  testID?: string;
}

export function ScrollFormulario({
  children,
  style,
  contentContainerStyle,
  refreshControl,
  onOffsetY,
  testID,
}: ScrollFormularioProps) {
  const refScroll = useRef<ScrollView>(null);
  const refArea = useRef<View>(null);
  const offsetActual = useRef(0);

  // El último nodo que pidió revelarse, para repetir la medida cuando el teclado termina de abrir.
  const nodoPendiente = useRef<NodoMedible | null>(null);

  const medirYScrollear = useCallback((nodo: NodoMedible) => {
    const area = refArea.current;
    // `measureInWindow` es asíncrono y no se resuelve fuera de un device (en jsdom nunca llama al
    // callback). No hay nada que compensar acá: sin medidas, no se scrollea.
    area?.measureInWindow((_ax, areaY, _aAncho, areaAlto) => {
      nodo.measureInWindow((_x, campoY, _ancho, campoAlto) => {
        const destino = calcularDesplazamiento({
          areaY,
          areaAlto,
          campoY,
          campoAlto,
          offsetActual: offsetActual.current,
        });
        if (destino != null) refScroll.current?.scrollTo({ y: destino, animated: true });
      });
    });
  }, []);

  const revelar = useCallback<Revelar>(
    (nodo) => {
      if (nodo == null) return;
      nodoPendiente.current = nodo;
      setTimeout(() => medirYScrollear(nodo), DEMORA_TECLADO_MS);
    },
    [medirYScrollear]
  );

  // 🔴 Segunda pasada cuando el teclado YA abrió. La demora fija de arriba mide, a veces, contra el alto
  // VIEJO del área (la animación del teclado dura más que 120 ms): el scroll se queda corto y un grupo
  // alto —campo + su botón— sigue con la mitad detrás del teclado (medido en device, Mi día 15-10: el
  // campo entraba y «Agregar» no). Si el nodo ya se ve entero, `calcularDesplazamiento` devuelve `null`
  // y esta pasada no hace nada.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      const nodo = nodoPendiente.current;
      if (nodo == null) return;
      setTimeout(() => medirYScrollear(nodo), DEMORA_POST_TECLADO_MS);
    });
    // Al cerrarse el teclado el nodo deja de ser «el que se estaba revelando»: si no, un teclado abierto
    // después por OTRO input (fuera de este scroll) volvería a scrollear hacia un campo viejo.
    const subOculto = Keyboard.addListener('keyboardDidHide', () => {
      nodoPendiente.current = null;
    });
    return () => {
      sub.remove();
      subOculto.remove();
    };
  }, [medirYScrollear]);

  return (
    /**
     * `collapsable={false}`: en Android una `View` sin estilo propio se colapsa fuera del árbol
     * nativo como optimización, y entonces no tiene nodo que medir — `measureInWindow` no llamaría
     * nunca a su callback y el revelado sería un no-op silencioso.
     *
     * 🔴 El `flex:1` de esta `View` es SUYO y no se mezcla con el `style` que llega de afuera: ese
     * `style` es del `ScrollView` y ahí tiene que ir. La primera versión se lo pasaba al contenedor,
     * y el `ScrollView` se quedó sin altura acotada — creció con su contenido y **dejó de scrollear
     * por completo**. Los 277 tests pasaron igual: en jsdom no hay altura que acotar. Lo cazó el
     * device en el primer swipe.
     */
    <View ref={refArea} style={styles.area} collapsable={false}>
      <ContextoRevelado.Provider value={revelar}>
        <ScrollView
          ref={refScroll}
          testID={testID}
          style={style}
          contentContainerStyle={contentContainerStyle}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            offsetActual.current = e.nativeEvent.contentOffset.y;
            onOffsetY?.(e.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </ContextoRevelado.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1 },
});
