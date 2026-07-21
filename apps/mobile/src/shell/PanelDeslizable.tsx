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
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTema } from '../theme/ThemeProvider';
import { CONFIG_SNAP_GESTO, VELOCIDAD_FLICK } from '../theme/glass/canonGlass';
import { CristalVidrio } from '../theme/glass/CristalVidrio';
import { FondoIluminado } from '../theme/glass/FondoIluminado';

/** Alto del handle deslizable = una "card": barra + hint + margen chico (pedido operador 2026-07-18).
 *  Es lo ÚNICO que queda en pantalla cuando el panel baja (la tira de "Subir conversación"), así que
 *  debe ser delgada, del tamaño de una card del historial — NO se le hornea el inset de la status bar
 *  (eso engrosaba la tira de abajo con espacio muerto). La clearance de la status bar la da un
 *  spacer superior FIJO, y el recorrido se acorta en esa misma cantidad (ver `estiloSpacer`). */
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
/** Curva del diseño cuando el movimiento NO viene de un dedo: `.42s cubic-bezier(.2,.8,.2,1)`. */
const CONFIG_SNAP = { duration: 420, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };
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
const UMBRAL_TAP = 5;
/**
 * Velocidad (px/s) a partir de la cual el gesto se considera un **flick**: un lanzamiento con
 * intención de dirección, no un arrastre que se soltó donde quedó.
 *
 * 🔴 **Por qué existe.** El snap decidía el destino proyectando la posición 120 ms hacia adelante y
 * comparándola contra la mitad del recorrido. Ese criterio le da todo el peso a la POSICIÓN y casi
 * ninguno a la INTENCIÓN, y se rompe justo donde más se nota: un flick corto y rápido disparado
 * cerca de un borde nunca llega a cruzar la mitad, por decidido que sea.
 *
 * El criterio canónico de cualquier bottom sheet separa las dos preguntas: si hubo flick, manda la
 * DIRECCIÓN del flick; si no lo hubo, manda el borde más cercano. 500 px/s es el umbral habitual —
 * bien por encima del arrastre lento (que ronda los 0-300) y bien por debajo de un flick real (que
 * en las mediciones dio entre 1000 y 5500).
 */

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

  /**
   * ⚠️ **NO agregar un writer de `panelY` atado al foco (`useFocusEffect`).** Se probó (2026-07-20)
   * para arreglar un supuesto "panel clavado al volver de un glass", y CLAVÓ el chat principal: metía
   * un tercer dueño que pisaba `panelY` en cada foco (o sea en cada apertura/cierre de glass), leyendo
   * `recorrido`/`panelAbajo` que podían estar sin actualizar, y peleando con el gesto. El "clavado al
   * volver" que decía arreglar no existía: `PanelDeslizable` NO se desmonta cuando se abre un glass
   * (el glass se monta encima), así que `panelY` conserva su valor y el panel queda donde se dejó.
   *
   * 🔴 **Invariante: `panelY` tiene exactamente dos dueños — el gesto y `senalSubir`.** Cualquier
   * tercer writer (foco, layout, un efecto de sincronización) reintroduce la carrera. Si vuelve a
   * aparecer un desajuste real al navegar, se instrumenta y se busca la causa; NO se agrega otro
   * writer sobre este shared value.
   */

  // Sube el panel cuando llega la señal. Se ignora el primer render (`senalSubir` inicial): montar
  // la pantalla no es un pedido de subir, y el panel ya arranca arriba.
  const senalPrevia = useRef(senalSubir);
  useEffect(() => {
    if (senalSubir === undefined || senalSubir === senalPrevia.current) return;
    senalPrevia.current = senalSubir;
    // Mismo criterio que el snap del gesto: el estado se actualiza cuando la animación TERMINA,
    // para no commitear el árbol de React mientras el panel se está moviendo.
    panelY.value = withTiming(0, CONFIG_SNAP, (finished) => {
      if (finished) runOnJS(setPanelAbajo)(false);
    });
  }, [senalSubir, panelY]);

  // 🔴 **El `useMemo` no es una optimización: Gesture Handler v2 lo exige.** Sin él se construye un
  // objeto de gesto NUEVO en cada render y `GestureDetector` re-adjunta el recognizer, que pierde su
  // estado. Si eso ocurre con el dedo apoyado, `translationY` vuelve a 0 mientras `inicio.value`
  // sigue marcando dónde empezó el arrastre, así que `inicio + translationY` devuelve el panel a su
  // punto de partida por un instante — el defecto se percibe como "el panel salta, se maximiza y
  // sigue bajando".
  //
  // `alternar` vive DENTRO del memo a propósito: si quedara afuera se recrearía en cada render y,
  // como dependencia, invalidaría el memo en cada render — o sea el `useMemo` no serviría de nada,
  // que es la forma más común de "memoizar" sin memoizar. Sólo usa shared values y `setPanelAbajo`,
  // todos estables, así que no necesita estar afuera.
  //
  // Las dependencias son todas shared values estables (`useSharedValue` devuelve el mismo objeto
  // entre renders), así que el gesto se construye UNA sola vez.
  const gesto = useMemo(() => {
    const alternar = () => {
      'worklet';
      const max = recorrido.value;
      if (max <= 0) return; // sin medir todavía: no inventamos un destino
      const destino = panelY.value < max / 2 ? max : 0;
      // 🔴 `setPanelAbajo` va en el CALLBACK de la animación, no al lado. Llamarlo acá al lado
      // dispara un render de React en pleno snap, y un render es un commit del shadow tree: la vista
      // se re-aplica desde el árbol de React, donde `styles.panel` no tiene transform — el panel
      // salta arriba por un cuadro. `finished` es false si otra animación interrumpió a esta: ahí el
      // estado lo fija quien interrumpió, y pisarlo dejaría el hint mintiendo sobre dónde está el
      // panel.
      panelY.value = withTiming(destino, CONFIG_SNAP, (finished) => {
        if (finished) runOnJS(setPanelAbajo)(destino === max);
      });
    };

    return Gesture.Pan()
      // `onBegin` (al APOYAR el dedo), no `onStart` (al activarse el recognizer, ya pasado su umbral
      // de desplazamiento): es el patrón que documenta Software Mansion. Con `onStart`, el primer
      // `onUpdate` llega con un `translationY` que ya acumuló el umbral, y el panel arranca de un
      // saltito en vez de seguir al dedo desde el primer píxel.
      .onBegin(() => {
        inicio.value = panelY.value;
      })
      .onUpdate((e) => {
        // `none` mientras arrastra: seguimos el dedo 1:1, con clamp a [0, MAX].
        panelY.value = Math.min(Math.max(inicio.value + e.translationY, 0), recorrido.value);
      })
      .onEnd((e) => {
        // 🔴 **Un lanzamiento rápido NO es un toque, por poco que se haya desplazado.** El chequeo
        // miraba sólo `translationY`, y un flick corto y veloz llega acá con el desplazamiento casi
        // en cero: el dedo se levanta antes de que el gesto acumule recorrido. Un toque de verdad es
        // quieto en AMBAS cosas: poco desplazamiento **y** poca velocidad.
        if (Math.abs(e.translationY) < UMBRAL_TAP && Math.abs(e.velocityY) < VELOCIDAD_FLICK) {
          // Toque casi sin desplazamiento Y sin impulso → toggle.
          alternar();
          return;
        }
        const max = recorrido.value;
        if (max <= 0) return;
        // Un flick decide por DIRECCIÓN; sin flick, gana el borde más cercano. Ver `VELOCIDAD_FLICK`:
        // mezclar ambas cosas en una sola proyección hacía que un lanzamiento claro hacia abajo
        // volviera arriba por no llegar a la mitad del recorrido.
        const destino =
          Math.abs(e.velocityY) > VELOCIDAD_FLICK
            ? e.velocityY > 0
              ? max
              : 0
            : panelY.value > max / 2
              ? max
              : 0;
        panelY.value = withSpring(
          destino,
          { ...CONFIG_SNAP_GESTO, velocity: e.velocityY },
          (finished) => {
            if (finished) runOnJS(setPanelAbajo)(destino === max);
          }
        );
      });
  }, [panelY, inicio, recorrido]);

  const estiloPanel = useAnimatedStyle(() => ({ transform: [{ translateY: panelY.value }] }));

  /**
   * Clearance de la status bar: el handle tiene que caer DEBAJO del reloj cuando el panel está
   * arriba, y la tira de abajo tiene que medir exactamente una card (`ALTO_HANDLE`), sin espacio
   * muerto.
   *
   * 🔴 **Antes esto se lograba ANIMANDO `height`** (de `insets.top` a 0 según `panelY`), y era la
   * causa de un defecto que costó días: *«se desliza, salta, se maximiza un instante y sigue
   * bajando»*.
   *
   * `height` es una propiedad de LAYOUT. Software Mansion lo marca como anti-patrón explícito
   * (`references/animations/animations-performance.md` §"Prefer Non-Layout Properties"): animarla
   * fuerza un layout pass por frame, y cada layout pass es un **commit del shadow tree**. En la New
   * Architecture, un commit re-aplica la vista desde el árbol de React — y en el árbol de React
   * `styles.panel` NO tiene transform, o sea `translateY: 0`, o sea **el panel arriba, tapando la
   * pantalla**. Un cuadro, hasta que Reanimated lo vuelve a pisar. Es el mismo mecanismo que la
   * documentación describe como *"flickering on the New Architecture"*.
   *
   * **La solución no necesita animar nada.** El spacer queda FIJO en `insets.top` y el recorrido se
   * acorta en esa misma cantidad. La geometría final es idéntica:
   *
   *     handle_top (abajo) = panelY_max + insets.top = (alto - ALTO_HANDLE - insets.top) + insets.top
   *                        = alto - ALTO_HANDLE          ← la tira mide exactamente una card ✓
   *     handle_top (arriba) = 0 + insets.top             ← el handle cae debajo del reloj ✓
   *
   * Mismo resultado visual, cero propiedades de layout animadas, cero commits durante el arrastre.
   */
  const estiloSpacer = { height: insets.top };

  return (
    <View
      style={[styles.raiz, { backgroundColor: tema.color.fondo }]}
      testID={testID}
      // 🔴 La medida REAL de lo que el panel tiene que cubrir. Es la raíz de esta pantalla, así que
      // incluye lo que el edge-to-edge agrega y que `Dimensions.get('window')` no ve.
      onLayout={(e) => {
        // Se resta también `insets.top` porque el spacer superior ya no colapsa: es fijo. Ver el
        // comentario de `estiloSpacer` — la resta es lo que mantiene la tira de abajo del tamaño de
        // una card ahora que el spacer no se anima.
        recorrido.value = Math.max(e.nativeEvent.layout.height - ALTO_HANDLE - insets.top, 0);
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
          {/* Spacer de status bar (fijo) — no intercepta toques. */}
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
