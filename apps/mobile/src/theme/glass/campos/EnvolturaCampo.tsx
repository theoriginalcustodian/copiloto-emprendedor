/**
 * `EnvolturaCampo` — el vidrio de un campo de formulario, dibujado en UN solo lugar.
 *
 * Extraída letra por letra del campo de texto del `Composer` del chat
 * (`modules/chat/Composer.tsx:113-135`, molde señalado por el operador): `View` con borde+radio+
 * `overflow:hidden` → `LinearGradient` (`glass.s1`→`glass.s2`, diagonal `{0.2,0}→{0.8,1}`) en
 * `absoluteFill` → una `luzSuperior` de 1px (`glass.hi`, inset 16 a cada lado). Ese campo YA resuelve
 * el vidrio de un input; volver a declararlo por cada campo de facturación habría sido exactamente lo
 * que el operador pidió evitar -- reinventar lo que ya existe (`CLAUDE.md` §3.ter).
 *
 * Todo campo de `campos/` pasa por acá -- incluido el chip de `CampoSelect`, que es la misma
 * superficie de vidrio en una caja más chica. Ninguno vuelve a declarar el `LinearGradient`.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTema } from '../../ThemeProvider';

export interface EnvolturaCampoProps extends PropsWithChildren {
  /** Pinta el borde en `color.peligro` -- el mismo campo que trajo el `Faltante` del backend. */
  error?: boolean;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}

export function EnvolturaCampo({ children, error = false, style, testID }: EnvolturaCampoProps) {
  const tema = useTema();
  return (
    <View
      testID={testID}
      style={[styles.campo, { borderColor: error ? tema.color.peligro : tema.color.borde }, style]}
    >
      <LinearGradient
        colors={[tema.glass.s1, tema.glass.s2]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.luzSuperior, { backgroundColor: tema.glass.hi }]} pointerEvents="none" />
      {children}
    </View>
  );
}

/** Proporciones heredadas 1:1 del `Composer` -- no de los tokens de espaciado: gobiernan la FORMA del
 *  diseño de vidrio, no el color (eso sí sale de los tokens, regla cero-hex). */
const RADIO_CAMPO = 20;
const ALTO_MINIMO_CAMPO = 48;

const styles = StyleSheet.create({
  campo: {
    borderWidth: 1,
    borderRadius: RADIO_CAMPO,
    minHeight: ALTO_MINIMO_CAMPO,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  luzSuperior: { position: 'absolute', top: 0, left: 16, right: 16, height: 1 },
});
