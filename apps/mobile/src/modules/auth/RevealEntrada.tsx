import { useAudioPlayer, type AudioSource } from 'expo-audio';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { PRONUNCIACION_MARCA } from '@copiloto/core';

import { pressableStyle } from '../../theme/glass/presion';
import { Marca } from '../../theme/Marca';
import { useTema } from '../../theme/ThemeProvider';
import { EASE_BOUNCE, EASE_SETTLE, IdentidadEntrada, LETTER, LETTER_STAGGER, SETTLE, T_O, T_WORDMARK } from '../splash/IdentidadEntrada';

const LOCKUP_SIMBOLO = 54;
const ALTO_BOTON = 54;

/** "O" ya cubierta por `Marca` (`app/_layout.tsx:113` — el monograma ES el glifo real de la O): el
 * wordmark sólo necesita animar el resto, igual que web separa `__o` de `__rest` (H-A4-2). */
const LETRAS_WORDMARK = ['d', 'o', 'b', 'i'];
/** 0.4em del `fontSize` del wordmark (40) — mismo offset que `translateY(0.4em)` de `Splash.css`. */
const OFFSET_LETRA = 16;

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

export interface RevealEntradaProps {
  /** Etiquetas de las dos puertas (`TEXTOS_REVEAL`): el mismo reveal aterriza distinto según la sesión. */
  primario: string;
  /** Vacío = no hay alta disponible todavía (BETA-4b): el botón secundario no se dibuja. */
  secundario: string;
  onPrimario: () => void;
  onSecundario: () => void;
  testID?: string;
  /**
   * BL-X10 — asset empaquetado de la pronunciación («se dice o-DO-bi» en voz de marca). NO hay
   * ningún audio en el repo todavía (pedido a operador/Martín, `[ASSUMED_PENDING_VERIFY]`): sin
   * asset, el botón no se renderiza — sólo queda el texto, como hasta ahora. A diferencia de web
   * (BL-X12w, `speechSynthesis`), acá NO hay TTS de fallback: la voz de marca es un asset, no una
   * síntesis genérica.
   */
  pronunciacionAsset?: AudioSource | null;
}

/**
 * El reveal de la entrada (prototipo `#reveal`, `?ver=reveal|volver`): el lockup entero —el primer
 * momento donde la marca se presenta completa—, «se dice o-DO-bi» y dos puertas. **Es el MISMO motor**
 * para el primer ingreso y para el post-logout (`TEXTOS_REVEAL`): no se duplica el markup. BL-X10 le
 * suma la animación de entrada (`IdentidadEntrada`) sobre este componente; no hay un segundo splash.
 */
export function RevealEntrada({
  primario,
  secundario,
  onPrimario,
  onSecundario,
  testID = 'reveal-entrada',
  pronunciacionAsset,
}: RevealEntradaProps) {
  const tema = useTema();
  const reducido = useReducedMotion();
  const reproductor = useAudioPlayer(pronunciacionAsset ?? null);
  const estiloLetra = { color: tema.color.acentoTinta, fontSize: 40, fontFamily: tema.fuente.display, fontWeight: '800' as const, letterSpacing: -0.5 };

  function pronunciar() {
    reproductor.seekTo(0);
    reproductor.play();
  }

  return (
    <View testID={testID} style={[styles.raiz, { backgroundColor: tema.color.fondo, padding: tema.espacio.lg }]}>
      <View style={styles.medio}>
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
        <View style={styles.pronunciacion}>
          <Text testID={`${testID}-pronunciacion`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
            {PRONUNCIACION_MARCA}
          </Text>
          {pronunciacionAsset != null && (
            <Pressable
              testID={`${testID}-pronunciar`}
              accessibilityRole="button"
              accessibilityLabel="Escuchar cómo se pronuncia Odobi"
              onPress={pronunciar}
              style={pressableStyle([styles.botonPronunciar, { backgroundColor: tema.color.acentoSuperficie }])}
            >
              <Text style={{ color: tema.color.acentoTexto, fontSize: 12 }}>▶</Text>
            </Pressable>
          )}
        </View>
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
  botonPronunciar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  boton: { alignItems: 'center', justifyContent: 'center' },
});
