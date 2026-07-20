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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '../ThemeProvider';
import { CristalVidrio } from './CristalVidrio';
import { GlassIcon } from './GlassIcon';
import type { NombreIconoGlass } from './icons';
import { PRESS_FADE, pressableStyle } from './presion';
import { ALTO_HANDLE, BARRA_HANDLE, CONFIG_SNAP, NIVEL_CANONICO, UMBRAL_TAP } from './canonGlass';

/** Cuánto hay que arrastrar hacia abajo para que la función se cierre. */
const UMBRAL_CIERRE = 140;

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

  const cerrar = () => router.back();

  const gesto = Gesture.Pan()
    .onStart(() => {
      inicio.value = panelY.value;
    })
    .onUpdate((e) => {
      // Sólo hacia abajo: arrastrar hacia arriba no tiene a dónde ir (el vidrio ya ocupa la pantalla).
      panelY.value = Math.max(inicio.value + e.translationY, 0);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationY) < UMBRAL_TAP) {
        panelY.value = withTiming(0, CONFIG_SNAP);
        return;
      }
      // Sesgado por la velocidad del flick, igual que el principal: un tirón corto pero rápido cierra.
      const proyeccion = panelY.value + e.velocityY * 0.12;
      if (proyeccion > UMBRAL_CIERRE) {
        runOnJS(cerrar)();
        return;
      }
      panelY.value = withTiming(0, CONFIG_SNAP);
    });

  const estiloPanel = useAnimatedStyle(() => ({ transform: [{ translateY: panelY.value }] }));

  return (
    <View style={styles.raiz}>
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
            <>
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
            </>
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
  zonaHandle: { height: ALTO_HANDLE, alignItems: 'center', justifyContent: 'center' },
  barraHandle: { ...BARRA_HANDLE },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  identidad: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
});
