import { StyleSheet, Text, View } from 'react-native';

import { ETIQUETA_CATEGORIA, formatearImporte, type Gasto } from '@copiloto/core';

import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `TarjetaGasto` — una línea del listado de gastos.
 *
 * 🔴 **El importe se formatea con `formatearImporte`, NUNCA con `Number(...).toLocaleString()`.** Es
 * la salida cómoda y reintroduce el float que todo el contrato evita.
 *
 * 🔴 **El `origen` se muestra sólo cuando NO es manual**, y a propósito: marcar cada gasto tipeado
 * con un cartelito «manual» es ruido en el 100% de las filas del caso más común. Lo informativo es
 * ver que uno entró por voz — que además es el dato con el que vamos a saber si la voz se usa.
 */

const ICONO_ORIGEN: Record<string, string> = { voz: '🎙', foto: '📷' };

export interface TarjetaGastoProps {
  gasto: Gasto;
  onPress?: (gasto: Gasto) => void;
}

export function TarjetaGasto({ gasto, onPress }: TarjetaGastoProps) {
  const tema = useTema();
  const icono = ICONO_ORIGEN[gasto.origen];
  // El proveedor es opcional; sin él la fila necesita igual un título legible. La categoría siempre
  // existe (default `otros`), así que nunca queda una card sin encabezado.
  const titulo = gasto.proveedor ?? ETIQUETA_CATEGORIA[gasto.categoria];

  return (
    <Tile onPress={onPress != null ? () => onPress(gasto) : undefined} testID={`gasto-${gasto.id}`}>
      <View style={styles.fila}>
        <View style={styles.izquierda}>
          <Text
            numberOfLines={1}
            style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontWeight: '600' }}
            testID={`gasto-${gasto.id}-titulo`}
          >
            {icono != null ? `${icono} ` : ''}
            {titulo}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
            testID={`gasto-${gasto.id}-sub`}
          >
            {ETIQUETA_CATEGORIA[gasto.categoria]} · {gasto.fecha}
          </Text>
        </View>
        <Text
          style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontWeight: '700' }}
          testID={`gasto-${gasto.id}-monto`}
        >
          {formatearImporte(gasto.monto)}
        </Text>
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  izquierda: { flex: 1, gap: 2 },
});
