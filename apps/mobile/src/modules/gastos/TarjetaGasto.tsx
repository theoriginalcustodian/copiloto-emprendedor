import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ETIQUETA_CATEGORIA, formatearFechaCorta, formatearImporte, type CategoriaGasto, type Gasto } from '@copiloto/core';

import { conAlfa } from '../../theme/glass/conAlfa';
import { Glifo } from '../../theme/glass/Glifo';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `TarjetaGasto` — una fila del listado de gastos (rediseño, Martin 15/11): el mismo molde que las filas de Mi
 * día. A la izquierda el glifo de la categoría en su tile arena; en el medio a quién se le pagó, en negrita, y
 * debajo categoría y fecha; a la derecha el importe. Las filas viven juntas en UNA tarjeta blanca, que pone
 * quien lista: antes cada gasto era una caja de vidrio y doce gastos eran doce cajas.
 *
 * 🔴 **El importe se formatea con `formatearImporte`, NUNCA con `Number(...).toLocaleString()`.** Es
 * la salida cómoda y reintroduce el float que todo el contrato evita.
 *
 * 🔴 **El `origen` se muestra sólo cuando NO es manual**, y a propósito: marcar cada gasto tipeado
 * con un cartelito «manual» es ruido en el 100% de las filas del caso más común. Lo informativo es
 * ver que uno entró por voz — que además es el dato con el que vamos a saber si la voz se usa. Va dicho
 * en palabras en el detalle («por voz»), no con un emoji.
 */

const ORIGEN: Record<string, string> = { voz: 'por voz', foto: 'por foto' };

/**
 * Glifo por categoría (Martin 15/11): dice lo que se compra, y ninguno repite un ícono que en otra parte de la
 * app significa otra cosa — el engranaje es Ajustes, el enchufe es Apps, la persona sola es Clientes y Mi cuenta,
 * el local es Mi negocio. Impuestos usa el de ARCA, que ya es nuestro. Sirve para cualquier rubro: las
 * categorías son las mismas para un electricista, una veterinaria o un comercio.
 */
const GLIFO: Record<CategoriaGasto, string> = {
  mercaderia: 'package',
  servicios: 'lightning',
  alquiler: 'key',
  sueldos: 'users',
  impuestos: 'arca',
  transporte: 'truck',
  herramientas: 'wrench',
  otros: 'receipt',
};

export interface TarjetaGastoProps {
  gasto: Gasto;
  onPress?: (gasto: Gasto) => void;
  /** Divisor fino arriba: lo pide quien agrupa, para todas las filas menos la primera. */
  conDivisor?: boolean;
}

export function TarjetaGasto({ gasto, onPress, conDivisor = false }: TarjetaGastoProps) {
  const tema = useTema();
  const origen = ORIGEN[gasto.origen];
  // El proveedor es opcional; sin él la fila necesita igual un título legible. La categoría siempre
  // existe (default `otros`), así que nunca queda una fila sin encabezado.
  const titulo = gasto.proveedor ?? ETIQUETA_CATEGORIA[gasto.categoria];
  const t = tema.color.tileFuncion;

  return (
    <Pressable
      testID={`gasto-${gasto.id}`}
      accessibilityRole={onPress != null ? 'button' : undefined}
      disabled={onPress == null}
      onPress={() => onPress?.(gasto)}
      style={pressableStyle(
        [styles.fila, conDivisor && { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) }],
        PRESS_FADE,
      )}
    >
      <View accessible={false} style={[styles.tile, { backgroundColor: t.arena }]}>
        <Glifo nombre={GLIFO[gasto.categoria]} size={20} color={t.tinta} />
      </View>
      <View style={styles.textos}>
        <Text
          numberOfLines={2}
          style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.uiSemibold, lineHeight: 21 }}
          testID={`gasto-${gasto.id}-titulo`}
        >
          {titulo}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}
          testID={`gasto-${gasto.id}-sub`}
        >
          {/* H-A4-6: `gasto.fecha` llega "YYYY-MM-DD" (sin hora) del backend — ISO crudo si se
              pinta tal cual. */}
          {ETIQUETA_CATEGORIA[gasto.categoria]} · {formatearFechaCorta(gasto.fecha)}
          {origen != null ? ` · ${origen}` : ''}
        </Text>
      </View>
      <Text
        style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.display, lineHeight: 21 }}
        testID={`gasto-${gasto.id}-monto`}
      >
        {formatearImporte(gasto.monto)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
});
