import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatearImporte } from '@copiloto/core';

import { useTema } from '../../../theme/ThemeProvider';
import { PRESS_FADE } from '../../../theme/glass/presion';

/**
 * `GraficoBarras` — el primitivo de barras del contrato de Inteligencia de Negocio (§2): sirve para
 * el gráfico 1 (facturación, una serie) y el gráfico 2 (entró vs salió, dos series enfrentadas) — un
 * solo componente, `series` decide cuántas barras dibuja por punto.
 *
 * 🔴 **`View`s proporcionales, NO una librería de gráficos.** Mismo patrón que `SerieBarras` (portada,
 * `PantallaInteligencia.tsx`), que ya está probado en device: barras SVG hubieran sido una dependencia
 * nueva → rebuild EAS (contrato §2 ítem 1). Para rectángulos de alto proporcional, `View` alcanza y el
 * contrato pide "colores plenos, sin degradados" — exactamente lo que da un `View` con `backgroundColor`.
 *
 * 🔴 **Colores por SERIE, no por punto.** El contrato no pide identidad categórica acá (eso es sólo
 * la torta, gráfico 3) — una barra de "entró" es siempre el mismo color en todos los meses. Vienen de
 * `tema.color.exito`/`peligro`/`acento`, nunca inventados.
 *
 * 🔴 **Tocar una barra abre el detalle del segmento** (contrato §2) — `onSegmentoPress` recibe la
 * `etiqueta` del punto (típicamente el mes) y, si hay dos series, cuál lado se tocó vía `serieId`. El
 * llamador decide qué hacer (pedir `?detalle=<etiqueta>` o `?detalle=<etiqueta>:<serieId>`); este
 * componente no sabe de la forma de la API.
 */

export interface SerieBarra {
  /** Clave estable de la serie (ej. `'entro'`/`'salio'`), va en el callback de tap. */
  id: string;
  etiqueta: string;
  color: string;
  /** Un valor por punto, mismo índice que `puntos`. `null` = sin dato — no dibuja barra. */
  valores: readonly (string | null)[];
}

export interface GraficoBarrasProps {
  /** Las etiquetas del eje (meses, típicamente) — un punto por posición. */
  puntos: readonly string[];
  series: readonly SerieBarra[];
  /** `"Julio · 12 facturas"` — el contrato exige período y fuente siempre visibles. */
  epigrafe?: string;
  onSegmentoPress?: (punto: string, serieId: string) => void;
  testID?: string;
}

const ALTO = 110;

export function GraficoBarras({ puntos, series, epigrafe, onSegmentoPress, testID }: GraficoBarrasProps) {
  const tema = useTema();

  const max = Math.max(
    1,
    ...series.flatMap((s) => s.valores.filter((v): v is string => v != null).map((v) => Math.abs(Number(v)))),
  );

  return (
    <View testID={testID} style={styles.raiz}>
      {epigrafe != null && epigrafe !== '' && (
        <Text testID={testID ? `${testID}-epigrafe` : undefined} style={[styles.epigrafe, { color: tema.color.textoTenue }]}>
          {epigrafe}
        </Text>
      )}

      {series.length > 1 && (
        <View style={styles.leyenda}>
          {series.map((s) => (
            <View key={s.id} style={styles.leyendaItem}>
              <View style={[styles.leyendaPunto, { backgroundColor: s.color }]} />
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{s.etiqueta}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.fila}>
        {puntos.length === 0 && (
          <Text testID={testID ? `${testID}-vacio` : undefined} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            Sin datos en este período.
          </Text>
        )}

        {puntos.map((punto, indice) => (
          <View key={punto} style={styles.columna} testID={testID ? `${testID}-punto-${punto}` : undefined}>
            <View style={styles.barrasPunto}>
              {series.map((s) => {
                const valor = s.valores[indice] ?? null;
                const tocable = onSegmentoPress != null && valor != null;
                const barra = (
                  <View
                    style={[
                      styles.barra,
                      {
                        height: valor == null ? 1 : Math.max(2, (Math.abs(Number(valor)) / max) * ALTO),
                        backgroundColor: valor == null ? tema.color.borde : s.color,
                      },
                    ]}
                  />
                );
                if (!tocable) {
                  return (
                    <View key={s.id} testID={testID ? `${testID}-barra-${punto}-${s.id}` : undefined}>
                      {barra}
                    </View>
                  );
                }
                return (
                  <Pressable
                    key={s.id}
                    testID={testID ? `${testID}-barra-${punto}-${s.id}` : undefined}
                    onPress={() => onSegmentoPress(punto, s.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.etiqueta} de ${punto}, ${formatearImporte(valor as string)}`}
                    style={({ pressed }) => [pressed ? PRESS_FADE : null]}
                    hitSlop={4}
                  >
                    {barra}
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.etiquetaEje, { color: tema.color.textoTenue }]} numberOfLines={1}>
              {punto}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: 8 },
  epigrafe: { fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', letterSpacing: 0.5 },
  leyenda: { flexDirection: 'row', gap: 14 },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  leyendaPunto: { width: 8, height: 8, borderRadius: 4 },
  fila: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, minHeight: ALTO + 20 },
  columna: { alignItems: 'center', gap: 4, flexGrow: 1, flexShrink: 1 },
  barrasPunto: { flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: ALTO },
  barra: { width: 14, borderRadius: 3 },
  etiquetaEje: { fontSize: 10 },
});
