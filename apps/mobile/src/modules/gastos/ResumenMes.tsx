import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ETIQUETA_CATEGORIA, formatearImporte, formatearMesDePeriodo, type ResumenGastos } from '@copiloto/core';

import { BloqueCifra, elevacion } from '../../theme/BloqueCifra';
import { conAlfa } from '../../theme/glass/conAlfa';
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
 *
 * Va en `BloqueCifra` porque **«Total del mes» es LA cifra de esta pantalla** — así la nombra el
 * mapa de pantallas del sistema (`gastos`: *"Total del mes, desglose por categoría y las tres vías
 * de alta"*). Antes era un `Tile` de vidrio: mismo dato, sin jerarquía.
 */

export interface ResumenMesProps {
  resumen: ResumenGastos;
  /** Lo que va entre la cifra y el desglose: las vías de alta, que tienen que quedar a mano bajo el total. */
  entre?: ReactNode;
}

/**
 * Rediseño (Martin 15/11): el bloque negro lleva SÓLO la cifra del mes y su comparación; el desglose por
 * categoría salió a una tarjeta blanca propia, «En qué se fue». Adentro del bloque eran cinco barras apretadas
 * que lo estiraban a media pantalla y empujaban los botones de alta fuera de la vista.
 */
export function ResumenMes({ resumen, entre }: ResumenMesProps) {
  const tema = useTema();
  const sumaPorcentajes = resumen.porCategoria.reduce((a, c) => a + c.porcentaje, 0);

  return (
    <View style={styles.raiz}>
      <BloqueCifra
        testID="gastos-resumen"
        // H-A4-6: `resumen.periodo` llega "YYYY-MM" (sin día) del backend: es un mes, no una fecha.
        // Un formateador de fecha le inventa el día 1 y se lee «Gastado en 1 nov» (SM-N14).
        rotulo={`Gastado en ${formatearMesDePeriodo(resumen.periodo).toLowerCase()}`}
        cifra={formatearImporte(resumen.total)}
        chip={resumen.mesAnterior != null ? `Mes anterior: ${formatearImporte(resumen.mesAnterior)}` : undefined}
      />

      {entre}

      {resumen.porCategoria.length > 0 && (
        <View style={styles.seccion} testID="gastos-desglose">
          <Text accessibilityRole="header" style={[styles.rotulo, { color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }]}>
            En qué se fue
          </Text>
          <View style={[styles.tarjeta, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}>
            {resumen.porCategoria.map((c, i) => (
              <View
                key={c.categoria}
                style={[styles.filaCategoria, i > 0 && { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) }]}
                testID={`gastos-resumen-cat-${c.categoria}`}
              >
                <View style={styles.encabezadoCategoria}>
                  <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, flex: 1 }}>
                    {ETIQUETA_CATEGORIA[c.categoria]}
                  </Text>
                  <Text
                    testID={`gastos-resumen-cat-${c.categoria}-importe`}
                    style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
                  >
                    {/* `gastos` (mapeo 2026-10-12): el prototipo muestra el porcentaje junto al importe. El
                        dato ya viene del backend (`porcentaje`); se redondea sólo para mostrarlo — la barra
                        sigue usando el valor crudo. */}
                    {formatearImporte(c.total)} · {Math.round(c.porcentaje)}%
                  </Text>
                </View>
                <View style={[styles.barraFondo, { backgroundColor: conAlfa(tema.color.texto, 0.06) }]}>
                  <View
                    testID={`gastos-resumen-barra-${c.categoria}`}
                    style={[
                      styles.barra,
                      {
                        // Arena, no terracota: la barra informa, no se toca (Decisión B).
                        backgroundColor: tema.color.apoyo,
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
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: 20 },
  seccion: { gap: 12, paddingTop: 12 },
  rotulo: { paddingHorizontal: 4 },
  tarjeta: { borderRadius: 22, paddingHorizontal: 20 },
  filaCategoria: { gap: 10, paddingVertical: 16 },
  encabezadoCategoria: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  barraFondo: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barra: { height: 6, borderRadius: 3 },
});
