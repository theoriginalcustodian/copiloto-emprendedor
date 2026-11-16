import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { useTema } from './ThemeProvider';

/**
 * Un dibujo de función (Martin 14/11): el DISEÑO del ícono de su casilla en «Tus funciones» con la LÍNEA de la
 * taza de Mi día —fina, de pluma, que engorda sólo en algunas curvas— y el COLOR trabajado como en el ícono: la
 * silueta repetida en arena, corrida abajo a la derecha, asomando por detrás.
 *
 * Tres capas, de atrás hacia adelante: la silueta desfasada (arena), la misma silueta en su lugar con el color
 * del fondo —tapa la mancha por dentro del objeto— y el trazo.
 *
 * Los datos salen de potrace sobre un boceto de prueba: por eso las coordenadas vienen con el eje vertical
 * invertido y todo se dibuja dentro de `transformacion` (misma trampa que la taza de `EstadoVacio`, que sin su
 * transformación no se veía). Cuando Martin cierre cada dibujo, se reemplaza por su SVG.
 */
export interface DibujoFuncion {
  viewBox: string;
  /** Ancho ÷ alto del `viewBox`. */
  proporcion: number;
  transformacion: string;
  /** El contorno exterior del objeto, sin sus huecos. */
  silueta: string;
  trazos: readonly string[];
  /** Alto en pantalla, si el dibujo pide menos que el tope: un objeto macizo pesa más que uno calado. */
  alto?: number;
}

/** Cuánto se corre la mancha, en proporción del ancho del `viewBox`: lo mismo en todos los dibujos. */
const DESFASE = 0.033;

/** Ancho del dibujo: el lado de la taza de Mi día. */
const ANCHO_DIBUJO = 168;

/** Tope de alto, para que un dibujo vertical (la pila de monedas) no empuje el texto fuera de la vista. */
const ALTO_MAXIMO = 132;

export interface VacioFuncionProps {
  dibujo: DibujoFuncion;
  titulo: string;
  cuerpo: string;
  testID?: string;
}

/**
 * El vacío de una función: su dibujo, qué falta y cómo se carga, en la voz de Odobi. Sin buscador ni rótulo de
 * lista alrededor: buscar en una lista vacía no encuentra nada. Se va con el primer registro.
 */
export function VacioFuncion({ dibujo, titulo, cuerpo, testID }: VacioFuncionProps) {
  const tema = useTema();
  const corrimiento = Math.round(Number(dibujo.viewBox.split(' ')[2]) * DESFASE);
  const alto = Math.min(ANCHO_DIBUJO / dibujo.proporcion, dibujo.alto ?? ALTO_MAXIMO);
  return (
    <View testID={testID} style={styles.raiz}>
      <Svg
        testID={testID != null ? `${testID}-dibujo` : undefined}
        width={alto * dibujo.proporcion}
        height={alto}
        viewBox={dibujo.viewBox}
      >
        <G transform={`translate(${corrimiento}, ${corrimiento})`}>
          <G transform={dibujo.transformacion}>
            <Path d={dibujo.silueta} fill={tema.color.apoyo} />
          </G>
        </G>
        <G transform={dibujo.transformacion}>
          <Path d={dibujo.silueta} fill={tema.color.fondo} />
          {dibujo.trazos.map((d, i) => (
            <Path key={i} d={d} fill={tema.color.texto} />
          ))}
        </G>
      </Svg>
      <Text
        style={{ color: tema.color.texto, fontSize: tema.tipo.grande, fontFamily: tema.fuente.display, textAlign: 'center' }}
      >
        {titulo}
      </Text>
      <Text style={[styles.cuerpo, { color: tema.color.textoTenue, fontSize: tema.tipo.base }]}>{cuerpo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { alignItems: 'center', gap: 12, paddingTop: 24, paddingHorizontal: 16 },
  cuerpo: { textAlign: 'center', lineHeight: 22, maxWidth: 300 },
});
