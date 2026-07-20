/**
 * `Tile` — superficie de vidrio de la Capa 0 (escritorio de funciones). Un mosaico presionable.
 *
 * Diseño (ver [[reference-design-tokens-glass]] §Tiles/rows): `linear-gradient(160deg, s1, s2)` +
 * borde `bd` + `inset 0 1px 0 bd` (línea de luz superior) + radio 20. Tap: `transform .14s ease` +
 * `:active scale(.95)`. No lleva blur (va sobre el fondo sólido del escritorio, no sobre otra capa).
 *
 * Cero-hex: color por `useTema().glass`. Para Medical White (tema claro), el gradiente `s1/s2` ya es
 * claro y el efecto lee como relieve suave; la neumorfia inset completa del diseño se aproxima con la
 * línea de luz superior (RN no tiene `box-shadow` inset múltiple).
 */
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTema } from '../ThemeProvider';
import { PRESS_SCALE } from './presion';
import { sombraTile } from './relieve';

export interface TileProps extends PropsWithChildren {
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
  accessibilityLabel?: string;
}

export function Tile({ onPress, style, testID, accessibilityLabel, children }: TileProps) {
  const tema = useTema();
  const g = tema.glass;

  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.raiz,
        // SIN `backgroundColor`: el tile es de vidrio, o sea que deja ver el fondo del escritorio a
        // través del gradiente con alpha. El fondo sólido que había acá existía sólo para que Android
        // pudiera dibujar la sombra por `elevation` — y era justo lo que le mataba la transparencia.
        // Ver `relieve.ts`.
        { borderColor: g.bd },
        sombraTile(g.sombra),
        // El guard por `onPress` es a propósito: un tile decorativo no se hunde. Ver `presion.ts`.
        pressed && onPress ? PRESS_SCALE : null,
        style,
      ]}
    >
      <LinearGradient
        colors={[g.s1, g.s2]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.luzSuperior, { backgroundColor: g.bd }]} pointerEvents="none" />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  raiz: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    // La sombra proyectada (relieve/profundidad) la pone `sombraTile()` — ver `relieve.ts`.
  },
  luzSuperior: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
});
