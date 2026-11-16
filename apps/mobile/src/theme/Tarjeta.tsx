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
  /**
   * El título de la lectura. Rediseño (Martin 15/11): va AFUERA y arriba de la card, en display, como en el
   * resto de las funciones. Antes iba adentro, en caja alta de 11 px. Sin rótulo, no se dibuja.
   */
  rotulo?: string;
  /** El rótulo va DENTRO de la card, chico y tenue: para cuando la sección ya trae su título afuera. */
  rotuloAdentro?: boolean;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}

export function Tarjeta({ rotulo, rotuloAdentro = false, children, style, testID }: TarjetaProps) {
  const tema = useTema();
  const idRotulo = testID ? `${testID}-rotulo` : undefined;

  const card = (
    <View
      testID={testID}
      style={[
        styles.raiz,
        { backgroundColor: tema.color.superficie, borderRadius: tema.radio.md, padding: 20 },
        elevacion(tema.color.sombra),
        style,
      ]}
    >
      {rotulo != null && rotuloAdentro && (
        <Text testID={idRotulo} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>
          {rotulo}
        </Text>
      )}
      {children}
    </View>
  );
  if (rotulo == null || rotuloAdentro) return card;
  return (
    <View style={styles.seccion}>
      <Text
        testID={idRotulo}
        accessibilityRole="header"
        style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}
      >
        {rotulo}
      </Text>
      {card}
    </View>
  );
}

const styles = StyleSheet.create({
  seccion: { gap: 10 },
  raiz: { gap: 6 },
});
