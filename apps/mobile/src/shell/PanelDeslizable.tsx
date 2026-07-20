/**
 * `PanelDeslizable` — el mecanismo del rediseño Z-Depth: dos capas de profundidad y el gesto que
 * mueve una sobre la otra.
 *
 *   - **Capa 0** (`fondo`, atrás): el escritorio de funciones. Estática, `inset:0`.
 *   - **Capa 1** (`children`, frente): la conversación, envuelta en `CristalVidrio nivel="conversacion"`.
 *     Se desliza vertical `translateY(0 → MAX)`: en 0 tapa todo (conversación full); arrastrada hacia
 *     abajo revela el escritorio detrás. El grab-handle superior queda siempre agarrable.
 *
 * El gesto = la metáfora: la conversación (lo que el agente/usuario tienen entre manos) está ADELANTE;
 * al deslizarla se descubre el escritorio archivado que hay detrás. Ver [[reference-design-tokens-glass]]
 * §Layout/capas Z y `docs/Implementacion_Desarrollo/2026-07-18_PLAN...` Tarea 2.4.
 *
 * Stack CONFIRMADO por el spike de Fase 1 (`spikes/panel-gesto/RESULT.md`): reanimated 4 +
 * gesture-handler corren el drag a 60fps/0% jank en el A21s (gama baja). El drag es GPU-barato.
 *
 * Detalles del diseño respetados: transición `none` mientras se arrastra (el dedo manda 1:1), y al
 * soltar `transform .42s cubic-bezier(.2,.8,.2,1)` (≈ `Easing.bezier(.2,.8,.2,1)`, 420ms) hacia el
 * borde más cercano según posición + velocidad. Un toque casi sin desplazamiento (`|Δ| < 5px`) hace
 * TOGGLE (abre/cierra), sin arrastrar.
 */
import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTema } from '../theme/ThemeProvider';
import { CristalVidrio } from '../theme/glass/CristalVidrio';
import { FondoIluminado } from '../theme/glass/FondoIluminado';

/** Alto del handle deslizable = una "card": barra + hint + margen chico (pedido operador 2026-07-18).
 *  Es lo ÚNICO que queda en pantalla cuando el panel baja (la tira de "Subir conversación"), así que
 *  debe ser delgada, del tamaño de una card del historial — NO se le hornea el inset de la status bar
 *  (eso engrosaba la tira de abajo con espacio muerto). La clearance de la status bar en el estado
 *  ARRIBA la da un spacer superior que COLAPSA a 0 al bajar (ver `estiloSpacer`). */
const ALTO_HANDLE = 56;
/**
 * 🔴 **El alto se MIDE, no se pregunta.** Antes esto era
 * `const { height: ALTO_PANTALLA } = Dimensions.get('window')`, y estaba mal por dos motivos que se
 * suman:
 *
 * 1. Con **edge-to-edge** (default del SDK) la app dibuja detrás de las barras del sistema, así que
 *    esta raíz ocupa la pantalla ENTERA — pero `Dimensions.get('window')` devuelve sólo el área útil,
 *    sin la barra de navegación. Medido en el SM-A217M: display `720x1600`, área de app `720x1448`.
 *    **152 px de diferencia**, que es exactamente lo que el vidrio no cubría.
 * 2. Se leía UNA vez al cargar el módulo, así que no seguía rotaciones ni cambios de insets.
 *
 * El síntoma tenía dos caras y una sola causa: por esa franja de abajo **asomaba el escritorio**
 * (la última card de "Actividad reciente", opaca, fuera del vidrio) y el **composer quedaba
 * levantado** del borde real de la pantalla. Un solo defecto explicando las dos cosas.
 *
 * Ahora el panel es `absoluteFill` (cubre la raíz exactamente, sea cual sea) y el recorrido sale del
 * `onLayout` de la raíz. `Dimensions` ya no participa: preguntarle el alto de la pantalla a la
 * pantalla equivocada es el mismo error de siempre, disfrazado de constante.
 */
const RECORRIDO_SIN_MEDIR = 0;
/** Curva del diseño al soltar: `.42s cubic-bezier(.2,.8,.2,1)`. */
const CONFIG_SNAP = { duration: 420, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };
const UMBRAL_TAP = 5;

export interface PanelDeslizableProps extends PropsWithChildren {
  /** Capa 0 — contenido de fondo (escritorio de funciones). */
  fondo: ReactNode;
  /**
   * Señal para SUBIR el panel desde afuera: cada vez que este número cambia, la conversación vuelve
   * a tapar la pantalla. Lo usa el tile de chat del escritorio.
   *
   * 🔴 Es un contador y no un booleano `abierto` a propósito. Con un booleano, el estado del panel
   * pasaría a vivir en dos lugares — el gesto del dedo y el prop — y habría que sincronizarlos en
   * cada arrastre; la primera divergencia deja el panel visualmente arriba con el prop diciendo
   * "abajo", y el siguiente tap va para el lado equivocado. Un contador sólo dice *"subilo ahora"*:
   * el dueño del estado sigue siendo el gesto, que es quien lo ve de verdad.
   */
  senalSubir?: number;
  testID?: string;
}

/**
 * 🔴 **Sin `bloqueado`/`hintBloqueado` a propósito (decisión D6, sprint mobile-first).** En DocuMed
 * este panel trababa el gesto entero mientras había una grabación clínica viva, para que el médico no
 * pudiera minimizar el HUD y olvidarse el micrófono abierto. Acá esa amenaza no existe: el dictado del
 * copiloto es un mensaje corto (no una consulta larga con captura en curso), así que no hay una
 * grabación que se pueda "dejar corriendo sin darse cuenta" al deslizar. Portar el guard sin la
 * amenaza que lo justifica sería ruido para el próximo lector — si el copiloto suma captura de audio
 * de larga duración en el futuro, este es el punto a revisar primero.
 */
export function PanelDeslizable({ fondo, children, senalSubir, testID }: PanelDeslizableProps) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  // 0 = abierto (conversación tapa todo) · RECORRIDO_MAX = abajo (revela el escritorio).
  const panelY = useSharedValue(0);
  const inicio = useSharedValue(0);
  /**
   * Recorrido real, medido con `onLayout` de la raíz. Vive en un shared value porque lo leen los
   * worklets del gesto (hilo de UI), no React.
   *
   * Arranca en 0 = "todavía no medí". Mientras valga 0, el gesto no puede bajar el panel: preferible
   * un panel que no se mueve durante el primer frame a uno que se desliza a una posición inventada.
   */
  const recorrido = useSharedValue(RECORRIDO_SIN_MEDIR);
  // Espejo en React del estado del panel, SÓLO para el texto del pull-hint (el template lo alterna).
  // Se actualiza vía `runOnJS` en cada snap; el drag en sí sigue 100% en el hilo de UI (no re-renderiza).
  const [panelAbajo, setPanelAbajo] = useState(false);

  const alternar = () => {
    'worklet';
    const max = recorrido.value;
    if (max <= 0) return; // sin medir todavía: no inventamos un destino
    const destino = panelY.value < max / 2 ? max : 0;
    panelY.value = withTiming(destino, CONFIG_SNAP);
    runOnJS(setPanelAbajo)(destino === max);
  };

  // Sube el panel cuando llega la señal. Se ignora el primer render (`senalSubir` inicial): montar
  // la pantalla no es un pedido de subir, y el panel ya arranca arriba.
  const senalPrevia = useRef(senalSubir);
  useEffect(() => {
    if (senalSubir === undefined || senalSubir === senalPrevia.current) return;
    senalPrevia.current = senalSubir;
    panelY.value = withTiming(0, CONFIG_SNAP);
    setPanelAbajo(false);
  }, [senalSubir, panelY]);

  const gesto = Gesture.Pan()
    .onStart(() => {
      inicio.value = panelY.value;
    })
    .onUpdate((e) => {
      // `none` mientras arrastra: seguimos el dedo 1:1, con clamp a [0, MAX].
      panelY.value = Math.min(Math.max(inicio.value + e.translationY, 0), recorrido.value);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationY) < UMBRAL_TAP) {
        // Toque casi sin desplazamiento → toggle.
        alternar();
        return;
      }
      const max = recorrido.value;
      if (max <= 0) return;
      // Snap al borde más cercano, sesgado por la velocidad del flick.
      const proyeccion = panelY.value + e.velocityY * 0.12;
      const destino = proyeccion > max / 2 ? max : 0;
      panelY.value = withTiming(destino, CONFIG_SNAP);
      runOnJS(setPanelAbajo)(destino === max);
    });

  const estiloPanel = useAnimatedStyle(() => ({ transform: [{ translateY: panelY.value }] }));
  // Clearance de la status bar SÓLO cuando el panel está arriba: el spacer mide `insets.top` con el
  // panel abierto y COLAPSA a 0 al bajar, así el handle cae debajo del reloj arriba pero la tira de
  // abajo queda del tamaño de una card, sin espacio muerto. El vidrio de la conversación sigue full-
  // bleed (tapa detrás de la status bar) — sólo el handle/hint respeta el inset.
  const estiloSpacer = useAnimatedStyle(() => ({
    // `Math.max(..., 1)`: con el recorrido todavía sin medir, `[0, 0]` como rango de entrada no es un
    // rango — `interpolate` no tiene con qué dividir y devuelve NaN, que en un `height` deja el
    // spacer roto justo en el primer frame.
    height: interpolate(
      panelY.value,
      [0, Math.max(recorrido.value, 1)],
      [insets.top, 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <View
      style={[styles.raiz, { backgroundColor: tema.color.fondo }]}
      testID={testID}
      // 🔴 La medida REAL de lo que el panel tiene que cubrir. Es la raíz de esta pantalla, así que
      // incluye lo que el edge-to-edge agrega y que `Dimensions.get('window')` no ve.
      onLayout={(e) => {
        recorrido.value = Math.max(e.nativeEvent.layout.height - ALTO_HANDLE, 0);
      }}
    >
      {/* Capas -1 y 0: lo que se ve, atenuado, a través del vidrio de la Capa 1. */}
      <View style={StyleSheet.absoluteFill}>
        {/* Capa -1 — zonas de luz del fondo (`--dm-phonebg`), lo más profundo. El escritorio (Capa 0) es
            transparente, así que este glow se ve detrás de él y, difuso, a través del vidrio de la Capa 1. */}
        <FondoIluminado />
        {/* Capa 0 — escritorio (fondo, estático). */}
        <View style={StyleSheet.absoluteFill}>{fondo}</View>
      </View>

      {/* Capa 1 — conversación en cristal, deslizable. */}
      <Animated.View style={[styles.panel, estiloPanel]}>
        <CristalVidrio nivel="conversacion" style={styles.cristal}>
          {/* Spacer de status bar (colapsa al bajar) — no intercepta toques. */}
          <Animated.View style={estiloSpacer} pointerEvents="none" />
          <GestureDetector gesture={gesto}>
            <View style={styles.zonaHandle} testID="panel-handle">
              <View style={[styles.barraHandle, { backgroundColor: tema.glass.pill }]} />
              {/* Pull-hint del template (mono 10px uppercase): alterna según el estado del panel. */}
              <Text
                testID="panel-hint"
                style={[styles.hint, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}
              >
                {panelAbajo ? 'Subir conversación' : 'Deslizá para ver funciones'}
              </Text>
            </View>
          </GestureDetector>
          {children}
        </CristalVidrio>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  // `absoluteFill` (top/right/bottom/left: 0) en vez de un alto fijo: el vidrio cubre EXACTAMENTE la
  // raíz, mida lo que mida. Con un alto tomado de `Dimensions` quedaba corto y por esa franja asomaba
  // el escritorio -- ver el comentario de `RECORRIDO_SIN_MEDIR` arriba.
  panel: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 3 },
  cristal: { flex: 1 },
  // Handle card-sized: barra + hint centrados con margen chico (pedido operador 2026-07-18).
  zonaHandle: { height: ALTO_HANDLE, alignItems: 'center', justifyContent: 'center', gap: 7 },
  // barra del handle (diseño: 44×5, radio 3).
  barraHandle: { width: 44, height: 5, borderRadius: 3 },
  hint: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.65 },
});
