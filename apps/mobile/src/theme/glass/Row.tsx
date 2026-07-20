/**
 * `Row` — fila de vidrio de la Capa 0 (lista "Actividad reciente"). Hermana de `Tile` pero más chata.
 *
 * Diseño (ver [[reference-design-tokens-glass]] §Tiles/rows): `linear-gradient(160deg, s1, s2)` +
 * borde `chip` (más tenue que el `bd` del tile) + línea de luz superior + radio 16. Padding `12px 13px`.
 * Presionable opcional (una fila abre el item que representa). Sin blur (va sobre el fondo sólido).
 *
 * Cero-hex: color por `useTema().glass`.
 */
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTema } from '../ThemeProvider';
import { PRESS_FADE } from './presion';
import { sombraFila } from './relieve';

export interface RowProps extends PropsWithChildren {
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
  accessibilityLabel?: string;
}

export function Row({ onPress, style, testID, accessibilityLabel, children }: RowProps) {
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
        // SIN `backgroundColor` — misma razón que en `Tile`: la fila es de vidrio. Ver `relieve.ts`.
        { borderColor: g.chip },
        sombraFila(g.sombra),
        // Opacidad y no escala: una fila ancha que encoge arrastra el layout de al lado. Ver `presion.ts`.
        pressed && onPress ? PRESS_FADE : null,
        style,
      ]}
    >
      <LinearGradient
        colors={[g.s1, g.s2]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.luzSuperior, { backgroundColor: g.chip }]} pointerEvents="none" />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  raiz: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    // La sombra proyectada (relieve) la pone `sombraFila()` — ver `relieve.ts`.
  },
  luzSuperior: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
});
