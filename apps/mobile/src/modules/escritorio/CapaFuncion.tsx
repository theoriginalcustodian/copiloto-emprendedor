/**
 * `CapaFuncion` — CÓMO abre y cierra una función del escritorio (Apps, Ajustes, Recientes, Redes
 * Sociales, Métricas, Facturación). **Punto único y swappable** — ver la nota al final si la
 * Medición 1 del handoff cambia esta decisión.
 *
 * 🔴 **Por qué CAPA y no ruta de expo-router.** `coordinacion/2026-07-20_handoff_tiron-glass-funcion.md`
 * (sesión hermana de DocuMed, mismo repo-fork, archivos IDÉNTICOS byte a byte a la fecha del handoff)
 * documenta un tirón reproducible al arrastrar hacia abajo el glass de una función — nunca el panel
 * principal. La corrección de premisa del handoff es la parte que importa acá:
 *
 *   > "No son dos configuraciones del mismo componente. Son DOS implementaciones de gesto distintas,
 *   > en dos archivos distintos, con dos hosts de navegación distintos." Chat → `PanelDeslizable.tsx`
 *   > (capa, sin tirón). Función → `MarcoGlass.tsx` + `presentation: transparentModal` (ruta, CON
 *   > tirón).
 *
 * La causa exacta sigue sin confirmar (la "Medición 1" del handoff — instrumentar `panelY` durante el
 * arrastre con dedo humano — es la que puede confirmarla, y NO se puede automatizar: `adb shell input
 * swipe` no reproduce el síntoma, medido). Pero entre dos mecanismos donde uno se comporta bien
 * (capa) y el otro no (ruta `transparentModal`), y sin evidencia todavía de que la ruta sea inocente,
 * elegir la ruta acá sería cargar el mismo riesgo sin necesidad — el copiloto no tiene que reproducir
 * `MarcoGlass.tsx` para nada. `CapaFuncion` es un `Animated.View` **absoluto** (nunca `flex:1`,
 * higiene A3 del handoff) montado como sibling DENTRO de la misma pantalla (`app/index.tsx`), sin
 * `router.push`, sin pantalla `transparentModal` propia.
 *
 * 🔴 **Cierra por arrastre, clonando `MarcoGlass` (2026-07-21).** Durante un tiempo esta capa NO
 * tuvo gesto: el drag-to-dismiss era la superficie bajo sospecha del tirón, y meterlo antes de la
 * Medición 1 habría reintroducido el riesgo en un componente nuevo. Eso ya no aplica — la sesión de
 * DocuMed resolvió el tirón en la app canónica y sus fixes están portados acá. Y el costo de no
 * tenerlo se hizo visible en device: el vidrio de una función **no se podía deslizar hacia abajo**
 * mientras todo el resto de la app se cierra deslizando; el usuario lo reportó como roto, con razón.
 *
 * El gesto es el MISMO que `MarcoGlass` (mismo `onBegin`, mismo criterio flick-vs-arrastre, misma
 * física, ahora en constantes compartidas de `canonGlass`) y vive SÓLO en la zona del handle, no
 * sobre todo el vidrio: si cubriera la pantalla entera competiría con el `ScrollView` del contenido
 * y las listas largas dejarían de desplazarse.
 *
 * Comparte el mismo nivel de vidrio (`CristalVidrio` + `canonGlass`) que `PanelDeslizable`, así que el
 * look es indistinguible del panel principal aunque el mecanismo de apertura sea otro — el emprendedor
 * ve UNA superficie de vidrio, no dos sistemas.
 *
 * Este es el único archivo a tocar si el mecanismo cambia: encapsula la forma (`Animated.View`
 * absoluto), el gesto y el cierre (callback `onCerrar` del padre) — nada de eso se esparce en
 * `app/index.tsx` ni en `EscritorioFunciones.tsx`.
 *
 * 🔵 **Limitación conocida:** el tap en "Cerrar" desmonta sin animación de salida; el ARRASTRE sí
 * anima (el vidrio baja hasta salir de pantalla y recién ahí desmonta). Asimetría de higiene visual,
 * no de comportamiento.
 */
import { useCallback, useEffect, useMemo, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  ALTO_HANDLE,
  BARRA_HANDLE,
  CONFIG_SNAP,
  CONFIG_SNAP_GESTO,
  NIVEL_CANONICO,
  UMBRAL_CIERRE,
  UMBRAL_TAP,
  VELOCIDAD_FLICK,
} from '../../theme/glass/canonGlass';
import { CristalVidrio } from '../../theme/glass/CristalVidrio';
import { GlassIcon } from '../../theme/glass/GlassIcon';
import type { NombreIconoGlass } from '../../theme/glass/icons';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

export interface CapaFuncionProps extends PropsWithChildren {
  /** El nombre de la función, tal como figura en su tile de entrada. */
  titulo: string;
  /** El mismo glifo del tile que la abrió — entrar por un ícono y llegar a otro desorienta. */
  icono: NombreIconoGlass;
  onCerrar: () => void;
  testID?: string;
}

export function CapaFuncion({ titulo, icono, onCerrar, testID, children }: CapaFuncionProps) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  // 0 = fuera de pantalla (recién montada) · 1 = en su lugar. Corre UNA vez al montar — ver
  // limitación de "sólo entrada" en el docstring del módulo.
  const progreso = useSharedValue(0);

  useEffect(() => {
    progreso.value = withTiming(1, CONFIG_SNAP);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- corre una sola vez al montar a propósito
  }, []);

  /**
   * Desplazamiento del arrastre. Clonado de `MarcoGlass` — el gesto de la app canónica, con su
   * mismo criterio de flick/umbral. Antes esta capa NO tenía gesto: sólo se cerraba por el link
   * "Cerrar", y arrastrarla hacia abajo no hacía nada, cuando en todo el resto de la app un vidrio
   * se cierra deslizándolo. Era una inconsistencia visible, no una sutileza.
   */
  const panelY = useSharedValue(0);
  const inicio = useSharedValue(0);
  /** Alto real, medido con `onLayout`: el cierre necesita saber hasta dónde bajar antes de
   *  desmontar. Se mide en vez de preguntarle a `Dimensions`, que con edge-to-edge devuelve el área
   *  útil y no la pantalla. 0 = todavía no medí → se usa el camino de siempre. */
  const altoPantalla = useSharedValue(0);

  // `useCallback` porque el link "Cerrar" del encabezado usa el MISMO cierre: si se recreara en cada
  // render invalidaría el `useMemo` del gesto en cada vuelta — memoizar sin memoizar.
  const cerrar = useCallback(() => onCerrar(), [onCerrar]);

  // 🔴 El `useMemo` no es optimización: Gesture Handler v2 lo exige. Sin él se construye un gesto
  // nuevo por render y `GestureDetector` re-adjunta el recognizer, que pierde estado — si pasa con
  // el dedo apoyado, el vidrio salta de vuelta al origen en pleno arrastre.
  const gesto = useMemo(
    () =>
      Gesture.Pan()
        // `onBegin` (al APOYAR) y no `onStart` (ya pasado el umbral): con `onStart` el primer
        // `onUpdate` llega con el umbral acumulado y el vidrio arranca de un saltito.
        .onBegin(() => {
          inicio.value = panelY.value;
        })
        .onUpdate((e) => {
          // Sólo hacia abajo: arriba no tiene a dónde ir, el vidrio ya ocupa la pantalla.
          panelY.value = Math.max(inicio.value + e.translationY, 0);
        })
        .onEnd((e) => {
          // Un flick corto y veloz llega acá con desplazamiento casi nulo: un toque de verdad es
          // quieto en AMBAS cosas, poco recorrido Y poca velocidad.
          if (Math.abs(e.translationY) < UMBRAL_TAP && Math.abs(e.velocityY) < VELOCIDAD_FLICK) {
            panelY.value = withTiming(0, CONFIG_SNAP);
            return;
          }
          const hayFlick = Math.abs(e.velocityY) > VELOCIDAD_FLICK;
          if (hayFlick ? e.velocityY > 0 : panelY.value > UMBRAL_CIERRE) {
            // Se anima el cierre en el hilo de UI y se desmonta cuando TERMINÓ. Llamar al cierre sin
            // animar deja el vidrio congelado donde se soltó mientras el mensaje cruza a JS.
            const salida = altoPantalla.value > 0 ? altoPantalla.value : panelY.value;
            panelY.value = withSpring(salida, { ...CONFIG_SNAP_GESTO, velocity: e.velocityY }, (fin) => {
              if (fin) runOnJS(cerrar)();
            });
            return;
          }
          panelY.value = withSpring(0, { ...CONFIG_SNAP_GESTO, velocity: e.velocityY });
        }),
    [panelY, inicio, altoPantalla, cerrar]
  );

  const estiloCapa = useAnimatedStyle(() => ({
    opacity: progreso.value,
    transform: [{ translateY: (1 - progreso.value) * 40 + panelY.value }],
  }));

  return (
    // NO lleva zIndex propio: `CapaFuncion` se monta como sibling DESPUÉS del `PanelDeslizable` en
    // `app/index.tsx`, y en RN el orden de pintado sigue el orden del árbol — alcanza con montarse
    // último. `StyleSheet.absoluteFill` cubre exactamente la pantalla, igual criterio que
    // `PanelDeslizable.tsx` (nunca `Dimensions.get('window')`).
    <View
      style={StyleSheet.absoluteFill}
      testID={testID}
      onLayout={(e) => {
        altoPantalla.value = e.nativeEvent.layout.height;
      }}
    >
      <Animated.View style={[styles.panel, estiloCapa]}>
        <CristalVidrio nivel={NIVEL_CANONICO} style={styles.cristal}>
          {/* Clearance de la status bar: el vidrio es full-bleed, sólo el contenido respeta el inset —
              mismo criterio que `PanelDeslizable`/`MarcoGlass`. */}
          <View style={{ height: insets.top }} pointerEvents="none" />

          {/* La barrita de arrastre, igual que en `MarcoGlass`: el gesto vive SÓLO acá y no sobre
              todo el vidrio, para no competir con el scroll del contenido (un `ScrollView` hijo
              dejaría de desplazarse si el Pan cubriera la pantalla entera). */}
          <GestureDetector gesture={gesto}>
            <View style={styles.zonaHandle} testID="capa-funcion-handle">
              <View style={[styles.barraHandle, { backgroundColor: tema.glass.pill }]} />
            </View>
          </GestureDetector>

          <View style={[styles.encabezado, { paddingHorizontal: tema.espacio.md, minHeight: ALTO_HANDLE }]}>
            <View style={[styles.identidad, { gap: tema.espacio.sm }]}>
              <GlassIcon name={icono} size={28} />
              <Text
                testID="capa-funcion-titulo"
                style={{ color: tema.color.texto, fontSize: tema.tipo.titulo, fontFamily: tema.fuente.uiBold }}
              >
                {titulo}
              </Text>
            </View>
            {/* `PRESS_FADE`, no `PRESS_SCALE`: es un link de texto suelto, sin caja propia. */}
            <Pressable
              testID="capa-funcion-cerrar"
              onPress={onCerrar}
              hitSlop={12}
              style={pressableStyle(undefined, PRESS_FADE)}
            >
              <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiSemibold }}>Cerrar</Text>
            </Pressable>
          </View>

          {/* 🔴 El contenido va en una caja `flex:1` — sin esto, un `ScrollView` hijo se dimensiona
              según SU CONTENIDO en vez de según el espacio disponible, así que desborda por abajo y
              NO scrollea (verificado en device: la lista de 8 integraciones de Apps quedaba cortada
              y el gesto no hacía nada). Va acá y no en cada pantalla porque `CapaFuncion` es el
              chrome ÚNICO de las 6 funciones: arreglarlo una vez lo arregla para todas, incluida la
              que se agregue mañana. documed no lo necesitó sólo porque sus listas entran en
              pantalla — el mismo latente estaba ahí. */}
          <View style={styles.contenido}>{children}</View>
        </CristalVidrio>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Forma ABSOLUTA, nunca `flex:1` — higiene A3 del handoff (ver docstring del módulo): es la forma
  // que el spike de 60 fps / 0% jank validó, y la que usa `PanelDeslizable`.
  panel: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  cristal: { flex: 1 },
  // Acota el alto del contenido al espacio que sobra bajo el encabezado — ver el comentario en el
  // render. Es lo que hace posible que un ScrollView hijo sepa cuánto puede desplazarse.
  contenido: { flex: 1 },
  // Clonados de `MarcoGlass`: el handle tiene que MEDIR y verse igual en las dos superficies,
  // o el mismo gesto se siente distinto según por dónde entraste.
  zonaHandle: { height: ALTO_HANDLE, alignItems: 'center', justifyContent: 'center' },
  barraHandle: { ...BARRA_HANDLE },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  identidad: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
});
