/**
 * `FondoIluminado` — la capa MÁS PROFUNDA del rediseño: el fondo del "teléfono" con zonas de luz
 * (mapeo de `--dm-phonebg` del template). Sin esto el fondo queda plano y el vidrio no tiene nada que
 * refractar; con esto cada skin gana sus glows (arriba/abajo) — cian, violeta, ámbar, azul-celeste
 * (blanco) y cian tenue (black), tal cual el diseño.
 *
 * En CSS son `radial-gradient(rx% ry% at cx% cy%, color, transparent 60%)`. RN no tiene radial-
 * gradient nativo, así que se dibuja con `react-native-svg`: un `RadialGradient` ELÍPTICO
 * (`rx`/`ry` en `objectBoundingBox`) por cada glow, del `color` (rgba del token) a transparente. Es
 * la MISMA técnica que `Orbe`, pero a pantalla completa y con las posiciones/tamaños del `--dm-phonebg`.
 *
 * Cero-hex: los colores/posiciones vienen SIEMPRE de `glass.fondoLuz` (tokens). Decorativo,
 * `pointerEvents="none"` — nunca intercepta toques.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTema } from '../ThemeProvider';

/** Fracción del radio donde el glow ya se desvaneció del todo (CSS: `transparent ~60%`). */
const DESVANECE = 0.6;
/** Intensidad global de la luz de fondo — ÚNICO knob para calibrar los 5 skins a la vez. Los alphas
 *  de `glass.fondoLuz` son el mapeo fiel de `--dm-phonebg`, pero a pantalla completa en OLED se leían
 *  fuertísimos (pedido operador 2026-07-18); esto los atenúa parejo sin tocar la fidelidad de cada skin. */
const INTENSIDAD = 0.42;

export interface FondoIluminadoProps {
  testID?: string;
}

export function FondoIluminado({ testID }: FondoIluminadoProps) {
  const luces = useTema().glass.fondoLuz;

  return (
    <View style={[StyleSheet.absoluteFill, { opacity: INTENSIDAD }]} pointerEvents="none" testID={testID}>
      <Svg width="100%" height="100%">
        <Defs>
          {luces.map((luz, i) => (
            <RadialGradient
              key={i}
              id={`fondo-luz-${i}`}
              cx={luz.cx}
              cy={luz.cy}
              rx={luz.rx}
              ry={luz.ry}
              gradientUnits="objectBoundingBox"
            >
              <Stop offset="0" stopColor={luz.color} stopOpacity={1} />
              <Stop offset={DESVANECE} stopColor={luz.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {luces.map((_, i) => (
          <Rect key={i} x="0" y="0" width="100%" height="100%" fill={`url(#fondo-luz-${i})`} />
        ))}
      </Svg>
    </View>
  );
}
