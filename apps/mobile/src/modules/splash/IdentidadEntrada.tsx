import { LinearGradient as FondoDegradado } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import {
  COLOR_FORMA_EGG,
  COLOR_FORMA_SCALLOP,
  COLOR_FORMA_SQUIRCLE,
  COLOR_FORMA_SQUIRCLE_CLARO,
  COLOR_FORMA_SUPER,
  COLOR_SPLASH_FONDO_ABAJO,
  COLOR_SPLASH_FONDO_ARRIBA,
} from '../../theme/identidadPalette';
import { bordeElipticoPath, gradienteCss } from './formasPath';
import { scallopPath } from './scallopPath';

/** `#splash .blob{width:220px;height:220px}` (`index.html:1194`). */
const TAMANO = 220;
/** `blob-grow` termina en `scale(7.8)`: 220 × 7,8 ≈ 1716 dp, más que cualquier pantalla (la forma CUBRE el frame). */
const ESCALA_MAX = 7.8;
const ESCALA_MIN = 0.04;
/** `blob-collapse` termina en `scale(.33)` (`index.html:1214`). */
const ESCALA_FINAL = 0.33;
const EASE_GROW = Easing.bezier(0.5, 0, 0.2, 1);
/** `--ease-collapse` (`index.html:1191`). */
const EASE_COLAPSO = Easing.bezier(0.32, 0, 0.16, 1);
/** `--ease` (`index.html:50`): también el del `lockup-up` y los `fade-up`. */
export const EASE_FIN = Easing.bezier(0.2, 0.8, 0.2, 1);

// BL-X10 (H-A3-6, port fiel) — mismos tiempos y curvas que web (`modules/splash/tempos.ts` +
// `Splash.css`, "cerrado, Martín 29/07") y que el prototipo (`index.html:3396`, T = {grow:1900, col:1450,
// set:780, lstg:150, let:720}, stagger = .20 del grow). Estas constantes se exportan para que
// `RevealEntrada` derive T_O/T_WORDMARK sin re-declarar el tempo.
export const GROW = 1900;
export const BLOB_STAGGER = 380;
export const COLAPSO = 1450;
export const SETTLE = 780;
export const LETTER = 720;
export const LETTER_STAGGER = 150;
const N_BLOBS = 4;

/** Arranque del colapso: cuando el último blob (egg) empieza a nacer + su propio GROW. */
export const T_COLLAPSE_START = (N_BLOBS - 1) * BLOB_STAGGER + GROW; // 3040
/** La "O" (glifo `Marca`) queda visible un poco antes de que el colapso termine del todo. */
export const T_O = T_COLLAPSE_START + COLAPSO - Math.round(COLAPSO * 0.3); // 4055
/** El wordmark "dobi" empieza a entrar. */
export const T_WORDMARK = T_COLLAPSE_START + COLAPSO + 300; // 4790
/** Fin del bounce de la última letra: arranca el estado final (lockup sube, descriptor, puerta). */
export const T_BOUNCE_END = T_WORDMARK + LETTER_STAGGER * 3 + LETTER + 120; // 6080
/** Duración total de la identidad (splash), primer ingreso / post-logout. Gemelo de `SPLASH_TOTAL_MS` web. */
export const SPLASH_TOTAL_MS = 6840;

/** Settle de la "O": mismo `cubic-bezier(.2,0,0,1)` que `identidad-o-appear` en `Splash.css`. */
export const EASE_SETTLE = Easing.bezier(0.2, 0, 0, 1);
/** Bounce del wordmark: mismo `cubic-bezier(.24,1.62,.4,1)` que `identidad-letra-bounce` (overshoot real, no error de transcripción). */
export const EASE_BOUNCE = Easing.bezier(0.24, 1.62, 0.4, 1);

type Relleno =
  | { tipo: 'solido'; color: string }
  | { tipo: 'degradado'; anguloDeg: number; desde: string; hasta: string };

const FORMAS: ReadonlyArray<{ key: string; d: string; relleno: Relleno; rot0: number; rot1: number }> = [
  { key: 'scallop', d: scallopPath(), relleno: { tipo: 'solido', color: COLOR_FORMA_SCALLOP }, rot0: 8, rot1: -26 },
  {
    key: 'squircle',
    d: bordeElipticoPath([0.34, 0.34, 0.34, 0.34], [0.34, 0.34, 0.34, 0.34]),
    relleno: { tipo: 'degradado', anguloDeg: 160, desde: COLOR_FORMA_SQUIRCLE_CLARO, hasta: COLOR_FORMA_SQUIRCLE },
    rot0: -12,
    rot1: 34,
  },
  {
    key: 'super',
    d: bordeElipticoPath([0.58, 0.42, 0.47, 0.53], [0.47, 0.55, 0.45, 0.53]),
    relleno: { tipo: 'solido', color: COLOR_FORMA_SUPER },
    rot0: -6,
    rot1: 22,
  },
  {
    key: 'egg',
    d: bordeElipticoPath([0.46, 0.54, 0.52, 0.48], [0.53, 0.46, 0.54, 0.47]),
    relleno: { tipo: 'degradado', anguloDeg: 155, desde: COLOR_FORMA_SQUIRCLE, hasta: COLOR_FORMA_EGG },
    rot0: 10,
    rot1: -16,
  },
];

function Forma({
  index,
  d,
  relleno,
  rot0,
  rot1,
  ultima,
  ox,
  reducido,
}: {
  index: number;
  d: string;
  relleno: Relleno;
  rot0: number;
  rot1: number;
  ultima: boolean;
  /** Desplazamiento horizontal final de la forma que colapsa (negativo: hacia donde cae la «O»). */
  ox: number;
  reducido: boolean;
}) {
  // `blob-grow`: escala .04→7.8 con la curva del blob; la opacidad llega a 1 al 5 % del TIEMPO (lineal).
  const progreso = useSharedValue(reducido ? 1 : 0);
  const opacidad = useSharedValue(reducido ? 1 : 0);
  // `blob-collapse` (sólo la última): 7.8→.33 + desplazamiento a la «O»; opacidad 1 hasta el 72 % del tiempo.
  const colapso = useSharedValue(0);
  const colapsoLineal = useSharedValue(0);
  const desplazamiento = useSharedValue(ox);

  useEffect(() => {
    desplazamiento.value = ox;
  }, [ox]);

  useEffect(() => {
    if (reducido) return;
    const delay = index * BLOB_STAGGER;
    progreso.value = withDelay(delay, withTiming(1, { duration: GROW, easing: EASE_GROW }));
    opacidad.value = withDelay(delay, withTiming(1, { duration: Math.round(GROW * 0.05), easing: Easing.linear }));
    if (ultima) {
      colapso.value = withDelay(T_COLLAPSE_START, withTiming(1, { duration: COLAPSO, easing: EASE_COLAPSO }));
      colapsoLineal.value = withDelay(T_COLLAPSE_START, withTiming(1, { duration: COLAPSO, easing: Easing.linear }));
    }
  }, []);

  const estilo = useAnimatedStyle(() => {
    const c = colapso.value;
    const crecida = ESCALA_MIN + progreso.value * (ESCALA_MAX - ESCALA_MIN);
    const escala = c > 0 ? ESCALA_MAX + (ESCALA_FINAL - ESCALA_MAX) * c : crecida;
    const rot = c > 0 ? rot1 * (1 - c) : rot0 + (rot1 - rot0) * progreso.value;
    const t = colapsoLineal.value;
    const opColapso = t <= 0.72 ? 1 : Math.max(0, 1 - (t - 0.72) / 0.28);
    return {
      opacity: opacidad.value * (ultima ? opColapso : 1),
      transform: [{ translateX: desplazamiento.value * c }, { scale: escala }, { rotate: `${rot}deg` }],
    };
  });

  const idGradiente = `identidad-entrada-grad-${index + 1}`;
  const g = relleno.tipo === 'degradado' ? gradienteCss(relleno.anguloDeg) : null;
  return (
    <Animated.View
      testID={`identidad-entrada-forma-${index + 1}`}
      style={[
        styles.forma,
        { width: TAMANO, height: TAMANO, marginLeft: -TAMANO / 2, marginTop: -TAMANO / 2 },
        estilo,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 1 1">
        {relleno.tipo === 'degradado' && g != null && (
          <Defs>
            <LinearGradient id={idGradiente} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
              <Stop offset="0" stopColor={relleno.desde} />
              <Stop offset="1" stopColor={relleno.hasta} />
            </LinearGradient>
          </Defs>
        )}
        <Path d={d} fill={relleno.tipo === 'degradado' ? `url(#${idGradiente})` : relleno.color} />
      </Svg>
    </Animated.View>
  );
}

/** `.finalbg`: el fondo crema que se funde mientras la última forma colapsa (`bg-in`, lineal, `index.html:1206-1209`). */
function FondoFinal({ reducido }: { reducido: boolean }) {
  const opacidad = useSharedValue(reducido ? 1 : 0);
  useEffect(() => {
    if (reducido) return;
    opacidad.value = withDelay(T_COLLAPSE_START, withTiming(1, { duration: COLAPSO, easing: Easing.linear }));
  }, []);
  const estilo = useAnimatedStyle(() => ({ opacity: opacidad.value }));
  return (
    <Animated.View testID="identidad-entrada-fondo-final" style={[StyleSheet.absoluteFill, estilo]} pointerEvents="none">
      <FondoDegradado
        colors={[COLOR_SPLASH_FONDO_ARRIBA, COLOR_SPLASH_FONDO_ABAJO]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/**
 * Motor del splash (prototipo `#splash`, `index.html:1177-1251` y `3393-3445`), a PANTALLA COMPLETA: cada forma
 * nace chica en el centro, crece hasta cubrir el frame y adentro ya nace la siguiente; la última no sale: se
 * contrae y se desplaza al lugar exacto de la «O» (`ox`, de la mitad del ancho real de «dobi»). El fondo es
 * crema (`#splash{background:...}`) y se funde (`finalbg`) mientras eso ocurre. `children` es el lockup,
 * que va por encima (`.stage{z-index:40}`).
 */
export function IdentidadEntrada({ children, ox = 0 }: { children: React.ReactNode; ox?: number }) {
  const reducido = useReducedMotion();
  // Las formas CUBREN el frame: la capa mide la ventana, no lo que le dé el padre (medido en device: un
  // `absoluteFill` heredaba el alto colapsado del contenedor y el splash se veía en una caja).
  const { width, height } = useWindowDimensions();

  return (
    <View testID="identidad-entrada" style={[styles.raiz, { width, height }]}>
      <FondoDegradado
        testID="identidad-entrada-fondo"
        colors={[COLOR_SPLASH_FONDO_ARRIBA, COLOR_SPLASH_FONDO_ABAJO]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {!reducido && (
        <View style={styles.formas} pointerEvents="none">
          {FORMAS.slice(0, 3).map((f, i) => (
            <Forma key={f.key} index={i} d={f.d} relleno={f.relleno} rot0={f.rot0} rot1={f.rot1} ultima={false} ox={ox} reducido={reducido} />
          ))}
        </View>
      )}
      {!reducido && <FondoFinal reducido={reducido} />}
      {!reducido && (
        <View style={styles.formas} pointerEvents="none">
          <Forma
            index={3}
            d={FORMAS[3].d}
            relleno={FORMAS[3].relleno}
            rot0={FORMAS[3].rot0}
            rot1={FORMAS[3].rot1}
            ultima
            ox={ox}
            reducido={reducido}
          />
        </View>
      )}
      <View style={[styles.escenario, { width, height }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
  formas: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 1,
    height: 1,
  },
  forma: { position: 'absolute', overflow: 'hidden' },
  escenario: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
