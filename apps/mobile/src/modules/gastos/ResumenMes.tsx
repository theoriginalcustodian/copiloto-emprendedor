import { StyleSheet, Text, View } from 'react-native';

import { ETIQUETA_CATEGORIA, formatearImporte, type ResumenGastos } from '@copiloto/core';

import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `ResumenMes` — cuánto lleva gastado este mes y en qué. **Es la recompensa de la función, no un
 * adorno**: sin esto, cargar gastos es trabajo que el emprendedor hace *para* el sistema y se
 * abandona en una semana.
 *
 * 🔴 **Las barras se normalizan sobre la suma REAL de los porcentajes, no sobre 100.** El contrato
 * avisa que no está garantizado que cierren (tres categorías iguales dan `33.3` tres veces = 99.9), y
 * dibujar contra 100 dejaría un hueco permanente que se lee como "falta un pedazo". Normalizar es
 * decisión de quien dibuja, con el dato crudo a la vista.
 *
 * 🔴 **`total: "0.00"` NO es un estado de error ni un vacío**: es "no gastaste nada este mes", que es
 * una respuesta. Se muestra el cero, no un mensaje de que algo falta.
 */

export interface ResumenMesProps {
  resumen: ResumenGastos;
}

export function ResumenMes({ resumen }: ResumenMesProps) {
  const tema = useTema();
  const sumaPorcentajes = resumen.porCategoria.reduce((a, c) => a + c.porcentaje, 0);

  return (
    <Tile testID="gastos-resumen">
      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }} testID="gastos-resumen-periodo">
        Gastado en {resumen.periodo}
      </Text>
      <Text
        style={{ color: tema.color.texto, fontSize: tema.tipo.titulo, fontWeight: '700' }}
        testID="gastos-resumen-total"
      >
        {formatearImporte(resumen.total)}
      </Text>

      {resumen.mesAnterior != null && (
        <Text
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
          testID="gastos-resumen-mes-anterior"
        >
          Mes anterior: {formatearImporte(resumen.mesAnterior)}
        </Text>
      )}

      <View style={styles.categorias}>
        {resumen.porCategoria.map((c) => (
          <View key={c.categoria} style={styles.filaCategoria} testID={`gastos-resumen-cat-${c.categoria}`}>
            <View style={styles.encabezadoCategoria}>
              <Text style={{ color: tema.color.texto, fontSize: tema.tipo.chico, flex: 1 }}>
                {ETIQUETA_CATEGORIA[c.categoria]}
              </Text>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                {formatearImporte(c.total)}
              </Text>
            </View>
            <View style={[styles.barraFondo, { backgroundColor: tema.color.textoTenue + '22' }]}>
              <View
                testID={`gastos-resumen-barra-${c.categoria}`}
                style={[
                  styles.barra,
                  {
                    backgroundColor: tema.color.acento,
                    // Sobre la suma real. Si `sumaPorcentajes` fuera 0 (todas en cero, que el backend
                    // ya filtra) la división daría NaN y la barra desaparecería sin avisar.
                    width: sumaPorcentajes > 0 ? `${(c.porcentaje / sumaPorcentajes) * 100}%` : '0%',
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  categorias: { gap: 8, marginTop: 12 },
  filaCategoria: { gap: 4 },
  encabezadoCategoria: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barraFondo: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barra: { height: 6, borderRadius: 3 },
});
