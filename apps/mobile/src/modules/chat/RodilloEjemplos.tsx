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
 * ⚠️ **Movimiento reducido y pausa (BL-W4, 2026-09-21) — reemplaza la excepción del 19/08.** El giro
 * corría también con movimiento reducido (decisión de Martin: sin giro, la función de enseñar
 * quedaba anulada). El backlog del beta (`BL-W4`, WCAG 2.2.2: movimiento automático de más de 5 s)
 * lo revierte: con el ajuste del sistema activo el rodillo queda QUIETO en el primer ejemplo (los
 * tres siguen a la vista al tocar «Pausar/Reanudar» en cualquier momento), y sin él hay un botón de
 * pausa. Decisión táctica anotada en el PR; si Martin la objeta, se vuelve a la excepción.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { EJEMPLOS_CHAT } from '@copiloto/core';

import { useMovimientoReducido } from '../../theme/movimientoReducido';
import { useTema } from '../../theme/ThemeProvider';

/** Los tres del prototipo, palabra por palabra — la fuente única vive en `@copiloto/core`. */
export const EJEMPLOS = EJEMPLOS_CHAT;

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
  const reducido = useMovimientoReducido();
  const [pausado, setPausado] = useState(false);
  const corre = !pausado && !reducido;

  useEffect(() => {
    if (!corre) return;
    timer.current = setInterval(() => setIndice((i) => (i + 1) % EJEMPLOS.length), MS_POR_EJEMPLO);
    return () => {
      if (timer.current != null) clearInterval(timer.current);
    };
  }, [corre]);

  return (
    <View testID={testID} style={styles.raiz}>
      <View style={[styles.ventana, { height: alto }]}>
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
      {/* Sin movimiento no hay nada que pausar: con el ajuste del sistema activo el botón no se ofrece. */}
      {!reducido && (
        <Pressable
          testID={testID ? `${testID}-pausa` : undefined}
          accessibilityRole="button"
          accessibilityLabel={pausado ? 'Reanudar ejemplos' : 'Pausar ejemplos'}
          onPress={() => setPausado((p) => !p)}
          hitSlop={12}
          style={styles.pausa}
        >
          <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            {pausado ? '▶ Reanudar' : '❚❚ Pausar'}
          </Text>
        </Pressable>
      )}
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
  raiz: { alignSelf: 'stretch', alignItems: 'center' },
  pausa: { paddingVertical: 4 },
  ventana: { overflow: 'hidden', alignSelf: 'stretch' },
  frase: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
});
