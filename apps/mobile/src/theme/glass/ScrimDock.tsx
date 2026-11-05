/**
 * `ScrimDock` — degradé de `fondo` que sube desde el borde inferior bajo el campo (SM-N25 DoD 4 / SM-N38).
 *
 * Es EL mismo scrim del chat (`ChatView`) extraído para reusarlo en Mi día colapsado: así el entorno del campo
 * son los mismos nodos en los dos, no un plano pintado a mano (un plano con borde mostró su canto, #1487).
 * Va de transparente arriba a `fondo` opaco abajo: sin borde que mostrar.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { useTema } from '../ThemeProvider';
import { conAlfa } from './conAlfa';

export const ALFA_SCRIM_ABAJO = 0.9;

export function ScrimDock({ testID }: { testID?: string }) {
  const tema = useTema();
  return (
    <LinearGradient
      testID={testID}
      pointerEvents="none"
      colors={[conAlfa(tema.color.fondo, 0), conAlfa(tema.color.fondo, ALFA_SCRIM_ABAJO)]}
      locations={[0, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}
