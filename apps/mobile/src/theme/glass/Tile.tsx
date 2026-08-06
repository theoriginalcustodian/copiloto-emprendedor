/**
 * `Tile` — superficie de vidrio de la Capa 0 (escritorio de funciones). Un mosaico presionable.
 *
 * Diseño (ver [[reference-design-tokens-glass]] §Tiles/rows): `linear-gradient(160deg, s1, s2)` +
 * borde `bd` + `inset 0 1px 0 bd` (línea de luz superior) + radio 20. No lleva blur (va sobre el
 * fondo sólido del escritorio, no sobre otra capa).
 *
 * Cero-hex: color por `useTema().glass`. Para Medical White (tema claro), el gradiente `s1/s2` ya es
 * claro y el efecto lee como relieve suave; la neumorfia inset completa del diseño se aproxima con la
 * línea de luz superior (RN no tiene `box-shadow` inset múltiple).
 */
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
/**
 * 🔴 **`Pressable` sale de Gesture Handler, NO de `react-native`.**
 *
 * Reportado por el operador: *"si lo apreto muy rápido no toma el primer tap… pero es random"*.
 * Medido con un registrador de 3 capas, sobre 97 eventos capturados hubo exactamente UN grupo sin
 * `OK`, y traía al culpable: el `ScrollView` del escritorio (responder system de React Native)
 * interpreta el tap como un arrastre y se lo lleva. Es aleatorio porque depende de cuántos píxeles se
 * movió el dedo, y aparece con taps RÁPIDOS porque un toque veloz arrastra unos píxeles al despegar.
 *
 * **Por qué no alcanza con cambiar sólo el `ScrollView`.** Mientras la presión la maneje el responder
 * system de React Native y el scroll viva en RNGH, siguen siendo dos árbitros distintos decidiendo
 * sobre el mismo dedo, y ninguno puede ceder a favor del otro. Con los dos en RNGH hay UNA arena: un
 * toque quieto lo gana el tile, uno que se arrastra lo gana el scroll. La regla de Software Mansion
 * pide las dos mitades —*"import ScrollView/FlatList from react-native-gesture-handler"* Y *"use
 * RectButton/Touchable for tappable items inside scroll containers"*— y hacen falta las dos.
 *
 * La API es la misma que la de RN (mismo `style={({pressed}) => …}` — aunque acá ya no se usa, ver
 * abajo), así que no cambia nada más.
 */
import { Pressable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

import { useTema } from '../ThemeProvider';
import { sombraNivel } from './relieve';

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
      style={() => [
        styles.raiz,
        // SIN `backgroundColor`: el tile es de vidrio, o sea que deja ver el fondo del escritorio a
        // través del gradiente con alpha. El fondo sólido que había acá existía sólo para que Android
        // pudiera dibujar la sombra por `elevation` — y era justo lo que le mataba la transparencia.
        // Ver `relieve.ts`.
        { borderColor: g.bd },
        // Nivel 2 · Elemento chico (DoD §2.4: "chips, tiles del escritorio" — textual). Mismo
        // mecanismo de sombra validado por el spike del hito 0 (`shadowColor` clásico), no el
        // `boxShadow` que usaba `sombraTile` hasta el hito 1 — ver el docstring de `relieve.ts`.
        sombraNivel(tema.glass.relieve.nivel2),
        // 🔴 **Sin hundido al presionar — pedido del operador:** *"el ícono tiene movimiento, se va
        // hacia atrás como un botón presionado y cuando se vuelve a levantar ahí recién lanza el
        // glass… vamos a quitarle ese movimiento, que sean fijos"*. El `scale(.95)` que había acá (en
        // `pressed`) daba esa sensación de "esperar a que el botón vuelva". Por eso el callback ya no
        // recibe `pressed`: la card es fija. El acuse del toque queda en manos de la navegación misma
        // —el glass sube—, no de una animación de la card.
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
    // La sombra proyectada (relieve/profundidad) la pone `sombraNivel(nivel2)` — ver `relieve.ts`.
  },
  luzSuperior: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
});
