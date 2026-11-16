import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { formatearImporte } from '@copiloto/core';

import { conAlfa } from '../../../theme/glass/conAlfa';
import { PRESS_FADE, pressableStyle } from '../../../theme/glass/presion';
import { useTema } from '../../../theme/ThemeProvider';

/**
 * «En qué se me va» (Martin 15/11): un anillo en vez de la torta, con el total en el centro. Tocar una parte
 * —o su renglón de abajo— pone en el centro esa categoría: cuánto fue y qué parte del total.
 *
 * El color no es un arcoíris: es UNA tinta que se aclara de la categoría que más se lleva a la que menos. Así
 * el anillo se lee de un vistazo (lo más oscuro es donde más se va) y no compite con la terracota.
 */
export interface PorcionAnillo {
  categoria: string;
  valor: string | null;
}

const LADO = 176;
const RADIO = 68;
const GROSOR = 22;
const CENTRO = LADO / 2;
/** De la que más se lleva a la que menos. Pasada la última, se repite la más clara. */
const INTENSIDAD = [1, 0.72, 0.52, 0.38, 0.27, 0.19, 0.13, 0.09];
/** Hueco entre partes, en radianes. */
const HUECO = 0.035;

function punto(angulo: number) {
  return { x: CENTRO + RADIO * Math.sin(angulo), y: CENTRO - RADIO * Math.cos(angulo) };
}

function arco(desde: number, hasta: number): string {
  const a = punto(desde);
  const b = punto(hasta);
  return `M ${a.x} ${a.y} A ${RADIO} ${RADIO} 0 ${hasta - desde > Math.PI ? 1 : 0} 1 ${b.x} ${b.y}`;
}

export function AnilloCategorias({ porciones, epigrafe, testID }: { porciones: readonly PorcionAnillo[]; epigrafe?: string; testID: string }) {
  const tema = useTema();
  const [elegida, setElegida] = useState<string | null>(null);

  const partes = porciones
    .map((p) => ({ categoria: p.categoria, num: p.valor != null ? Number(p.valor) : 0 }))
    .filter((p) => p.num > 0)
    .sort((a, b) => b.num - a.num);
  const total = partes.reduce((acc, p) => acc + p.num, 0);

  if (partes.length === 0) {
    return (
      <Text testID={`${testID}-vacio`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
        Sin gastos en este período.
      </Text>
    );
  }

  let acumulado = 0;
  const arcos = partes.map((p, i) => {
    const fraccion = p.num / total;
    const desde = acumulado * 2 * Math.PI;
    acumulado += fraccion;
    const hasta = acumulado * 2 * Math.PI;
    const color = conAlfa(tema.color.texto, INTENSIDAD[Math.min(i, INTENSIDAD.length - 1)]);
    return { ...p, fraccion, desde, hasta, color };
  });
  const sel = arcos.find((a) => a.categoria === elegida) ?? null;
  const alternar = (categoria: string) => setElegida((actual) => (actual === categoria ? null : categoria));

  return (
    <View testID={testID} style={styles.raiz}>
      <View style={styles.anillo}>
        <Svg width={LADO} height={LADO}>
          {arcos.length === 1 ? (
            <Circle cx={CENTRO} cy={CENTRO} r={RADIO} fill="none" stroke={arcos[0].color} strokeWidth={GROSOR} />
          ) : (
            arcos.map((a) => (
              <Path
                key={a.categoria}
                testID={`${testID}-porcion-${a.categoria}`}
                // Una parte muy chica no puede perder más que su propio ancho con el hueco.
                d={arco(a.desde + Math.min(HUECO, (a.hasta - a.desde) / 4), a.hasta - Math.min(HUECO, (a.hasta - a.desde) / 4))}
                fill="none"
                stroke={a.color}
                strokeWidth={sel?.categoria === a.categoria ? GROSOR + 8 : GROSOR}
                onPress={() => alternar(a.categoria)}
              />
            ))
          )}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.centro]} pointerEvents="none">
          <Text testID={`${testID}-centro-rotulo`} numberOfLines={1} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            {sel != null ? sel.categoria : 'Total'}
          </Text>
          <Text
            testID={`${testID}-centro-cifra`}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 15, maxWidth: 2 * RADIO - GROSOR - 8 }}
          >
            {formatearImporte((sel != null ? sel.num : total).toFixed(2))}
          </Text>
          {sel != null && (
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{Math.round(sel.fraccion * 100)}% del total</Text>
          )}
        </View>
      </View>

      <View>
        {arcos.map((a, i) => {
          const activa = sel?.categoria === a.categoria;
          return (
            <Pressable
              key={a.categoria}
              testID={`${testID}-fila-${a.categoria}`}
              accessibilityRole="button"
              accessibilityState={{ selected: activa }}
              onPress={() => alternar(a.categoria)}
              style={pressableStyle([styles.fila, i > 0 && { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) }], PRESS_FADE)}
            >
              <View style={[styles.muestra, { backgroundColor: a.color }]} />
              <Text
                numberOfLines={1}
                style={{ flex: 1, color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: activa ? tema.fuente.uiSemibold : tema.fuente.ui }}
              >
                {a.categoria}
              </Text>
              <Text testID={`${testID}-pct-${a.categoria}`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, width: 40, textAlign: 'right' }}>
                {Math.round(a.fraccion * 100)}%
              </Text>
              <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.display, minWidth: 96, textAlign: 'right' }}>
                {formatearImporte((a.num).toFixed(2))}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {epigrafe != null && epigrafe !== '' && (
        <Text testID={`${testID}-epigrafe`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          {epigrafe}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: 12 },
  anillo: { alignSelf: 'center', width: LADO, height: LADO },
  centro: { alignItems: 'center', justifyContent: 'center', gap: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 10 },
  muestra: { width: 12, height: 12, borderRadius: 4 },
});
