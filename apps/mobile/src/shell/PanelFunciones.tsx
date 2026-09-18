/**
 * `PanelFunciones` — el escritorio de funciones **colgado del borde de arriba**, sobre la base.
 *
 * 🔴 **Es la mitad que faltaba del modelo de capas** (`odobi-ui/CLAUDE.md` §Modelo de capas):
 * *«Dos gestos verticales OPUESTOS, uno por borde: arriba trae el escritorio de funciones, abajo
 * trae la conversación. No compiten por el mismo movimiento: se reparten el eje.»*
 *
 * Hasta el 2026-09-18 mobile tenía un solo gesto y dos capas: el escritorio ERA el fondo y la
 * conversación se deslizaba sobre él. Mi día vivía como una ruta más del grid, o sea que la pantalla
 * que el sistema define como la base se alcanzaba entrando a una función. Acá se invierte: la base es
 * Mi día (`children`), el escritorio pasa a ser esta capa, y la conversación sigue siendo la de
 * `PanelDeslizable`, que va por encima de las dos.
 *
 * **Siempre asoma su borde** (`ALTO_PESTANA`), y eso es deliberado: como la capa vecina se ve, la
 * posición se lee sin ningún indicador de estado. La pestaña además es **tocable**, no sólo
 * arrastrable — WCAG 2.5.1 pide una alternativa de un solo puntero para cualquier función que se
 * consiga con un gesto de trayectoria.
 *
 * ⚠️ **El gesto vive SÓLO en la pestaña, no en todo el panel.** Adentro del escritorio hay una lista
 * de actividad que scrollea; un Pan sobre toda la superficie competiría con ese scroll, que es
 * exactamente el defecto que este repo ya pagó dos veces (el scroll de Apps, el glass apilado). La
 * pestaña es una zona chica y sin contenido scrolleable: ahí no hay con quién competir.
 */
import type { PropsWithChildren, ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTema } from '../theme/ThemeProvider';
import { CristalVidrio } from '../theme/glass/CristalVidrio';

/** Lo que asoma del escritorio cuando está cerrado: la pestaña con su rótulo. */
const ALTO_PESTANA = 44;

// Mismas curvas y umbrales que `PanelDeslizable`, y **locales a propósito**: se leen dentro de
// worklets de Reanimated, que corren en el runtime de UI y no resuelven bindings importados de otro
// módulo (ya reventó una vez en device con `Property 'VELOCIDAD_FLICK' doesn't exist`).
const CONFIG_SNAP = { duration: 420, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };
const CONFIG_SNAP_GESTO = { duration: 420, dampingRatio: 1, overshootClamping: true };
const VELOCIDAD_FLICK = 500;
const UMBRAL_TAP = 5;

export interface PanelFuncionesProps extends PropsWithChildren {
  /** El escritorio: lo que baja desde arriba. */
  escritorio: ReactNode;
  testID?: string;
}

export function PanelFunciones({ escritorio, children, testID = 'panel-funciones' }: PanelFuncionesProps) {
  const tema = useTema();
  // `y` va de `-alto` (cerrado: sólo asoma la pestaña) a 0 (abierto: el escritorio tapa la base).
  const y = useSharedValue(0);
  const inicio = useSharedValue(0);
  const alto = useSharedValue(0);
  const [abierto, setAbierto] = useState(false);

  const marcar = useCallback((v: boolean) => setAbierto(v), []);

  const gesto = useMemo(() => {
    const alternar = () => {
      'worklet';
      const max = alto.value;
      if (max <= 0) return; // sin medir todavía: no inventamos un destino
      const destino = y.value < -max / 2 ? 0 : -max;
      y.value = withTiming(destino, CONFIG_SNAP, (finished) => {
        if (finished) runOnJS(marcar)(destino === 0);
      });
    };

    return Gesture.Pan()
      .onBegin(() => {
        inicio.value = y.value;
      })
      .onUpdate((e) => {
        y.value = Math.min(Math.max(inicio.value + e.translationY, -alto.value), 0);
      })
      .onEnd((e) => {
        // Un toque de verdad es quieto en las DOS cosas: poco desplazamiento y poca velocidad. Un
        // flick corto llega acá con `translationY` casi en cero y no es un toque.
        if (Math.abs(e.translationY) < UMBRAL_TAP && Math.abs(e.velocityY) < VELOCIDAD_FLICK) {
          alternar();
          return;
        }
        const max = alto.value;
        if (max <= 0) return;
        const destino =
          Math.abs(e.velocityY) > VELOCIDAD_FLICK
            ? e.velocityY > 0
              ? 0
              : -max
            : y.value > -max / 2
              ? 0
              : -max;
        y.value = withSpring(destino, { ...CONFIG_SNAP_GESTO, velocity: e.velocityY }, (finished) => {
          if (finished) runOnJS(marcar)(destino === 0);
        });
      });
  }, [y, inicio, alto, marcar]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={styles.raiz} testID={testID}>
      {/* La BASE — Mi día. Ocupa todo; el escritorio le cae encima. */}
      <View style={StyleSheet.absoluteFill}>{children}</View>

      <Animated.View
        style={[styles.capa, estilo]}
        testID={`${testID}-capa`}
        onLayout={(e) => {
          // El recorrido es el alto REAL de esta capa menos lo que queda asomando. Medido, no
          // preguntado a `Dimensions`: la ventana no es el contenedor (mismo criterio que
          // `PanelDeslizable`).
          const h = Math.max(e.nativeEvent.layout.height - ALTO_PESTANA, 0);
          const primeraMedida = alto.value === 0;
          alto.value = h;
          // Arranca CERRADO: la app abre en la base. Sin animación — no se "desliza" al abrir.
          if (primeraMedida && h > 0) y.value = -h;
        }}
      >
        <CristalVidrio nivel="conversacion" style={styles.cristal}>
          <View style={styles.contenido}>{escritorio}</View>
          <GestureDetector gesture={gesto}>
            <View style={styles.pestana} testID={`${testID}-pestana`} accessible accessibilityRole="button"
              accessibilityLabel={abierto ? 'Cerrar funciones' : 'Ver funciones'}
              accessibilityState={{ expanded: abierto }}
            >
              <View style={[styles.barra, { backgroundColor: tema.glass.pill }]} />
              <Text style={[styles.rotulo, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}>
                {abierto ? 'Volver a tu día' : 'Funciones'}
              </Text>
            </View>
          </GestureDetector>
        </CristalVidrio>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  // `zIndex: 2`: por encima de la base y por debajo del panel de conversación (`zIndex: 3`), que es
  // el orden del modelo de capas — la conversación es lo que uno tiene entre manos.
  capa: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2 },
  cristal: { flex: 1 },
  contenido: { flex: 1 },
  // La pestaña va ABAJO de la capa: es el borde que asoma cuando el escritorio está arriba, fuera de
  // pantalla. Su alto es `ALTO_PESTANA` exacto, que es el mismo número que se le resta al recorrido.
  pestana: { height: ALTO_PESTANA, alignItems: 'center', justifyContent: 'center', gap: 6 },
  barra: { width: 44, height: 5, borderRadius: 3 },
  rotulo: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.65 },
});
