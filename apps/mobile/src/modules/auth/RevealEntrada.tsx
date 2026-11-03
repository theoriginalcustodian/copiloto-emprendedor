import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { PRONUNCIACION_MARCA, TAGLINE_MARCA } from '@copiloto/core';

import { pressableStyle } from '../../theme/glass/presion';
import { COLOR_PALABRA_MARCA } from '../../theme/identidadPalette';
import { Marca } from '../../theme/Marca';
import { useTema } from '../../theme/ThemeProvider';
import {
  EASE_BOUNCE,
  EASE_SETTLE,
  IdentidadEntrada,
  LETTER,
  LETTER_STAGGER,
  SETTLE,
  T_BOUNCE_END,
  T_O,
  T_WORDMARK,
} from '../splash/IdentidadEntrada';

const LOCKUP_SIMBOLO = 54;
const ALTO_BOTON = 54;
/** `.rv-word{font-size:46px}` del prototipo (`index.html:469`); antes 40, medido DESVÍO en DEVICE15. */
const FONT_WORDMARK = 46;
/** `.tagline`: fade-up de 680 ms, 320 ms después de que el lockup queda en su lugar (`index.html:1232`). */
const TAGLINE_RETRASO = 320;
const TAGLINE_DURACION = 680;

/** "O" ya cubierta por `Marca` (`app/_layout.tsx:113` — el monograma ES el glifo real de la O): el
 * wordmark sólo necesita animar el resto, igual que web separa `__o` de `__rest` (H-A4-2). */
const LETRAS_WORDMARK = ['d', 'o', 'b', 'i'];
/** 0.4em del `fontSize` del wordmark (46) — mismo offset que `translateY(0.4em)` de `Splash.css`. */
const OFFSET_LETRA = Math.round(FONT_WORDMARK * 0.4);

/** Settle de la "O" (`Marca`): mismo fade+scale(1.06→1) que `.identidad-splash__o` en web. */
function OAsentada({ reducido, children }: { reducido: boolean; children: React.ReactNode }) {
  const opacidad = useSharedValue(reducido ? 1 : 0);
  const escala = useSharedValue(reducido ? 1 : 1.06);

  useEffect(() => {
    if (reducido) return;
    opacidad.value = withDelay(T_O, withTiming(1, { duration: SETTLE, easing: EASE_SETTLE }));
    escala.value = withDelay(T_O, withTiming(1, { duration: SETTLE, easing: EASE_SETTLE }));
  }, []);

  const estilo = useAnimatedStyle(() => ({
    opacity: opacidad.value,
    transform: [{ scale: escala.value }],
  }));

  return <Animated.View style={estilo}>{children}</Animated.View>;
}

/** Una letra del wordmark "dobi": fade + bounce, mismo tempo/curva que `.identidad-splash__letra`. */
function LetraWordmark({ letra, indice, reducido, estilo }: { letra: string; indice: number; reducido: boolean; estilo: object }) {
  const opacidad = useSharedValue(reducido ? 1 : 0);
  const traslado = useSharedValue(reducido ? 0 : OFFSET_LETRA);

  useEffect(() => {
    if (reducido) return;
    const delay = T_WORDMARK + indice * LETTER_STAGGER;
    // CSS: opacity llega a 1 al 40% del keyframe (`identidad-letra-bounce`) mientras translateY sigue
    // hasta el 100% -- se separan en dos `withTiming` porque Reanimated no tiene keyframes intermedios.
    opacidad.value = withDelay(delay, withTiming(1, { duration: Math.round(LETTER * 0.4) }));
    traslado.value = withDelay(delay, withTiming(0, { duration: LETTER, easing: EASE_BOUNCE }));
  }, []);

  const estiloAnim = useAnimatedStyle(() => ({
    opacity: opacidad.value,
    transform: [{ translateY: traslado.value }],
  }));

  return <Animated.Text style={[estilo, estiloAnim]}>{letra}</Animated.Text>;
}

/** El descriptor «Tu copiloto emprendedor»: aparece con fade-up cuando el wordmark ya terminó de entrar. */
function Tagline({ reducido, testID }: { reducido: boolean; testID: string }) {
  const tema = useTema();
  const opacidad = useSharedValue(reducido ? 1 : 0);
  const traslado = useSharedValue(reducido ? 0 : 10);

  useEffect(() => {
    if (reducido) return;
    const delay = T_BOUNCE_END + TAGLINE_RETRASO;
    opacidad.value = withDelay(delay, withTiming(1, { duration: TAGLINE_DURACION, easing: EASE_SETTLE }));
    traslado.value = withDelay(delay, withTiming(0, { duration: TAGLINE_DURACION, easing: EASE_SETTLE }));
  }, []);

  const estiloAnim = useAnimatedStyle(() => ({
    opacity: opacidad.value,
    transform: [{ translateY: traslado.value }],
  }));

  return (
    <Animated.Text
      testID={testID}
      style={[
        // `.tagline{font-size:16px;font-weight:500;letter-spacing:.02em;color:var(--sec)}` (`index.html:1230`).
        { color: tema.color.textoTenue, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base, letterSpacing: 0.32 },
        estiloAnim,
      ]}
    >
      {TAGLINE_MARCA}
    </Animated.Text>
  );
}

/**
 * SM-N30 — el prototipo tiene DOS pantallas y la app las había fusionado en una:
 * `splash` (`#splash`, `index.html:2446`): lockup animado glifo «O» + «dobi» letra a letra + descriptor, UNA sola puerta.
 * `reveal` (`#reveal`, `index.html:2546`): el aterrizaje estático — lockup ENTERO «Odobi», «se dice o-DO-bi» y las
 * puertas, SIN descriptor. «Volver a entrar» (`?ver=volver`) es el `reveal`; el primer arranque es el `splash`.
 */
export type VarianteEntrada = 'splash' | 'reveal';

export interface RevealEntradaProps {
  variante: VarianteEntrada;
  /** Etiquetas de las dos puertas (`TEXTOS_REVEAL`): el mismo reveal aterriza distinto según la sesión. */
  primario: string;
  /** Vacío = no hay alta disponible todavía (BETA-4b): el botón secundario no se dibuja. */
  secundario: string;
  onPrimario: () => void;
  onSecundario: () => void;
  testID?: string;
}

/**
 * La entrada sin sesión (prototipo `#splash` y `#reveal`, `?ver=splash|reveal|volver`). Es UN componente con
 * DOS variantes (`VarianteEntrada`, SM-N30): el `splash` animado del primer ingreso y el `reveal` estático
 * de «volver». Comparten puertas (`TEXTOS_REVEAL`) y tema; NO comparten lockup,
 * descriptor ni pronunciación: fusionarlos fue el defecto que SM-N30 separó.
 */
export function RevealEntrada({
  variante,
  primario,
  secundario,
  onPrimario,
  onSecundario,
  testID = 'reveal-entrada',
}: RevealEntradaProps) {
  const tema = useTema();
  const reducido = useReducedMotion();
  // Color de MARCA fijo (`.rv-word{color:var(--terracota)}`), no `acentoTinta`: el wordmark es el logotipo
  // y su gemelo web usa `--identidad-word`. `letterSpacing:-.02em` del prototipo (46 × .02 ≈ 0,92).
  const estiloLetra = {
    color: COLOR_PALABRA_MARCA,
    fontSize: FONT_WORDMARK,
    fontFamily: tema.fuente.display,
    fontWeight: '800' as const,
    letterSpacing: -0.02 * FONT_WORDMARK,
  };

  const esReveal = variante === 'reveal';
  const pronunciacion = (
    <View style={styles.pronunciacion}>
      <Text testID={`${testID}-pronunciacion`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
        {PRONUNCIACION_MARCA}
      </Text>
    </View>
  );

  return (
    <View testID={testID} style={[styles.raiz, { backgroundColor: tema.color.fondo, padding: tema.espacio.lg }]}>
      {esReveal && (
        // `#reveal{background:linear-gradient(0deg,#F5E7DE 0%,crema 60%,crema 100%)}` (`index.html:461`).
        <LinearGradient
          testID={`${testID}-fondo`}
          colors={[tema.color.fondoDegradado[0], tema.color.fondo, tema.color.fondo]}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <View style={styles.medio}>
        {esReveal ? (
          <View style={[styles.lockup, { gap: 16 }]}>
            {/* SM-A2: `#reveal` dibuja el signo DESNUDO, terracota, a 54 (`index.html:2547`, svg width 54), sin badge.
                El `splash` de abajo es otra pantalla (la «O» de texto, `index.html:2447`) y conserva su `Marca`. */}
            <Marca size={LOCKUP_SIMBOLO} tono="desnudo" />
            <Text testID={`${testID}-palabra`} style={estiloLetra}>
              Odobi
            </Text>
          </View>
        ) : (
          <>
            <IdentidadEntrada>
              <View style={[styles.lockup, { gap: Math.round(LOCKUP_SIMBOLO * 0.3) }]}>
                <OAsentada reducido={reducido}>
                  <Marca size={LOCKUP_SIMBOLO} />
                </OAsentada>
                <View style={styles.wordmark}>
                  {LETRAS_WORDMARK.map((letra, indice) => (
                    <LetraWordmark key={letra + indice} letra={letra} indice={indice} reducido={reducido} estilo={estiloLetra} />
                  ))}
                </View>
              </View>
            </IdentidadEntrada>
            <Tagline reducido={reducido} testID={`${testID}-tagline`} />
          </>
        )}
        {esReveal && pronunciacion}
      </View>

      <View style={{ gap: tema.espacio.sm }}>
        <Pressable
          testID={`${testID}-primario`}
          accessibilityRole="button"
          accessibilityLabel={primario}
          onPress={onPrimario}
          style={pressableStyle([styles.boton, { backgroundColor: tema.color.acentoSuperficie, borderRadius: tema.radio.md, height: ALTO_BOTON }])}
        >
          <Text style={{ color: tema.color.acentoTexto, fontSize: tema.tipo.grande, fontWeight: '700' }}>{primario}</Text>
        </Pressable>
        {secundario !== '' && (
          <Pressable
            testID={`${testID}-secundario`}
            accessibilityRole="button"
            accessibilityLabel={secundario}
            onPress={onSecundario}
            style={pressableStyle([styles.boton, { height: ALTO_BOTON }])}
          >
            <Text style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.grande, fontWeight: '600' }}>{secundario}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, justifyContent: 'space-between' },
  medio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  lockup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  wordmark: { flexDirection: 'row' },
  pronunciacion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boton: { alignItems: 'center', justifyContent: 'center' },
});
