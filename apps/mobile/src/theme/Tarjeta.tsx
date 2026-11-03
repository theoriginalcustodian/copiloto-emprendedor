/**
 * `Tarjeta` — la **card clara** del sistema: el `.bloque` del prototipo (`index.html:869`).
 *
 * 🔴 **Es el inverso de `BloqueCifra`, no una variante.** `BloqueCifra` es LA cifra de la pantalla (máximo
 * contraste, una por pantalla); esta es la superficie de todo lo demás: una lectura con su rótulo. Hasta
 * SM-N45 no existía como pieza —la elevación del sistema vivía privada en `BloqueCifra`— y una pantalla
 * que necesitaba una card clara la dibujó plana (Inteligencia, seis secciones).
 *
 * 🔴 **El color sale del tema, nunca un blanco fijo:** `color.superficie` (blanco en la piel clara,
 * marrón en la oscura). Un blanco fijo deja ilegible la piel oscura, el mismo motivo por el que el
 * bloque no es un negro fijo.
 *
 * ⚠️ **La elevación es la de `BloqueCifra`** (`elevacion`, exportada de ahí): no se reescribe. El mismo
 * arreglo viviendo en dos lugares con el fix llegando a uno es el defecto más repetido del repo.
 */
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { elevacion } from './BloqueCifra';
import { useTema } from './ThemeProvider';

export interface TarjetaProps extends PropsWithChildren {
  /** El `h4` del prototipo: 11 px, tracking .14em, caja alta. Sin rótulo, la card no lo dibuja. */
  rotulo?: string;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}

export function Tarjeta({ rotulo, children, style, testID }: TarjetaProps) {
  const tema = useTema();

  return (
    <View
      testID={testID}
      style={[
        styles.raiz,
        { backgroundColor: tema.color.superficie, borderRadius: tema.radio.md, padding: tema.espacio.md },
        elevacion(tema.color.sombra),
        style,
      ]}
    >
      {rotulo != null && (
        <Text
          testID={testID ? `${testID}-rotulo` : undefined}
          style={[styles.rotulo, { color: tema.color.textoTenue, fontFamily: tema.fuente.ui }]}
        >
          {rotulo}
        </Text>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: 6 },
  // 11 px × .14em ≈ 1.5 de tracking (prototipo `.bloque h4`).
  rotulo: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
});
