/**
 * `RodilloEjemplos` — el tambor vertical del chat vacío: **un ejemplo por vez**.
 *
 * Enseña qué se le puede decir a Odobi. Un párrafo fijo con tres ejemplos ocupa tres renglones y se
 * lee como instrucciones; uno por vez se lee como que el copiloto sugiere.
 *
 * **La mecánica es la del sistema** (`odobi-ui/CLAUDE.md` §8, 19/08): las frases van
 * **SUPERPUESTAS, no en tira**. Cada una entra por abajo y sale por arriba recorriendo el alto del
 * renglón, dentro de un `overflow: hidden`. Curva simétrica `cubic-bezier(.45,.05,.35,1)` en
 * **0,62 s**, cambio cada **2,6 s**.
 *
 * 🔴 **Superpuestas y no en tira, y el motivo importa:** una tira tiene que *rebobinar* al llegar a
 * la última frase, y ese salto obliga a duplicar un elemento para disimularlo. Con las frases
 * superpuestas cada una hace exactamente el mismo viaje y el ciclo no tiene costura.
 *
 * ⚠️ **El giro corre TAMBIÉN con movimiento reducido** — decisión de Martin del 19/08, y es una
 * excepción deliberada, no un descuido. Bajo movimiento reducido la animación quedaba congelada en
 * un ejemplo y **la función —enseñar qué se le puede decir— quedaba anulada**: el usuario que más
 * necesita la ayuda era el único que no la recibía. Lo que sí se respeta es la escala del
 * movimiento: son 26 px cada 2,6 s, no un desplazamiento grande.
 *
 * ⚠️ **Deuda declarada, heredada del sistema:** WCAG 2.2.2 pide un mecanismo de pausa para todo
 * movimiento automático de más de 5 s. Acá no existe todavía. Está anotado en `CLAUDE.md` §8 con
 * las mismas palabras; no se resuelve inventando un botón que el diseño no tiene.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTema } from '../../theme/ThemeProvider';

/** Los tres del prototipo, palabra por palabra. */
export const EJEMPLOS = [
  '«Gasté 15 lucas en nafta»',
  '«¿Cuánto facturé este mes?»',
  '«Cobrale $80.000 a Rodríguez»',
] as const;

/** Cada cuánto cambia la frase. */
export const MS_POR_EJEMPLO = 2600;
/** Cuánto dura el viaje de una frase. */
export const MS_TRANSICION = 620;

/** La curva del sistema: simétrica, para que entrar y salir pesen igual. */
const CURVA = Easing.bezier(0.45, 0.05, 0.35, 1);

export interface RodilloEjemplosProps {
  testID?: string;
}

export function RodilloEjemplos({ testID }: RodilloEjemplosProps) {
  const tema = useTema();
  const [indice, setIndice] = useState(0);
  const alto = Math.round(tema.tipo.base * 1.6);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => setIndice((i) => (i + 1) % EJEMPLOS.length), MS_POR_EJEMPLO);
    return () => {
      if (timer.current != null) clearInterval(timer.current);
    };
  }, []);

  return (
    <View style={[styles.ventana, { height: alto }]} testID={testID}>
      {EJEMPLOS.map((frase, i) => (
        <Frase
          key={frase}
          frase={frase}
          alto={alto}
          // Cada frase sabe SOLO dónde está respecto de la activa: abajo esperando, en el centro, o
          // saliendo por arriba. Sin índice global no hay rebobinado que disimular.
          posicion={i === indice ? 0 : i === (indice - 1 + EJEMPLOS.length) % EJEMPLOS.length ? -1 : 1}
          color={tema.color.textoTenue}
          tamano={tema.tipo.base}
          testID={testID ? `${testID}-${i}` : undefined}
        />
      ))}
    </View>
  );
}

function Frase({
  frase,
  alto,
  posicion,
  color,
  tamano,
  testID,
}: {
  frase: string;
  alto: number;
  posicion: -1 | 0 | 1;
  color: string;
  tamano: number;
  testID?: string;
}) {
  const y = useSharedValue(posicion * alto);
  const opacidad = useSharedValue(posicion === 0 ? 1 : 0);

  useEffect(() => {
    // La que espera abajo se reubica SIN animar: si viajara, se vería cruzar la ventana al revés.
    if (posicion === 1) {
      y.value = alto;
      opacidad.value = 0;
      return;
    }
    y.value = withTiming(posicion * alto, { duration: MS_TRANSICION, easing: CURVA });
    opacidad.value = withTiming(posicion === 0 ? 1 : 0, { duration: MS_TRANSICION, easing: CURVA });
  }, [posicion, alto, y, opacidad]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: opacidad.value }));

  return (
    <Animated.Text
      testID={testID}
      accessibilityElementsHidden={posicion !== 0}
      style={[styles.frase, estilo, { color, fontSize: tamano, lineHeight: alto, fontStyle: 'italic' }]}
    >
      {frase}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  ventana: { overflow: 'hidden', alignSelf: 'stretch' },
  frase: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
});
