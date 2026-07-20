/**
 * `MarcoSpike` — instrumento de la **Medición 1** del tirón del glass de función.
 *
 * # Historia de este archivo (importa, porque explica por qué NO mide lo que medía antes)
 *
 * La primera versión comparaba tres mecanismos de CIERRE (router.back inmediato / animar y después
 * navegar / capa sin router), bajo la hipótesis de que el tirón nacía en el traspaso del gesto al
 * navegador **al soltar**.
 *
 * Esa hipótesis está **refutada**, y por evidencia ajena que llegó antes de gastarla acá: el handoff
 * `coordinacion/2026-07-20_handoff_tiron-glass-funcion.md`, de la sesión de frontend de DocuMed.
 * Dos cosas de ahí la tumban:
 *
 *   1. El operador ve el tirón **durante el arrastre** (*"se sigue trabando en la mitad"*), no al
 *      soltar. Cualquier mecanismo de cierre es posterior al síntoma.
 *   2. Auditaron el camino del arrastre entero: entre `onStart` y `onEnd` el código no hace nada
 *      salvo asignar un número a un shared value. `UMBRAL_CIERRE` se evalúa **sólo** en `onEnd`.
 *      No hay umbral que se cruce mientras el dedo se mueve.
 *
 * Ellos ya habían refutado además la forma general del razonamiento: *"se detiene en un punto fijo
 * ⇒ hay un umbral en el código"* es su hipótesis #4, marcada como falsa tras auditoría exhaustiva.
 *
 * # Qué mide ahora
 *
 * La pregunta que bisecta el espacio de búsqueda, antes de tocar una línea de producción:
 *
 *   > durante el tirón, ¿`panelY` deja de avanzar, o avanza liso y sólo los píxeles se detienen?
 *
 * | Lo que se vea | Qué significa |
 * |---|---|
 * | hueco en los timestamps | el hilo de UI se bloqueó → defecto de render/compositor |
 * | timestamps parejos y `panelY` liso | el valor nunca se detuvo: se atrasa el DIBUJO (screens/SurfaceFlinger) |
 * | timestamps parejos y `translationY` salta | es de ENTRADA (gesture-handler / InputDispatcher) |
 *
 * # 🔴 Reglas del instrumento (cada una es un error ya pagado por la otra sesión)
 *
 *   - **Un solo `runOnJS`, en `onEnd`.** Un `console.log` por frame fabrica exactamente el jank que
 *     se está buscando: el instrumento se vuelve la causa.
 *   - **Las muestras se acumulan en el runtime de UI**, no en estado de React. Un `useState` por
 *     frame re-renderiza y contamina igual.
 *   - **No se mide con `adb shell input swipe`.** Está verificado que el swipe sintético NO
 *     reproduce el síntoma (cero frames >40 ms, contra 150 ms con dedo humano). Un A/B cuyo caso
 *     base no exhibe el defecto no prueba nada — casi les hace culpar al filtro SVG por eso.
 */
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTema } from '../theme/ThemeProvider';
import { CristalVidrio } from '../theme/glass/CristalVidrio';
import { GlassIcon } from '../theme/glass/GlassIcon';
import { ALTO_HANDLE, BARRA_HANDLE, CONFIG_SNAP, NIVEL_CANONICO, UMBRAL_TAP } from '../theme/glass/canonGlass';

export const UMBRAL_CIERRE = 140;

/** Prefijo para filtrar el volcado en `adb logcat`. */
export const TAG_MEDICION = 'SPIKE_REPLIEGUE';

/**
 * Variante de forma del nodo animado — la asimetría A3 del handoff.
 *
 * El chat (que NO se traba) monta el panel como `position:'absolute'` + inset 0; el glass de
 * función lo monta `flex:1`. Y el spike que midió 60 fps / 0% jank en documed usaba la forma
 * absoluta: `MarcoGlass` nunca se midió con la forma que sí se validó.
 */
export type FormaNodo = 'flex' | 'absoluto';

export interface MarcoSpikeProps extends PropsWithChildren {
  titulo: string;
  /** Etiqueta con la que sale el volcado — permite distinguir corridas en el logcat. */
  etiqueta: string;
  forma: FormaNodo;
  /** Si `false`, el ícono con `<FeGaussianBlur>` NO se monta dentro del nodo que se traslada (A1). */
  conIconoSvg: boolean;
  alCerrar: () => void;
}

interface Muestra {
  t: number;
  y: number;
  dy: number;
}

export function MarcoSpike({ titulo, etiqueta, forma, conIconoSvg, alCerrar, children }: MarcoSpikeProps) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const panelY = useSharedValue(0);
  const inicio = useSharedValue(0);
  // Buffer de muestras en el runtime de UI. NO es estado de React a propósito.
  const muestras = useSharedValue<Muestra[]>([]);

  /** Corre UNA vez por gesto, ya en el hilo de JS, con el arrastre terminado. */
  const volcar = (datos: Muestra[]) => {
    if (datos.length < 3) return;
    const deltas = datos.slice(1).map((m, i) => +(m.t - datos[i]!.t).toFixed(1));
    const saltosY = datos.slice(1).map((m, i) => +(m.y - datos[i]!.y).toFixed(1));
    const peorDelta = Math.max(...deltas);
    const idxPeor = deltas.indexOf(peorDelta);

    // Un solo log, con todo adentro. `S7-parse-medicion1.mjs` lo parsea desde el logcat.
    console.log(
      `${TAG_MEDICION} ${JSON.stringify({
        etiqueta,
        forma,
        conIconoSvg,
        n: datos.length,
        // El hueco temporal más grande entre dos muestras consecutivas del gesto. Si el hilo de UI
        // se bloqueó, acá aparece; si el valor fluyó liso, esto queda cerca del período de vsync.
        peorDeltaMs: peorDelta,
        // Dónde ocurrió, en píxeles de recorrido — para contrastar con "siempre en el mismo punto".
        yEnPeorDelta: datos[idxPeor]?.y ?? null,
        // Y en qué momento del gesto — porque "punto fijo en pantalla" y "tiempo fijo desde el
        // inicio" son indistinguibles si uno arrastra siempre a velocidad parecida. El handoff deja
        // esa ambigüedad explícitamente abierta; sin este dato no se puede cerrar.
        msDesdeInicio: +(datos[idxPeor]!.t - datos[0]!.t).toFixed(1),
        deltasMs: deltas,
        saltosY,
      })}`
    );
  };

  const gesto = Gesture.Pan()
    .onStart(() => {
      inicio.value = panelY.value;
      muestras.value = [];
    })
    .onUpdate((e) => {
      // 🔴 Cota superior incluida — el chat la tiene (`Math.min`), `MarcoGlass` NO, y el handoff lo
      // registra como defecto lateral real: el panel de función se puede empujar indefinidamente
      // fuera de pantalla. No explica el tirón, pero no se copia un bug conocido.
      panelY.value = Math.min(Math.max(inicio.value + e.translationY, 0), height);
      // Acumular es barato: un push a un array del runtime de UI, sin cruzar de hilo.
      muestras.value = [...muestras.value, { t: globalThis.performance.now(), y: panelY.value, dy: e.translationY }];
    })
    .onEnd((e) => {
      const datos = muestras.value;
      runOnJS(volcar)(datos);

      if (Math.abs(e.translationY) < UMBRAL_TAP) {
        panelY.value = withTiming(0, CONFIG_SNAP);
        return;
      }
      const proyeccion = panelY.value + e.velocityY * 0.12;
      if (proyeccion > UMBRAL_CIERRE) {
        panelY.value = withTiming(height, CONFIG_SNAP, (fin) => {
          'worklet';
          if (fin) runOnJS(alCerrar)();
        });
        return;
      }
      panelY.value = withTiming(0, CONFIG_SNAP);
    });

  const estiloPanel = useAnimatedStyle(() => ({ transform: [{ translateY: panelY.value }] }));

  return (
    <View style={styles.raiz}>
      <Animated.View style={[forma === 'flex' ? styles.panelFlex : styles.panelAbsoluto, estiloPanel]}>
        <CristalVidrio nivel={NIVEL_CANONICO} style={styles.cristal} testID={`glass-${etiqueta}`}>
          <View style={{ height: insets.top }} pointerEvents="none" />
          <GestureDetector gesture={gesto}>
            <View style={styles.zonaHandle} testID="glass-handle">
              <View style={[styles.barraHandle, { backgroundColor: tema.glass.pill }]} />
            </View>
          </GestureDetector>

          <View style={[styles.encabezado, { paddingHorizontal: tema.espacio.md }]}>
            <View style={[styles.identidad, { gap: tema.espacio.sm }]}>
              {/* A1 — el único `<Filter>/<FeGaussianBlur>` del repo, DENTRO del nodo que se traslada.
                  En el chat los `GlassIcon` viven en la capa estática, fuera de lo que se mueve.
                  Ojo: esto NO es la hipótesis ya refutada (esa varió el filtro on/off en el mismo
                  lugar); acá la variable es *dentro vs. fuera de lo que se traslada*. */}
              {conIconoSvg ? (
                <GlassIcon name="settings" size={28} />
              ) : (
                <View style={{ width: 28, height: 28 }} />
              )}
              <Text style={{ color: tema.color.texto, fontSize: tema.tipo.titulo, fontFamily: tema.fuente.uiBold }}>
                {titulo}
              </Text>
            </View>
            <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.mono, fontSize: 11 }}>
              {etiqueta}
            </Text>
          </View>
          {children}
        </CristalVidrio>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  // La forma de `MarcoGlass` hoy.
  panelFlex: { flex: 1 },
  // La forma de `PanelDeslizable` — la que el spike de 60 fps validó.
  panelAbsoluto: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  cristal: { flex: 1 },
  zonaHandle: { height: ALTO_HANDLE, alignItems: 'center', justifyContent: 'center' },
  barraHandle: { ...BARRA_HANDLE },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  identidad: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
});
