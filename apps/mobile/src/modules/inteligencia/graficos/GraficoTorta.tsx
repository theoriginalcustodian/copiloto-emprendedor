import { Text, View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { formatearImporte } from '@copiloto/core';

import { useTema } from '../../../theme/ThemeProvider';

/**
 * `GraficoTorta` — el primitivo de torta del contrato de Inteligencia de Negocio (§2), gráfico 3 ("en
 * qué se me va"). SVG con un `<Path>` de arco por porción — acá SÍ hace falta SVG (un círculo
 * proporcional no se arma con `View`s como las barras), pero es la MISMA librería que ya está en el
 * APK (`react-native-svg`, botón de voz), cero dependencia nueva.
 *
 * 🔴 **El color es CATEGÓRICO — sigue a la categoría, no a la posición en la torta.** Cada porción
 * recibe su color de `tema.color.categorico[índice de la categoría en `orden`]`, no del índice dentro
 * de ESTA respuesta: si un mes no tiene gasto en "sueldos", la porción de "sueldos" simplemente no
 * existe, pero "transporte" sigue siendo el mismo color que la vez pasada. Sin esto, la identidad
 * visual de una categoría cambiaría de mes a mes según qué otras categorías tuvieron gasto — la app
 * mentiría por reordenamiento, no por dato.
 *
 * 🔴 **Tocar una porción abre el detalle** (contrato §2) — mismo contrato que `GraficoBarras`.
 */

export interface PorcionTorta {
  categoria: string;
  /** Decimal string o `null`. Una porción con `null`/`'0'`/`'0.00'` no se dibuja — evita un arco de
   * ángulo cero que SVG puede rasterizar como una línea visible. */
  valor: string | null;
}

export interface GraficoTortaProps {
  porciones: readonly PorcionTorta[];
  /** El orden CANÓNICO de categorías (ej. `CATEGORIAS_GASTO`) — define qué color le toca a cada una,
   * independiente de qué porciones trajo esta respuesta. */
  orden: readonly string[];
  epigrafe?: string;
  onSegmentoPress?: (categoria: string) => void;
  testID?: string;
}

const RADIO = 70;
const CENTRO = 80;

/** Un punto sobre la circunferencia, ángulo en radianes desde las 12 (no desde las 3). */
function puntoEnCirculo(anguloRad: number) {
  return {
    x: CENTRO + RADIO * Math.sin(anguloRad),
    y: CENTRO - RADIO * Math.cos(anguloRad),
  };
}

/** El `d` de un `<Path>` de arco de torta entre dos ángulos (radianes, desde las 12, sentido horario). */
function arcoPath(anguloInicio: number, anguloFin: number): string {
  const inicio = puntoEnCirculo(anguloInicio);
  const fin = puntoEnCirculo(anguloFin);
  const grande = anguloFin - anguloInicio > Math.PI ? 1 : 0;
  return `M ${CENTRO} ${CENTRO} L ${inicio.x} ${inicio.y} A ${RADIO} ${RADIO} 0 ${grande} 1 ${fin.x} ${fin.y} Z`;
}

export function GraficoTorta({ porciones, orden, epigrafe, onSegmentoPress, testID }: GraficoTortaProps) {
  const tema = useTema();

  const conValor = porciones
    .map((p) => ({ ...p, num: p.valor != null ? Number(p.valor) : 0 }))
    .filter((p) => p.num > 0);
  const total = conValor.reduce((acc, p) => acc + p.num, 0);

  let acumulado = 0;
  const arcos = conValor.map((p) => {
    const anguloInicio = acumulado * 2 * Math.PI;
    const fraccion = total > 0 ? p.num / total : 0;
    acumulado += fraccion;
    const anguloFin = acumulado * 2 * Math.PI;
    const indiceOrden = orden.indexOf(p.categoria);
    const color =
      indiceOrden >= 0 ? tema.color.categorico[indiceOrden % tema.color.categorico.length] : tema.color.textoTenue;
    return { ...p, anguloInicio, anguloFin, color, fraccion };
  });

  return (
    <View testID={testID} style={styles.raiz}>
      {epigrafe != null && epigrafe !== '' && (
        <Text testID={testID ? `${testID}-epigrafe` : undefined} style={[styles.epigrafe, { color: tema.color.textoTenue }]}>
          {epigrafe}
        </Text>
      )}

      {arcos.length === 0 ? (
        <Text testID={testID ? `${testID}-vacio` : undefined} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Sin gastos en este período.
        </Text>
      ) : (
        <View style={styles.cuerpo}>
          <Svg width={CENTRO * 2} height={CENTRO * 2} testID={testID ? `${testID}-svg` : undefined}>
            {arcos.map((a) =>
              // Un círculo completo (una sola categoría con el 100%) no se puede dibujar como un arco
              // "grande" de inicio=fin — SVG lo colapsa a nada. Se dibuja como dos semicírculos.
              a.fraccion >= 0.999 ? (
                <Path
                  key={a.categoria}
                  d={`${arcoPath(0, Math.PI)} ${arcoPath(Math.PI, 2 * Math.PI)}`}
                  fill={a.color}
                  onPress={onSegmentoPress ? () => onSegmentoPress(a.categoria) : undefined}
                  testID={testID ? `${testID}-porcion-${a.categoria}` : undefined}
                />
              ) : (
                <Path
                  key={a.categoria}
                  d={arcoPath(a.anguloInicio, a.anguloFin)}
                  fill={a.color}
                  onPress={onSegmentoPress ? () => onSegmentoPress(a.categoria) : undefined}
                  testID={testID ? `${testID}-porcion-${a.categoria}` : undefined}
                />
              ),
            )}
          </Svg>

          <View style={styles.leyenda}>
            {arcos.map((a) => (
              <View key={a.categoria} style={styles.leyendaItem}>
                <View style={[styles.leyendaPunto, { backgroundColor: a.color }]} />
                <Text style={{ color: tema.color.texto, fontSize: tema.tipo.chico, flexShrink: 1 }} numberOfLines={1}>
                  {a.categoria}
                </Text>
                <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, fontFamily: tema.fuente.mono }}>
                  {formatearImporte(String(a.num))}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: 8 },
  epigrafe: { fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', letterSpacing: 0.5 },
  cuerpo: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  leyenda: { flex: 1, gap: 6 },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leyendaPunto: { width: 10, height: 10, borderRadius: 5 },
});
