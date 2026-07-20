/**
 * `Orbe` — fuente de luz AMBIENTE difusa detrás del vidrio. Le da al glass algo que refractar.
 *
 * Regla del HANDOFF (§6): un orbe es LUZ (`filter: blur(52px)`, `opacity .55`), NUNCA una esfera
 * opaca tipo bola de billar (ese fue el bug que tapaba el texto). En RN no hay `filter: blur`; la
 * suavidad se logra con un gradiente RADIAL de `color` → transparente (react-native-svg), que ES el
 * desenfoque: no hay borde duro. `opacity` global del `Svg` cierra el efecto.
 *
 * Semántica de estado (HANDOFF §2-3): el color del orbe codifica el estado del elemento — cálido =
 * vivo, frío = archivado. Por eso `color` es un prop: cada capa pasa el orbe de SU familia de tono. El
 * default `glass.glow` (derivado del accent del tema) es el orbe "vivo".
 *
 * Cero-hex: el color viene del tema (o de quien lo invoque con un token). Es decorativo-de-estado,
 * `pointerEvents="none"` — nunca intercepta toques.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTema } from '../ThemeProvider';

export interface OrbeProps {
  /** Color de la luz. Default: `glass.glow` (el orbe "vivo" del tema). Pasar otro token para el frío. */
  color?: string;
  /** Lado del cuadro del orbe (px). El halo llena este cuadro y se desvanece hacia los bordes. */
  size?: number;
  /** Opacidad global del halo. Default 0.55 (el del diseño). */
  opacidad?: number;
  /** Posición/tamaño del contenedor (absolute). El orbe se ancla donde lo ponga el caller. */
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}

export function Orbe({ color, size = 320, opacidad = 0.55, style, testID }: OrbeProps) {
  const g = useTema().glass;
  const luz = color ?? g.glow;

  return (
    <View style={[styles.raiz, { width: size, height: size, opacity: opacidad }, style]} pointerEvents="none" testID={testID}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="orbe" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={luz} stopOpacity={1} />
            <Stop offset="0.55" stopColor={luz} stopOpacity={0.5} />
            <Stop offset="1" stopColor={luz} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill="url(#orbe)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { position: 'absolute' },
});
