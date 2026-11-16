import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';

import { formatearImporte } from '@copiloto/core';

import { conAlfa } from '../../../theme/glass/conAlfa';
import { PRESS_FADE, pressableStyle } from '../../../theme/glass/presion';
import { useTema } from '../../../theme/ThemeProvider';

/**
 * «Lo que te quedó» (Martin 15/11): el gráfico que abre Inteligencia y contesta **¿gano o pierdo?** antes de
 * leer un número. Reemplaza a las dos tandas de barras («Mes a mes» y «Entró vs. salió»), que mostraban lo
 * mismo dos veces y dejaban la resta —lo único que importa— a cargo del que mira.
 *
 * Una sola línea: lo que entró menos lo que salió, mes por mes, sobre la raya del cero. Arriba de la raya
 * ganaste; abajo, perdiste. El signo lo dice la POSICIÓN y el relleno (tinta suave arriba, arena abajo), no
 * un verde y un rojo (SM-N32). Tocar un mes cambia la frase de arriba: cuánto quedó, cuánto entró y cuánto
 * salió. Arranca en el último mes con dato.
 *
 * Un mes al que le falta uno de los dos datos NO se dibuja en cero: corta la línea (ausente ≠ cero).
 */
export interface PuntoGanancia {
  /** `AAAA-MM`. */
  mes: string;
  entro: string | null;
  salio: string | null;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ALTO = 148;
const MARGEN_V = 14;

function nombreMes(mes: string): string {
  return MESES[Number(mes.slice(5)) - 1] ?? mes;
}

function neto(p: PuntoGanancia): number | null {
  if (p.entro == null || p.salio == null) return null;
  const n = Number(p.entro) - Number(p.salio);
  return Number.isFinite(n) ? n : null;
}

/** Curva entre dos puntos con tangentes horizontales: redondea sin pasarse de los valores reales. */
function tramo(x0: number, y0: number, x1: number, y1: number): string {
  const xm = (x0 + x1) / 2;
  return `C ${xm} ${y0} ${xm} ${y1} ${x1} ${y1}`;
}

export function LineaGanancia({ puntos, testID }: { puntos: readonly PuntoGanancia[]; testID: string }) {
  const tema = useTema();
  const [ancho, setAncho] = useState(0);
  const netos = puntos.map(neto);
  const ultimoConDato = netos.reduce<number>((acc, v, i) => (v != null ? i : acc), puntos.length - 1);
  const [elegido, setElegido] = useState<number | null>(null);
  const sel = Math.min(elegido ?? ultimoConDato, puntos.length - 1);

  const validos = netos.filter((n): n is number => n != null);
  const max = Math.max(0, ...validos);
  const min = Math.min(0, ...validos);
  const rango = max - min || 1;
  const y = (n: number) => MARGEN_V + ((max - n) / rango) * (ALTO - 2 * MARGEN_V);
  const x = (i: number) => ((i + 0.5) / puntos.length) * ancho;
  const yCero = y(0);

  // La línea en tramos: un mes sin dato la corta.
  const tramos: { d: string; desde: number; hasta: number }[] = [];
  let abierto: { d: string; desde: number; hasta: number } | null = null;
  netos.forEach((n, i) => {
    if (n == null) {
      abierto = null;
      return;
    }
    if (abierto == null) {
      abierto = { d: `M ${x(i)} ${y(n)}`, desde: i, hasta: i };
      tramos.push(abierto);
    } else {
      const previo = netos[i - 1] as number;
      abierto.d += ` ${tramo(x(i - 1), y(previo), x(i), y(n))}`;
      abierto.hasta = i;
    }
  });

  const elegirEn = (px: number) => {
    if (ancho <= 0 || puntos.length === 0) return;
    setElegido(Math.max(0, Math.min(puntos.length - 1, Math.floor((px / ancho) * puntos.length))));
  };

  const p = puntos[sel];
  const n = netos[sel];
  const tenue = { color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 };

  return (
    <View testID={testID} style={styles.raiz}>
      <View style={styles.cabecera}>
        <Text testID={`${testID}-frase`} style={tenue}>
          {n == null
            ? `De ${nombreMes(p.mes)} todavía no tengo lo que entró y lo que salió.`
            : n >= 0
              ? `En ${nombreMes(p.mes)} te quedaron`
              : `En ${nombreMes(p.mes)} perdiste`}
        </Text>
        {n != null && (
          <Text
            testID={`${testID}-neto`}
            style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 30, lineHeight: 36 }}
          >
            {formatearImporte((Math.abs(n)).toFixed(2))}
          </Text>
        )}
        {n != null && (
          <Text testID={`${testID}-detalle`} style={tenue}>
            Entró {formatearImporte(p.entro as string)} · Salió {formatearImporte(p.salio as string)}
          </Text>
        )}
      </View>

      <View style={{ height: ALTO }} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
        {ancho > 0 && (
          <Svg width={ancho} height={ALTO} pointerEvents="none">
            <Defs>
              <ClipPath id="arriba">
                <Rect x={0} y={0} width={ancho} height={yCero} />
              </ClipPath>
              <ClipPath id="abajo">
                <Rect x={0} y={yCero} width={ancho} height={ALTO - yCero} />
              </ClipPath>
            </Defs>
            {tramos.map((t) => {
              const area = `${t.d} L ${x(t.hasta)} ${yCero} L ${x(t.desde)} ${yCero} Z`;
              return (
                <G key={t.desde}>
                  <Path d={area} fill={conAlfa(tema.color.texto, 0.08)} clipPath="url(#arriba)" />
                  <Path d={area} fill={tema.color.apoyo} clipPath="url(#abajo)" />
                </G>
              );
            })}
            {/* La raya del cero: de acá para arriba se gana. */}
            <Line x1={0} x2={ancho} y1={yCero} y2={yCero} stroke={conAlfa(tema.color.texto, 0.28)} strokeWidth={1} strokeDasharray="3 4" />
            {/* La guía del mes elegido. */}
            <Line x1={x(sel)} x2={x(sel)} y1={0} y2={ALTO} stroke={conAlfa(tema.color.texto, 0.16)} strokeWidth={1} />
            {tramos.map((t) => (
              <Path key={t.desde} d={t.d} fill="none" stroke={tema.color.texto} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {netos.map((v, i) =>
              v == null ? null : i === sel ? (
                <Circle key={i} cx={x(i)} cy={y(v)} r={6} fill={tema.color.texto} stroke={tema.color.superficie} strokeWidth={3} />
              ) : (
                <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={tema.color.superficie} stroke={tema.color.texto} strokeWidth={2} />
              ),
            )}
          </Svg>
        )}
        {/* Toda la superficie del gráfico responde al dedo, con los eventos de toque CRUDOS (`onTouchStart` /
            `onTouchMove`) y no con `Pressable`: dentro del scroll de esta pantalla las franjas `Pressable` vacías
            no recibían el toque en el iPhone (Martin 15/11). Así además se puede arrastrar de un mes a otro. */}
        <View
          testID={`${testID}-superficie`}
          collapsable={false}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
          onTouchStart={(e) => elegirEn(e.nativeEvent.locationX)}
          onTouchMove={(e) => elegirEn(e.nativeEvent.locationX)}
        />
      </View>

      {/* Los nombres de los meses también se tocan: es la vía con etiqueta para el lector de pantalla. */}
      <View style={styles.meses}>
        {puntos.map((pt, i) => (
          <Pressable
            key={pt.mes}
            testID={`${testID}-mes-${pt.mes}`}
            accessibilityRole="button"
            accessibilityState={{ selected: i === sel }}
            accessibilityLabel={
              netos[i] == null
                ? `${nombreMes(pt.mes)}, sin datos`
                : `${nombreMes(pt.mes)}, ${(netos[i] as number) >= 0 ? 'quedaron' : 'perdiste'} ${formatearImporte(Math.abs(netos[i] as number).toFixed(2))}`
            }
            hitSlop={{ top: 12, bottom: 12 }}
            onPress={() => setElegido(i)}
            style={pressableStyle(styles.mesBoton, PRESS_FADE)}
          >
            <Text
              style={[
                styles.mes,
                {
                  color: i === sel ? tema.color.texto : tema.color.textoTenue,
                  fontFamily: i === sel ? tema.fuente.uiSemibold : tema.fuente.ui,
                },
              ]}
            >
              {nombreMes(pt.mes).slice(0, 3)}
            </Text>
          </Pressable>
        ))}
      </View>
      {puntos.length > 1 && <Text style={tenue}>Tocá o deslizá sobre el gráfico para ver cada mes.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: 12 },
  cabecera: { gap: 2 },
  meses: { flexDirection: 'row', marginTop: -4 },
  mesBoton: { flex: 1, minHeight: 28, justifyContent: 'center' },
  mes: { textAlign: 'center', fontSize: 11 },
});
