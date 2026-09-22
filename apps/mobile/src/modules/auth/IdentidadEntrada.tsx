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
import Svg, { Path } from 'react-native-svg';

import { COLOR_FORMA_EGG, COLOR_FORMA_SCALLOP, COLOR_FORMA_SQUIRCLE, COLOR_FORMA_SUPER } from '../../theme/identidadPalette';
import { scallopPath } from './scallopPath';

const TAMANO = 132;
const EASE_GROW = Easing.bezier(0.5, 0, 0.2, 1);
const EASE_FIN = Easing.bezier(0.2, 0.8, 0.2, 1);

const GROW = 900;
const BLOB_STAGGER = 180;
const N_BLOBS = 4;
const T_LOCKUP = (N_BLOBS - 1) * BLOB_STAGGER + GROW * 0.55; // las formas ya cubrieron el lockup

/**
 * Colores FIJOS de marca (no salen de `tema.color`, mismo criterio que `--identidad-word` en web
 * `Splash.css` — logotipo, exento de tema por decisión Martín, `splash-port-reanimated.md §8`).
 * Aproximación deliberada de las formas del prototipo (`v2-inmersivo.html`): React Native no
 * soporta radios de borde elípticos asimétricos (h/v por esquina) como CSS -- se usan radios
 * uniformes por esquina y color sólido en vez de degradé. Fidelidad de forma a refinar en la
 * verificación visual de device (fuera de este sprint).
 */
const FORMAS = [
  { key: 'scallop', svg: true, rot0: 8, rot1: -26 },
  { key: 'squircle', color: COLOR_FORMA_SQUIRCLE, radio: 0.34, rot0: -12, rot1: 34 },
  { key: 'super', color: COLOR_FORMA_SUPER, radio: 0.5, rot0: -6, rot1: 22 },
  { key: 'egg', color: COLOR_FORMA_EGG, radio: 0.48, rot0: 10, rot1: -16, ultima: true },
] as const;

function Forma({
  index,
  color,
  radio,
  rot0,
  rot1,
  ultima,
  svg,
  reducido,
}: {
  index: number;
  color?: string;
  radio?: number;
  rot0: number;
  rot1: number;
  ultima?: boolean;
  svg?: boolean;
  reducido: boolean;
}) {
  const progreso = useSharedValue(reducido ? 1 : 0);
  const colapso = useSharedValue(reducido ? 1 : 0);

  useEffect(() => {
    if (reducido) return;
    progreso.value = withDelay(index * BLOB_STAGGER, withTiming(1, { duration: GROW, easing: EASE_GROW }));
    if (ultima) {
      colapso.value = withDelay(index * BLOB_STAGGER + GROW, withTiming(1, { duration: 520, easing: EASE_FIN }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara UNA vez al montar, tempo fijo
  }, []);

  const estilo = useAnimatedStyle(() => {
    const escala = 0.05 + progreso.value * 0.95 * (1 - colapso.value * 0.4);
    const rot = rot0 + (rot1 - rot0) * progreso.value;
    return {
      opacity: progreso.value * (1 - colapso.value * 0.85),
      transform: [{ scale: escala }, { rotate: `${rot}deg` }],
    };
  });

  const tamanoForma = TAMANO * 0.62;
  return (
    <Animated.View
      testID={`identidad-entrada-forma-${index + 1}`}
      style={[
        styles.forma,
        { width: tamanoForma, height: tamanoForma, marginLeft: -tamanoForma / 2, marginTop: -tamanoForma / 2 },
        !svg && { backgroundColor: color, borderRadius: tamanoForma * (radio ?? 0.5) },
        estilo,
      ]}
    >
      {svg && (
        <Svg width="100%" height="100%" viewBox="0 0 1 1">
          <Path d={scallopPath()} fill={COLOR_FORMA_SCALLOP} />
        </Svg>
      )}
    </Animated.View>
  );
}

/**
 * BL-X10 — animación de entrada SOBRE el lockup de `RevealEntrada` (no hay un segundo splash, ver
 * docstring de ese componente): 4 formas creciendo con stagger, la última colapsando para revelar
 * el lockup real por debajo. `children` es el lockup ya renderizado (Marca + "Odobi"), que funde
 * entrada recién cuando las formas terminan de cubrirlo -- así nunca se ven los dos al mismo tiempo.
 */
export function IdentidadEntrada({ children }: { children: React.ReactNode }) {
  const reducido = useReducedMotion();
  const lockupOpacidad = useSharedValue(reducido ? 1 : 0);
  const lockupEscala = useSharedValue(reducido ? 1 : 0.85);

  useEffect(() => {
    if (reducido) return;
    lockupOpacidad.value = withDelay(T_LOCKUP, withTiming(1, { duration: 460, easing: EASE_FIN }));
    lockupEscala.value = withDelay(T_LOCKUP, withTiming(1, { duration: 460, easing: EASE_FIN }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara UNA vez al montar, tempo fijo
  }, []);

  const estiloLockup = useAnimatedStyle(() => ({
    opacity: lockupOpacidad.value,
    transform: [{ scale: lockupEscala.value }],
  }));

  return (
    <View testID="identidad-entrada" style={styles.raiz}>
      {!reducido && (
        <View style={styles.formas} pointerEvents="none">
          {FORMAS.map((f, i) => (
            <Forma
              key={f.key}
              index={i}
              color={'color' in f ? f.color : undefined}
              radio={'radio' in f ? f.radio : undefined}
              rot0={f.rot0}
              rot1={f.rot1}
              ultima={'ultima' in f ? f.ultima : undefined}
              svg={'svg' in f ? f.svg : undefined}
              reducido={reducido}
            />
          ))}
        </View>
      )}
      <Animated.View style={estiloLockup}>{children}</Animated.View>
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
