import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, type FlatList } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { sombraNivel } from '../../theme/glass/relieve';
import { ECUALIZADOR_BARRAS } from '../../theme/glass/ecualizadorPalette';
import { useMovimientoReducido } from '../../theme/movimientoReducido';
import { useTema } from '../../theme/ThemeProvider';

/** `viewBox` nativo del isotipo (`docs/Imagen de marca/isotipo-odobi/isotipo-odobi-positivo.svg`) y
 *  el tamaño al que se renderiza dentro del botón (DoD ODOBI línea 352: "el del botón de voz es el
 *  de 34", no 22 como el resto de los íconos inline). */
const ISOTIPO_VIEWBOX = 24;
const ISOTIPO_TAMANO_BOTON = 34;
/** `logoScale` (mecanismo de ODOBI7/DoD líneas 346-349): al escalar el glifo × k, el `stroke-width`
 *  se divide por la misma k para que el trazo se vea igual de fino a cualquier tamaño — el `<G
 *  transform="scale(k)">` ya multiplica todo lo de adentro por k, así que predividir lo cancela. */
const ISOTIPO_ESCALA = ISOTIPO_TAMANO_BOTON / ISOTIPO_VIEWBOX;
const ISOTIPO_STROKE_WIDTH = 1.7 / ISOTIPO_ESCALA;

/** Cuánto hay que deslizar hacia arriba (px) antes de "fijar" la grabación — mismo umbral y misma
 *  razón que documed (`modules/captura/BotonVoz.tsx`, fuente canónica del gesto): un temblor
 *  sosteniendo el teléfono no fija por accidente, pero un deslizamiento franco sí. */
export const UMBRAL_FIJAR_PX = 80;

export interface BotonVozProps {
  /** Mantener apretado — arranca la grabación de inmediato (contrato `dictado-por-voz-sin-glass`). */
  onIniciar: () => void;
  /** Soltar SIN haber fijado — envía directo (corta + sube + entra como mensaje). */
  onSoltarSinFijar: () => void;
  /** Deslizar hacia arriba más de `UMBRAL_FIJAR_PX` mientras se graba — fija la grabación; a partir
   *  de acá el propio botón no hace más nada, los controles flotantes (afuera) toman el mando. */
  onFijar: () => void;
  /** Se apaga mientras ya hay una captura en curso (grabando/pausada/lista) — un segundo `onIniciar`
   *  no puede reiniciar `useVozComando` a mitad de una captura. */
  disabled?: boolean;
  /** El `ref` de `ListaMensajes` (su `FlatList` de RNGH, ver C6 — antes `ScrollView`) — este botón
   *  flota encima y su gesto tiene que declararse `simultaneousWithExternalGesture` con el scroll
   *  para no comerle el toque ni que el scroll se lo coma a él. Ver el docstring del módulo. */
  scrollRef: React.RefObject<FlatList | null>;
}

/**
 * El botón de voz del copiloto: central, grande, palpita. **Reescrito** contra
 * `contrato_planificacion-a-frontend_dictado-por-voz-sin-glass-hold-graba-soltar-envia-deslizar-fija`
 * — la versión anterior (un toque simple que abría un HUD glass) mis-citó una decisión cerrada (D6,
 * de RETENCIÓN de audio) como si fuera autoridad de una decisión de UX que nunca se tomó; ver el
 * docstring de `useVozComando.ts` y el hallazgo §0 del contrato.
 *
 * Puerto ADAPTADO de documed `modules/captura/BotonVoz.tsx` (fuente canónica del gesto:
 * `onPressIn`=comenzar / `onPressMove`=medir deslizamiento / `onPressOut`=soltar). El origen usa el
 * `Pressable` NATIVO porque no compite con ningún `ScrollView` — acá SÍ hay uno (`ListaMensajes`, que
 * este botón flota encima) y por eso el port no es literal:
 *
 * 🔴 **UN SOLO `Gesture.Pan()`** (`onBegin`=pressIn · `onUpdate`=pressMove · `onFinalize`=pressOut),
 * declarado `simultaneousWithExternalGesture` contra el `FlatList` de `ListaMensajes`. No es un
 * `Pressable` como en documed porque acá el botón flota sobre una lista scrolleable: el `Pressable`
 * de RNGH no expone `onPressMove` para medir el arrastre, y el nativo de RN pierde el touch-down
 * contra un scroll ancestro/superpuesto (bug "se inicia únicamente deslizando"). La declaración
 * explícita de simultaneidad es lo que deja convivir el gesto del botón con el scroll de la lista.
 * **Y es UNO SOLO, no una composición** — ver el docstring de `gesto` (tercer hallazgo de device):
 * dos recognizers componiendo el mismo ciclo se desincronizan, y ése era el bug de la fase trabada.
 *
 * 🔴 **Sin `useSharedValue` — nada que animar en el hilo de UI acá.** El pulso sigue en `Animated`
 * del core (igual que antes); los callbacks del gesto sólo llaman a las tres props (funciones JS
 * planas), así que necesitan `scheduleOnRN` para cruzar del hilo de UI (donde corre el gesto, con
 * Reanimated instalado) al de JS — mismo patrón ya probado en `MarcoGlass.tsx`.
 */
export function BotonVoz({ onIniciar, onSoltarSinFijar, onFijar, disabled = false, scrollRef }: BotonVozProps) {
  const tema = useTema();

  const pulso = useRef(new Animated.Value(1)).current;
  const movimientoReducido = useMovimientoReducido();

  // Espejo síncrono de "¿ya fijé?", leído DENTRO de los callbacks del gesto (funciones JS planas
  // invocadas vía `scheduleOnRN`, no worklets). No hace falta re-renderizar el botón por esto — el ESTADO
  // que le importa a la UI (mostrar los controles flotantes) lo dueño es `ChatView` vía `onFijar`;
  // acá sólo hace falta la guarda idempotente de "no fijar dos veces" / "fijado no suelta".
  const fijadoRef = useRef(false);

  // Espejo síncrono de `disabled` — ver el docstring de `gesto` más abajo (hallazgo de device
  // 2026-08-12): la guarda de "no reiniciar una captura en curso" tiene que leerse acá, DENTRO de
  // `comenzar()`, y no vía el `useMemo` del gesto — si `disabled` fuera dependencia del memo, el
  // objeto se reconstruye en el peor momento posible: el instante en que arranca la propia captura.
  const disabledRef = useRef(disabled);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    if (disabled || movimientoReducido) {
      pulso.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [disabled, movimientoReducido, pulso]);

  // 🔴 **`useCallback`, no funciones planas.** El gesto de abajo las captura por closure dentro de un
  // `useMemo` — si estas tres se recrearan en cada render (como antes), el `useMemo` tendría que
  // invalidarse en cada render también, y quedaríamos en el mismo problema que el `useMemo` existe
  // para evitar (ver su comentario).
  const comenzar = useCallback(() => {
    // Guarda síncrona (no reactiva): un segundo `onStart` no puede reiniciar `useVozComando` a mitad
    // de una captura en curso. Antes esto vivía en `.enabled(!disabled)`/una dependencia del `useMemo`
    // de abajo — ver su docstring para por qué eso reconstruía el gesto activo en pleno vuelo.
    if (disabledRef.current) return;
    fijadoRef.current = false;
    onIniciar();
  }, [onIniciar]);

  const fijar = useCallback(() => {
    if (fijadoRef.current) return; // idempotente: no reavisa dos veces por el mismo cruce de umbral
    fijadoRef.current = true;
    onFijar();
  }, [onFijar]);

  const soltar = useCallback(() => {
    if (fijadoRef.current) return; // fijado: soltar el dedo YA NO detiene (contrato §1, fila 4)
    onSoltarSinFijar();
  }, [onSoltarSinFijar]);

  /**
   * 🔴 **BUG real de device (backend, ODOBI8 §C, 2026-08-11): el micrófono quedaba grabando para
   * siempre.** Causa raíz confirmada con logcat instrumentado, NO hipótesis: `onEnd` SÍ disparaba
   * `soltar()` (cruce UI→JS normal, ~50ms), pero la función que terminaba ejecutándose leía
   * `voz.fase` desactualizado ('inactivo' en vez de 'grabando') — un closure obsoleto.
   *
   * Causa: el gesto compuesto se reconstruía en CADA render de este componente (no estaba en
   * `useMemo`), violando la regla de `swmansion-rn-gestures` para RNGH v2: *"without useMemo, gesture
   * objects recreate on every render, causing recognizers to re-attach and lose state"*. Mientras se
   * graba, `PantallaSoporte`/`ChatView` re-renderizan ~10 veces por segundo (`voz.niveles` alimenta la
   * onda), así que el recognizer se re-ataba constantemente durante el propio `LongPress` activo.
   *
   * `enabled(!disabled)` NO es la causa DIRECTA (troubleshooting oficial de RNGH: cambiar `enabled` a
   * mitad de un gesto en curso no lo cancela, "by design") — pero SÍ era dependencia de este mismo
   * `useMemo`. **Hallazgo de device 2026-08-12 (operador, logcat + repro manual):** con el `useMemo`
   * de arriba ya aplicado, el bug volvió con otra forma — corte a los ~2s, deslizar-para-fijar sin
   * efecto, sin controles de pausar/reanudar/enviar, transcripción de un audio que no es el enviado.
   * Causa: `disabled` seguía en el array de dependencias, y `disabled` pasa a `true` en el mismísimo
   * instante en que arranca la grabación (`onIniciar` → el padre re-renderiza con
   * `disabled={voz.fase !== 'inactivo'}`) — es decir, el `useMemo` se invalida y reconstruye TODO el
   * gesto compuesto en pleno `LongPress` activo, exactamente la reconstrucción-en-vuelo que este
   * mismo `useMemo` existía para evitar. La única razón de ser de `disabled` acá era bloquear un
   * SEGUNDO `onStart` mientras ya hay una captura en curso — eso ahora vive en `comenzar()` vía
   * `disabledRef` (guarda síncrona, no reactiva), así que el gesto ya no necesita saber de `disabled`
   * y su identidad se mantiene estable durante toda la captura.
   *
   * 🔴 **TERCER hallazgo de device (backend, 2026-08-19) — por qué ya NO hay `Gesture.Simultaneous`.**
   * Con el `useMemo` estable (arriba) el gesto dejó de reconstruirse, pero al **deslizar para fijar**
   * la UI quedaba trabada mostrando `Enviar`/`Eliminar` sin `Pausar`/`Reanudar` y sin poder seguir
   * grabando. Causa raíz **confirmada con logcat instrumentado en device**, no deducida:
   *
   * ```
   * LongPress.onEnd exito=false   <- el LongPress se CANCELA solo, con el dedo todavía apoyado
   * soltar() fijadoRef=false      <- la guarda no frena: el Pan aún no acumuló los 80px
   * soltar() PASA -> ENVIA        -> alEnviarVoz() -> detener() -> fase='listo'
   * fijar() fijadoRef=false       <- recién AHORA el Pan cruza el umbral
   * onFijar() -> setFijado(true)  -> controles flotantes sobre una grabación YA cortada
   * ```
   *
   * Eran **dos recognizers con ciclos de vida independientes**: el `LongPress` moría apenas el dedo
   * se movía (y `.onEnd()` dispara también en FAIL/CANCELLED — el flag `success` que el código
   * ignoraba), mientras el `Pan` seguía vivo y fijaba después. `fijadoRef` no podía salvar nada
   * porque el orden real es el inverso al que esa guarda asume.
   *
   * **El invariante que faltaba, y que documed (`modules/captura/BotonVoz.tsx`, fuente canónica) tiene
   * gratis:** *empezar, medir y soltar son el MISMO gesto y no pueden desincronizarse*. Allá es un
   * `Pressable` nativo (`onPressIn`/`onPressMove`/`onPressOut`); acá no se puede usar (compite con el
   * `FlatList` de `ListaMensajes` — ver arriba), así que el equivalente es **un solo `Pan`**:
   * `onBegin` = pressIn · `onUpdate` = pressMove · `onFinalize` = pressOut. Es además lo que indica el
   * árbol de decisión de `swmansion-rn-gestures` para "mantener apretado y después arrastrar".
   *
   * `onBegin`/`onFinalize` (no `onStart`/`onEnd`) porque disparan aunque el `Pan` nunca llegue a
   * ACTIVAR — el caso "apretar y soltar sin mover", que es el camino de enviar directo — y RNGH
   * garantiza el par: si `onBegin` disparó, `onFinalize` dispara. Con un único recognizer, `onUpdate`
   * siempre precede a `onFinalize`, así que ahora la guarda `fijadoRef` de `soltar()` sí aplica.
   */
  const gesto = useMemo(() => {
    // `FlatList` exige `data`/`renderItem` -> su tipo no satisface el `ComponentType<{}>` (props
    // vacías) que pide esta firma de RNGH (a diferencia del viejo `ScrollView`, con props opcionales).
    // Es un gap de tipos upstream, no una incompatibilidad real: RNGH sólo usa el handle nativo para
    // la arbitración de gestos, nunca renderiza nada con esas props.
    const refParaArbitraje = scrollRef as unknown as React.RefObject<React.ComponentType | null>;
    return Gesture.Pan()
      .simultaneousWithExternalGesture(refParaArbitraje)
      .onBegin(() => {
        scheduleOnRN(comenzar);
      })
      .onUpdate((e) => {
        // `translationY` negativo = el dedo subió. `-e.translationY` = cuánto subió, positivo.
        if (-e.translationY > UMBRAL_FIJAR_PX) {
          scheduleOnRN(fijar);
        }
      })
      .onFinalize(() => {
        scheduleOnRN(soltar);
      });
  }, [scrollRef, comenzar, fijar, soltar]);

  const etiqueta = disabled
    ? 'Grabando — ya hay una captura en curso'
    : 'Mantené apretado para grabar. Deslizá hacia arriba para fijar sin soltar.';

  return (
    <View style={styles.contenedor}>
      {/* Ecualizador estático (ODOBI8 §B) — decorativo, SIN reactividad al audio real (excluido
          explícitamente por el DoD del sprint ODOBI, línea 358). `pointerEvents="none"`: no compite
          con el gesto del botón que tiene debajo. */}
      <View testID="boton-voz-ecualizador" style={styles.ecualizador} pointerEvents="none">
        {ECUALIZADOR_BARRAS.map((barra, indice) => (
          <View
            key={indice}
            testID={`boton-voz-ecualizador-barra-${indice}`}
            style={[styles.barraEcualizador, { height: barra.altura, backgroundColor: barra.color }]}
          />
        ))}
      </View>
      <GestureDetector gesture={gesto}>
        <View
          testID="boton-voz"
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          accessibilityLabel={etiqueta}
        >
          {/* El aro exterior: hace que el botón se lea como una fuente de luz y no como un círculo pintado. */}
          <View style={styles.halo}>
            <View
              style={[
                styles.aro,
                { borderColor: tema.color.acento, borderRadius: tema.radio.completo, opacity: disabled ? 0.15 : 0.5 },
              ]}
              pointerEvents="none"
            />
            <Animated.View
              testID="boton-voz-nucleo"
              style={[
                styles.boton,
                { transform: [{ scale: pulso }], borderRadius: tema.radio.completo, borderColor: tema.glass.hi },
                // Nivel 3 · Acento elevado (DoD §2.4: "botón primario, FAB de voz" — textual).
                !disabled && sombraNivel(tema.glass.relieve.nivel3),
              ]}
            >
              {/* La esfera: degradado RADIAL `accent2 -> accent`. `expo-linear-gradient` sólo hace
                  lineales, así que el radial va por SVG. */}
              <Svg width="100%" height="100%" viewBox="0 0 80 80">
                <Defs>
                  <RadialGradient id="esferaVoz" cx="38%" cy="30%" r="75%">
                    <Stop offset="0" stopColor={disabled ? tema.color.superficieAlta : tema.glass.accent2} />
                    <Stop offset="0.7" stopColor={disabled ? tema.color.superficie : tema.color.acento} />
                    <Stop offset="1" stopColor={disabled ? tema.color.superficie : tema.color.acento} />
                  </RadialGradient>
                </Defs>
                <Circle cx="40" cy="40" r="40" fill="url(#esferaVoz)" />
                {/* El isotipo ODOBI (ODOBI8 §A) — reemplaza el micrófono genérico heredado de antes
                    del sprint de marca. Centrado: (80 - 34) / 2 = 23. */}
                <G
                  testID="boton-voz-isotipo"
                  transform={`translate(23 23) scale(${ISOTIPO_ESCALA})`}
                  opacity={disabled ? 0.45 : 1}
                >
                  <Path
                    testID="boton-voz-isotipo-trazo-1"
                    d="M11 3.5a8.5 8.5 0 1 0 0 17"
                    stroke={tema.color.acentoTexto}
                    strokeWidth={ISOTIPO_STROKE_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <Path
                    testID="boton-voz-isotipo-trazo-2"
                    d="M11 7.5a4.5 4.5 0 1 0 0 9"
                    stroke={tema.color.acentoTexto}
                    strokeWidth={ISOTIPO_STROKE_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <Path
                    testID="boton-voz-isotipo-trazo-3"
                    d="M16.5 8.8a4.8 4.8 0 0 1 0 6.4"
                    stroke={tema.color.acentoTexto}
                    strokeWidth={ISOTIPO_STROKE_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <Path
                    testID="boton-voz-isotipo-trazo-4"
                    d="M19.5 6.5a9 9 0 0 1 0 11"
                    stroke={tema.color.acentoTexto}
                    strokeWidth={ISOTIPO_STROKE_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </G>
              </Svg>
            </Animated.View>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

/** Medidas del template heredadas del origen: esfera de 80 y aro a -10px alrededor. */
const DIAMETRO_BOTON = 80;
const SEPARACION_ARO = 10;

const styles = StyleSheet.create({
  contenedor: { alignItems: 'center', gap: 8 },
  halo: {
    width: DIAMETRO_BOTON + SEPARACION_ARO * 2,
    height: DIAMETRO_BOTON + SEPARACION_ARO * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1.5 },
  boton: { width: DIAMETRO_BOTON, height: DIAMETRO_BOTON, borderWidth: 1, overflow: 'hidden' },
  ecualizador: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 26 },
  barraEcualizador: { width: 3, borderRadius: 2 },
});
