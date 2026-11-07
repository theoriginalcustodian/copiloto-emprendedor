import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useTema } from '../../theme/ThemeProvider';
import { ARCOS, Onda, ONDAS, Trazo } from './EntradaDiaria';

/** Cuándo las líneas ya llegaron a su lugar (fin de `ONDAS`: 420 + 460 ms) y, si la card sigue sin aparecer, gira. */
export const ESPERA_GIRO_DESDE_MS = 900;
/** Una vuelta completa, a la derecha (horario), sin parar hasta que se desmonte. */
export const ESPERA_VUELTA_MS = 1400;

/**
 * Orden del operador (2026-11-06): mientras se espera la card, el logotipo de Odobi con el MISMO movimiento
 * de la entrada (los arcos largos se dibujan y los cortos salen de ellos) y, si tarda más que eso, el isotipo
 * completo gira hacia la derecha en círculo hasta que llega la card. Reusa `Trazo`/`Onda` de `EntradaDiaria`:
 * no hay un segundo dibujo del isotipo. Con «reducir movimiento» queda quieto y completo.
 */
export function EsperaOdobi({ size = 56, testID = 'espera-odobi' }: { size?: number; testID?: string }) {
  const tema = useTema();
  const reducido = useReducedMotion();
  const giro = useSharedValue(0);

  useEffect(() => {
    if (reducido) return undefined;
    giro.value = withDelay(
      ESPERA_GIRO_DESDE_MS,
      withRepeat(withTiming(360, { duration: ESPERA_VUELTA_MS, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(giro);
  }, [reducido]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ rotate: `${giro.value}deg` }] }));

  return (
    <Animated.View testID={testID} accessibilityRole="progressbar" style={[{ width: size, height: size }, estilo]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {ARCOS.map((a, i) => (
          <Trazo key={a.d} {...a} reducido={reducido} color={tema.color.acento} testID={`${testID}-trazo-${i + 1}`} />
        ))}
        {ONDAS.map((o, i) => (
          <Onda key={o.arco.x} {...o} reducido={reducido} color={tema.color.acento} testID={`${testID}-onda-${i + 1}`} />
        ))}
      </Svg>
    </Animated.View>
  );
}
