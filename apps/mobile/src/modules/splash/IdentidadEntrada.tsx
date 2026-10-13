import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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
} from '../../theme/identidadPalette';
import { bordeElipticoPath, gradienteCss } from './formasPath';
import { scallopPath } from './scallopPath';

const TAMANO = 132;
const EASE_GROW = Easing.bezier(0.5, 0, 0.2, 1);
const EASE_FIN = Easing.bezier(0.2, 0.8, 0.2, 1);

// BL-X10 (H-A3-6, port fiel) — mismos tiempos y curvas que web (`modules/splash/tempos.ts` +
// `Splash.css`, "cerrado, Martín 29/07"). El lockup (Marca = glifo "O", wordmark "dobi" letra a
// letra) ya NO se anima acá: vive en `RevealEntrada`, que es donde está el contenido real. Estas
// constantes se exportan para que ese componente derive T_O/T_WORDMARK sin re-declarar el tempo.
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
/** Fin del bounce de la última letra. */
export const T_BOUNCE_END = T_WORDMARK + LETTER_STAGGER * 3 + LETTER + 120; // 6080
/** Duración total de la identidad (splash), primer ingreso / post-logout. Gemelo de `SPLASH_TOTAL_MS` web. */
export const SPLASH_TOTAL_MS = 6840;

/** Settle de la "O": mismo `cubic-bezier(.2,0,0,1)` que `identidad-o-appear` en `Splash.css`. */
export const EASE_SETTLE = Easing.bezier(0.2, 0, 0, 1);
/** Bounce del wordmark: mismo `cubic-bezier(.24,1.62,.4,1)` que `identidad-letra-bounce` (overshoot real, no error de transcripción). */
export const EASE_BOUNCE = Easing.bezier(0.24, 1.62, 0.4, 1);

/**
 * Colores FIJOS de marca (no salen de `tema.color`, mismo criterio que `--identidad-word` en web
 * `Splash.css` — logotipo, exento de tema por decisión Martín, `splash-port-reanimated.md §8`).
 *
 * Las formas replican las del prototipo (`index.html:1202-1204` y `2452-2456`): radios elípticos
 * asimétricos y degradé. React Native no los dibuja con estilos, así que cada forma es un `Path` SVG
 * (`formasPath.ts`). Antes eran radios uniformes + color sólido; la fila `splash` de DEVICE15 lo midió
 * como DESVÍO.
 */
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
  reducido,
}: {
  index: number;
  d: string;
  relleno: Relleno;
  rot0: number;
  rot1: number;
  reducido: boolean;
}) {
  const progreso = useSharedValue(reducido ? 1 : 0);
  const colapso = useSharedValue(reducido ? 1 : 0);

  useEffect(() => {
    if (reducido) return;
    progreso.value = withDelay(index * BLOB_STAGGER, withTiming(1, { duration: GROW, easing: EASE_GROW }));
    // 🔴 TODAS las formas colapsan al terminar de crecer, no sólo la última (DEVICE15 H8). Antes sólo
    // `egg` colapsaba —y terminaba en opacidad 0,15—: las otras tres quedaban fijas a opacidad 1 y se
    // veía un disco blanco con halo terracota pegado a la «i» del wordmark, de forma permanente. Medido
    // en device con `screencap` a ~9 s del logout. La web lo dice en `Splash.css` (H-A4-2): la forma es
    // un tránsito hacia la «O» real, «no queda como disco permanente — si quedara opaca tapa "dobi"».
    colapso.value = withDelay(index * BLOB_STAGGER + GROW, withTiming(1, { duration: COLAPSO, easing: EASE_FIN }));
  }, []);

  const estilo = useAnimatedStyle(() => {
    const escala = 0.05 + progreso.value * 0.95 * (1 - colapso.value * 0.4);
    const rot = rot0 + (rot1 - rot0) * progreso.value;
    return {
      opacity: progreso.value * (1 - colapso.value),
      transform: [{ scale: escala }, { rotate: `${rot}deg` }],
    };
  });

  const tamanoForma = TAMANO * 0.62;
  const idGradiente = `identidad-entrada-grad-${index + 1}`;
  const g = relleno.tipo === 'degradado' ? gradienteCss(relleno.anguloDeg) : null;
  return (
    <Animated.View
      testID={`identidad-entrada-forma-${index + 1}`}
      style={[
        styles.forma,
        { width: tamanoForma, height: tamanoForma, marginLeft: -tamanoForma / 2, marginTop: -tamanoForma / 2 },
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

/**
 * BL-X10 (port fiel) — animación de entrada SOBRE el lockup de `RevealEntrada` (no hay un segundo
 * splash, ver docstring de ese componente): 4 formas creciendo con stagger, la última colapsando
 * hacia donde entra la "O" real. `children` es el lockup real (`Marca` + wordmark "dobi"), que ya
 * NO se anima acá como bloque: cada pieza tiene su propio settle/bounce en `RevealEntrada`, igual
 * que web separa la forma que colapsa (H-A4-2) del glifo de texto que aparece por debajo.
 */
export function IdentidadEntrada({ children }: { children: React.ReactNode }) {
  const reducido = useReducedMotion();

  return (
    <View testID="identidad-entrada" style={styles.raiz}>
      {!reducido && (
        <View style={styles.formas} pointerEvents="none">
          {FORMAS.map((f, i) => (
            <Forma
              key={f.key}
              index={i}
              d={f.d}
              relleno={f.relleno}
              rot0={f.rot0}
              rot1={f.rot1}
              reducido={reducido}
            />
          ))}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { alignItems: 'center', justifyContent: 'center' },
  formas: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 1,
    height: 1,
  },
  forma: { position: 'absolute', overflow: 'hidden' },
});
