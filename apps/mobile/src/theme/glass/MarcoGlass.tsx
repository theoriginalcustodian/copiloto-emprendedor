/**
 * `MarcoGlass` — el glass principal, reusado para las funciones.
 *
 * Orden del operador (2026-07-18): *"los glass de las funciones deben ser iguales exactamente que el
 * glass principal… las mismas características y zonas de desplazamiento… copiá directamente el glass
 * principal y usalo para el resto, no reinventes la rueda"*.
 *
 * Qué toma del canon (`canonGlass.ts`, la MISMA fuente que consume `PanelDeslizable`):
 *   - el mismo nivel de vidrio (`NIVEL_CANONICO`) → mismo blur, radio, borde y sombra;
 *   - **full-bleed**: sin `marginTop`, sin scrim. El vidrio ocupa la pantalla como el principal;
 *   - el mismo handle (`ALTO_HANDLE` 56, barra `BARRA_HANDLE`), y **agarrable de verdad**;
 *   - la misma curva de snap y el mismo umbral de toque.
 *
 * 🔴 **La zona de desplazamiento hace algo distinto acá, y tiene que hacerlo.** En el principal el
 * gesto revela el escritorio que vive DETRÁS, en la misma pantalla. Una función es una ruta encima,
 * así que "revelar lo de atrás" es literalmente cerrarla: arrastrar hacia abajo pasado el umbral hace
 * `router.back()`, y si no llega, el vidrio vuelve a su lugar con la misma curva. El gesto se siente
 * igual; lo que hay detrás es lo que cambia.
 *
 * 🔴 **El vidrio no se toca acá.** El look sale entero de `CristalVidrio nivel="conversacion"`, el
 * mismo del principal. Este marco aporta GEOMETRÍA (tamaño, handle, encabezado, gesto), nunca valores
 * de vidrio: se ajustan en un solo lugar y los heredan todas las superficies.
 *
 * 🔴 **Sin fondo propio.** Lo que se ve a través del vidrio es la pantalla que quedó abajo en el
 * stack, y por eso toda función tiene que entrar como `transparentModal`. Un fondo decorativo propio
 * produce dos bugs que ya se pagaron: queda quieto cuando el panel se desliza (la "estela" detrás del
 * vidrio al minimizar) y, en una pantalla que no es modal, duplica el escritorio encima del real.
 */
import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '../ThemeProvider';
import { CristalVidrio } from './CristalVidrio';
import { GlassIcon } from './GlassIcon';
import type { NombreIconoGlass } from './icons';
import { PRESS_FADE, pressableStyle } from './presion';
import { ALTO_HANDLE, BARRA_HANDLE, CONFIG_SNAP, NIVEL_CANONICO, UMBRAL_TAP } from './canonGlass';

// 🔴 Locales A PROPÓSITO, no duplicación por descuido. Se intentó centralizarlas en
// `canonGlass` y la app reventó en device con `ReferenceError: Property 'VELOCIDAD_FLICK'
// doesn't exist`: se leen DENTRO de un worklet de Reanimated, que corre en el runtime de UI
// y no resuelve bindings importados de otro módulo como lo hace el de JS. documed las tiene
// locales en cada archivo por la misma razón.
const CONFIG_SNAP_GESTO = { duration: 420, dampingRatio: 1, overshootClamping: true };
const VELOCIDAD_FLICK = 500;
const UMBRAL_CIERRE = 140;

/** Cuánto hay que arrastrar hacia abajo para que la función se cierre. */
/**
 * Velocidad (px/s) a partir de la cual el gesto es un **flick**: un lanzamiento con intención de
 * dirección, no un arrastre soltado donde quedó. Mismo umbral y misma razón que en
 * `PanelDeslizable` — ver el comentario de `VELOCIDAD_FLICK` allá, que trae la medición.
 *
 * 🔴 El criterio viejo proyectaba la posición 120 ms y la comparaba contra un umbral fijo. Con un
 * flick corto y rápido soltado cerca del tope, la proyección no llegaba y el vidrio **volvía
 * arriba** — el operador lo describió como *"amagan a volver pero luego siguen"*. Un lanzamiento
 * decidido hacia abajo tiene que cerrar, sin importar cuán poco se alcanzó a arrastrar.
 */
/**
 * Curva para cuando el movimiento **viene de un dedo**: un resorte que ARRANCA con la velocidad que
 * traía el gesto.
 *
 * 🔴 **Por qué no alcanza `withTiming` acá, que es la causa del defecto más difícil de esta sesión.**
 * `withTiming` no acepta velocidad inicial: ignora por completo cómo venía el movimiento y reinicia
 * con su propia curva, prácticamente desde cero. Si el dedo soltó el panel viajando a 3000 px/s, el
 * panel **frena en seco** y vuelve a acelerar. Eso, en un instante, se percibe como un retroceso —
 * el operador lo describió como *"amaga a volver, pero luego sigue"*.
 *
 * `dampingRatio: 1` es amortiguamiento crítico: llega al destino sin rebote, que en un panel importa
 * (un overshoot lo haría pasarse del borde). `duration` mantiene los .42s del diseño, así que la
 * sensación de tiempo no cambia — lo que cambia es que el arranque **empalma** con el dedo en vez de
 * cortarlo. Ver `swmansion-rn-gestures/continuous-gestures.md` §"Fling with Decay".
 */

export interface MarcoGlassProps extends PropsWithChildren {
  /** El nombre de la función, tal como figura en su ícono del escritorio. */
  titulo: string;
  /** El mismo glifo del tile de entrada: entrar por un ícono y llegar a otro desorienta. */
  icono: NombreIconoGlass;
  /**
   * Reemplaza el encabezado (ícono + título + Volver) y el handle por el contenido crudo. Lo usa el
   * HUD de grabación: durante una captura viva no puede haber ni salida por gesto ni "Volver" — se
   * sale por Detener/Descartar, y sólo por ahí.
   */
  desnudo?: boolean;
  /** Contenido extra fijo bajo el encabezado, fuera del área de scroll del hijo. */
  encabezadoExtra?: ReactNode;
  testID?: string;
}

export function MarcoGlass({ titulo, icono, desnudo, encabezadoExtra, testID, children }: MarcoGlassProps) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const panelY = useSharedValue(0);
  const inicio = useSharedValue(0);
  /**
   * Alto real de esta pantalla, medido con `onLayout`. Lo necesita el cierre para saber hasta dónde
   * seguir bajando el vidrio antes de navegar. Se mide en vez de preguntarle a `Dimensions` por la
   * misma razón que en `PanelDeslizable`: con edge-to-edge, `Dimensions.get('window')` devuelve el
   * área útil y no la pantalla entera, y además no sigue rotaciones.
   *
   * Arranca en 0 = "todavía no medí". Mientras valga 0 el cierre usa el camino de siempre, que es
   * peor pero nunca inventa una distancia.
   */
  const altoPantalla = useSharedValue(0);

  /**
   * 🔴 **El `useMemo` no es una optimización: Gesture Handler v2 lo exige.** Sin él se construye un
   * objeto de gesto NUEVO en cada render y `GestureDetector` re-adjunta el recognizer, que pierde su
   * estado. Si eso pasa con el dedo apoyado, `translationY` vuelve a 0 mientras `inicio.value` sigue
   * marcando dónde empezó el arrastre: el vidrio vuelve de golpe a su punto de partida y sigue.
   *
   * **`MarcoGlass` envuelve pantallas con estado vivo** (grabación, cronómetro, onda), y cada update
   * de ese estado re-renderiza este componente; sin memo, reconstruye el gesto en pleno arrastre.
   *
   * `cerrar` va en un `useCallback` y no suelto: el botón de cerrar del encabezado también lo usa,
   * así que no puede vivir dentro del memo. Si se recreara en cada render invalidaría el memo cada
   * vez y el `useMemo` no serviría de nada — memoizar sin memoizar, que es la forma más común de
   * creer que uno memoizó. `router` de expo-router es un singleton estable, así que no lleva deps.
   */
  const cerrar = useCallback(() => router.back(), []);
  const gesto = useMemo(() => {
    return Gesture.Pan()
      // `onBegin` (al APOYAR el dedo) y no `onStart` (al activarse el recognizer, ya pasado su
      // umbral): es el patrón que documenta Software Mansion. Con `onStart` el primer `onUpdate`
      // llega con el umbral ya acumulado en `translationY` y el vidrio arranca de un saltito.
      .onBegin(() => {
        inicio.value = panelY.value;
      })
      .onUpdate((e) => {
        // Sólo hacia abajo: arrastrar hacia arriba no tiene a dónde ir (el vidrio ya ocupa la pantalla).
        panelY.value = Math.max(inicio.value + e.translationY, 0);
      })
      .onEnd((e) => {
        // 🔴 **Un lanzamiento rápido NO es un toque, por poco que se haya desplazado.** El chequeo
        // miraba sólo `translationY`, y un flick corto y veloz llega acá con el desplazamiento casi
        // en cero: el dedo se levanta antes de que el gesto acumule recorrido. Un toque de verdad es
        // quieto en AMBAS cosas: poco desplazamiento **y** poca velocidad.
        if (Math.abs(e.translationY) < UMBRAL_TAP && Math.abs(e.velocityY) < VELOCIDAD_FLICK) {
          panelY.value = withTiming(0, CONFIG_SNAP);
          return;
        }
        // Un flick decide por DIRECCIÓN; sin flick, decide cuánto se arrastró. Mismo criterio que el
        // panel del chat: mezclar ambas cosas en una proyección hacía que un lanzamiento claro hacia
        // abajo terminara volviendo arriba.
        const hayFlick = Math.abs(e.velocityY) > VELOCIDAD_FLICK;
        const cierra = hayFlick ? e.velocityY > 0 : panelY.value > UMBRAL_CIERRE;
        if (cierra) {
          // 🔴 **Por qué se anima el cierre en vez de navegar directo.** Llamar `runOnJS(cerrar)()`
          // sin animar el vidrio lo deja congelado en el aire donde se soltó, mientras el mensaje
          // cruza al hilo de JS, `expo-router` desmonta la pantalla y arranca su propia transición —
          // se percibe como que el gesto "se detiene apenas levantás el dedo y luego continúa".
          // Ahora el vidrio sigue bajando hasta salir de pantalla en el hilo de UI, sin cruzar a JS,
          // y se navega recién cuando la animación TERMINÓ. El movimiento nunca se interrumpe.
          const salida = altoPantalla.value > 0 ? altoPantalla.value : panelY.value;
          panelY.value = withSpring(
            salida,
            { ...CONFIG_SNAP_GESTO, velocity: e.velocityY },
            (finished) => {
              if (finished) runOnJS(cerrar)();
            }
          );
          return;
        }
        panelY.value = withSpring(0, { ...CONFIG_SNAP_GESTO, velocity: e.velocityY });
      });
  }, [panelY, inicio, cerrar, altoPantalla]);

  const estiloPanel = useAnimatedStyle(() => ({ transform: [{ translateY: panelY.value }] }));

  return (
    <View
      style={styles.raiz}
      // La medida que usa el cierre para saber hasta dónde bajar el vidrio antes de navegar.
      onLayout={(e) => {
        altoPantalla.value = e.nativeEvent.layout.height;
      }}
    >
      {/* 🔴 Nada de fondo propio acá. El vidrio es semitransparente y la ruta es un `transparentModal`,
          así que lo que se ve a través ES la pantalla de abajo, la de verdad.
          Montar un escritorio decorativo propio (como se hizo mientras el vidrio llevaba blur) causaba
          dos bugs a la vez: al deslizar el panel, ese fondo quedaba QUIETO y aparecía detrás — la
          "estela" que el operador vio; y en Ajustes duplicaba el escritorio encima del real. */}
      <Animated.View style={[styles.panel, estiloPanel]}>
        {/* `desnudo` = grabación viva → vidrio `takeover`, OPACO. Es la única superficie opaca de la
            app, y es correcto: no es una hoja sobre el escritorio, es "el teléfono está grabando".
            El HUD no tiene tarjetas que tapen (cronómetro, onda y controles son textos sueltos), así
            que con el vidrio normal el escritorio se lee entero detrás y parece roto. Ver la tabla de
            niveles en `CristalVidrio`, que es donde viven los valores de vidrio — nunca acá. */}
        <CristalVidrio nivel={desnudo ? 'takeover' : NIVEL_CANONICO} style={styles.cristal} testID={testID}>
          {desnudo ? (
            children
          ) : (
            /**
             * 🔴 `behavior="padding"` en AMBAS plataformas — no el `ios: padding / android: height`
             * de manual. Sin esto el teclado TAPA los campos de abajo y no hay forma de llegar a
             * ellos: el operador quedó sin poder ver lo que escribía en el alta de ARCA (2026-07-21).
             *
             * documed lo midió en ESTE MISMO teléfono (SM-A217M, ChatView.tsx:207): al enfocar un
             * input, la ventana **no** se redimensiona ni se desplaza — el teclado se dibuja ENCIMA.
             * Eso descarta `height` (que asume una ventana que sí achicó) y descarta confiar en
             * `adjustResize`: una función vive dentro de un `transparentModal` a pantalla completa,
             * que ocupa el alto entero pase lo que pase. Sin que el contenedor se achique, el
             * `ScrollView` del hijo nunca desborda, así que **tampoco se vuelve scrolleable** — que
             * es exactamente el segundo síntoma reportado ("no se puede scrollear para ver los campos").
             *
             * `padding` reserva abajo el alto del teclado → el área del contenido se achica → el
             * scroll del hijo pasa a tener a dónde ir. Va acá, en el marco, y no en cada pantalla:
             * toda función que tenga un formulario hereda el arreglo (facturación tiene cuatro pasos
             * con campos). El `KeyboardAvoidingView` sin teclado abierto no agrega nada, así que las
             * funciones sin inputs no cambian en nada.
             */
            <KeyboardAvoidingView behavior="padding" style={styles.contenido}>
              {/* Clearance de la status bar: el vidrio es full-bleed (tapa detrás del reloj), sólo el
                  contenido respeta el inset. Igual que el principal. */}
              <View style={{ height: insets.top }} pointerEvents="none" />
              <GestureDetector gesture={gesto}>
                <View style={styles.zonaHandle} testID="glass-handle">
                  <View style={[styles.barraHandle, { backgroundColor: tema.glass.pill }]} />
                </View>
              </GestureDetector>

              <View style={[styles.encabezado, { paddingHorizontal: tema.espacio.md }]}>
                <View style={[styles.identidad, { gap: tema.espacio.sm }]}>
                  <GlassIcon name={icono} size={28} />
                  <Text
                    testID="glass-titulo"
                    style={{ color: tema.color.texto, fontSize: tema.tipo.titulo, fontFamily: tema.fuente.uiBold }}
                  >
                    {titulo}
                  </Text>
                </View>
                {/* `PRESS_FADE` y no `PRESS_SCALE`: es un link de texto suelto, sin caja propia que
                    pueda hundirse. Encogerlo sólo movería el texto respecto del título de al lado. */}
                <Pressable
                  testID="glass-volver"
                  onPress={cerrar}
                  hitSlop={12}
                  style={pressableStyle(undefined, PRESS_FADE)}
                >
                  <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiSemibold }}>Volver</Text>
                </Pressable>
              </View>
              {encabezadoExtra}
              {children}
            </KeyboardAvoidingView>
          )}
        </CristalVidrio>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  panel: { flex: 1 },
  cristal: { flex: 1 },
  // El `KeyboardAvoidingView` ocupa el vidrio entero: es el que se achica cuando entra el teclado.
  contenido: { flex: 1 },
  zonaHandle: { height: ALTO_HANDLE, alignItems: 'center', justifyContent: 'center' },
  barraHandle: { ...BARRA_HANDLE },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  identidad: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
});
